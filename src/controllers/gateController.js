const { Op } = require('sequelize');
const { recognizePlate } = require('../services/ocrService');
const { startTimer, stopTimer } = require('../services/timerService');
const { calculatePrice } = require('../services/pricingService');
const { ParkingSession, Reservation, User, Transaction, ParkingSpot } = require('../models');
const { sendGateCommand } = require('../services/mqttService'); // display hints only (NO_PLATE)

/* ─────────────────────────────────────────────────────────────────
   Helper: find an active reservation for a plate RIGHT NOW
   A reservation is considered valid if:
     - plateNumber matches (case-insensitive)
     - status is 'pending'
     - the current time falls within [reservedFrom, reservedUntil]
───────────────────────────────────────────────────────────────── */
const findValidReservation = async (plateNumber) => {
    const now = new Date();
    return Reservation.findOne({
        where: {
            plateNumber: plateNumber.toUpperCase(),
            status: 'pending',
            reservedFrom: { [Op.lte]: now },
            reservedUntil: { [Op.gte]: now }
        }
    });
};

/* ─────────────────────────────────────────────────────────────────
   POST /api/gate/entry
   Called by ESP32 front gate with an image.
   Flow:
     1. OCR → plate number
     2. Check if plate has a valid current reservation  → RESERVATION entry
     3. If no reservation found                         → GUEST entry
     4. Either way: open gate, create ParkingSession
───────────────────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────────────
   Helper: log and send a JSON response to the ESP32-CAM.
   This makes it easy to see exactly what the server sends back
   and what the servo will do as a result.
────────────────────────────────────────────────────────────────── */
const logAndSend = (res, status, body) => {
    const servoLine = body.action === 'OPEN_GATE'
        ? '  ✅  Servo WILL turn  — gate OPENS'
        : '  🔒  Servo will NOT turn — gate stays CLOSED';

    console.log('\n┌─── SERVER → ESP32-CAM RESPONSE ──────────────────────────');
    console.log(`│  HTTP Status : ${status}`);
    console.log(`│  action      : ${body.action || '(none)'}`);
    if (body.plateNumber) console.log(`│  plateNumber : ${body.plateNumber}`);
    if (body.message) console.log(`│  message     : ${body.message}`);
    console.log(`│${servoLine}`);
    console.log('│  Full JSON   :', JSON.stringify(body));
    console.log('└────────────────────────────────────────────────────────────\n');

    return res.status(status).json(body);
};

const handleEntryCapture = async (req, res) => {
    try {
        console.log('\n╔═══ ENTRY CAPTURE ══════════════════════════');
        if (!req.file) {
            console.log('║ ❌ No image in request');
            console.log('╚═══════════════════════════════════════════');
            return logAndSend(res, 400, { success: false, message: 'No image provided' });
        }
        console.log(`║ Image   : ${req.file.originalname}  (${req.file.size} bytes)`);

        const plateNumber = await recognizePlate(req.file.path);
        console.log(`║ OCR raw : "${plateNumber || '(nothing)'}"`);

        // ── OCR returned nothing — NO plate in the image ─────────────
        if (!plateNumber) {
            console.log('║ ❌ OCR — NO PLATE NUMBER detected');
            console.log('║     → Sending MQTT NO_PLATE (LCD hint) + MQTT DENY (gate stays closed)');
            console.log('╚═══════════════════════════════════════════');
            // LCD hint so ESP32 shows 'No Plate Number'
            sendGateCommand('NO_PLATE', { type: 'ENTRY', message: 'NO_PLATE_DETECTED' });
            // Gate control: tell ESP32 to deny
            sendGateCommand('DENY', { reason: 'NO_PLATE', message: 'No plate number detected in image' });
            return logAndSend(res, 200, {
                success: true,
                action: 'DO_NOTHING',
                message: 'No plate detected'
            });
        }

        const plate = plateNumber.toUpperCase().trim();
        console.log(`║ Plate   : ${plate}`);

        // ── Check for existing active session (prevent duplicates) ────
        const existingSession = await ParkingSession.findOne({
            where: { plateNumber: plate, status: 'active' }
        });
        if (existingSession) {
            console.log(`║ ❌ ALREADY INSIDE — session #${existingSession.id} for ${plate}`);
            console.log('║     → Sending MQTT DENY — servo will NOT turn');
            console.log('╚═══════════════════════════════════════════');
            sendGateCommand('DENY', { reason: 'ALREADY_INSIDE', plateNumber: plate, message: 'Vehicle already inside' });
            return logAndSend(res, 200, {
                success: false,
                action: 'DO_NOTHING',
                message: 'Vehicle already inside'
            });
        }

        // ── Look up user + reservation ─────────────────────────────
        const user = await User.findOne({ where: { vehiclePlateNumber: plate } });
        const reservation = await findValidReservation(plate);

        console.log(`║ User     : ${user ? user.name + ' (' + user.email + ')' : 'GUEST'}`);
        console.log(`║ Reserv.  : ${reservation ? '#' + reservation.id + ' Spot ' + reservation.spotNumber : 'none (guest)'}`);

        if (reservation) {
            // ▸ RESERVATION ENTRY
            console.log(`║ ✅ RESERVATION — opening gate. Spot #${reservation.spotNumber}`);
            await reservation.update({ status: 'active' });

            const spot = await ParkingSpot.findOne({ where: { reservationId: reservation.id } });
            if (spot) await spot.update({ isOccupied: true, isReserved: false });

            await ParkingSession.create({
                plateNumber: plate,
                userId: user ? user.id : reservation.userId,
                entryTime: new Date(),
                status: 'active',
                reservationId: reservation.id
            });

            startTimer(plate);

            console.log(`║ ✅ RESERVATION — sending MQTT OPEN → servo WILL turn`);
            console.log('╚═══════════════════════════════════════════');
            // MQTT: tell ESP32 to open the gate (primary servo control)
            sendGateCommand('OPEN', {
                type: 'RESERVATION',
                plateNumber: plate,
                spotNumber: reservation.spotNumber,
                message: `Reservation confirmed — Spot #${reservation.spotNumber}`
            });

            // ── Item 8: Immediately sync spot count on entry ──
            const maxSpots = parseInt(process.env.MAX_SPOTS) || 20;
            const nowActive = await ParkingSession.count({ where: { status: 'active' } });
            const nowPending = await Reservation.count({
                where: {
                    status: { [Op.in]: ['pending', 'active'] },
                    reservedFrom: { [Op.lte]: new Date() },
                    reservedUntil: { [Op.gte]: new Date() }
                }
            });
            const liveAvailable = Math.max(0, maxSpots - Math.max(nowActive, nowPending));
            console.log(`║ 📢 SYNC_SPOTS → ${liveAvailable} spots left`);
            sendGateCommand('SYNC_SPOTS', { spots: liveAvailable, reason: 'RESERVATION_ENTRY' });

            return logAndSend(res, 200, {
                success: true,
                action: 'OPEN_GATE',
                type: 'RESERVATION',
                plateNumber: plate,
                spotNumber: reservation.spotNumber,
                message: `Reservation found — Spot #${reservation.spotNumber}. Gate opening.`
            });

        } else {
            // ▸ GUEST ENTRY — plate recognised but no reservation
            console.log(`║ ✅ GUEST — plate ${plate} found, no reservation`);

            await ParkingSession.create({
                plateNumber: plate,
                userId: user ? user.id : null,
                entryTime: new Date(),
                status: 'active',
                reservationId: null
            });

            startTimer(plate);

            console.log('║ ✅ GUEST — sending MQTT OPEN → servo WILL turn');
            console.log('╚═══════════════════════════════════════════');
            // MQTT: tell ESP32 to open the gate (primary servo control)
            sendGateCommand('OPEN', {
                type: 'GUEST',
                plateNumber: plate,
                message: 'Guest entry authorised'
            });

            // ── Item 8: Immediately sync spot count on entry ──
            const maxSpots = parseInt(process.env.MAX_SPOTS) || 20;
            const nowActiveGuest = await ParkingSession.count({ where: { status: 'active' } });
            const nowPendingGuest = await Reservation.count({
                where: {
                    status: { [Op.in]: ['pending', 'active'] },
                    reservedFrom: { [Op.lte]: new Date() },
                    reservedUntil: { [Op.gte]: new Date() }
                }
            });
            const liveAvailableGuest = Math.max(0, maxSpots - Math.max(nowActiveGuest, nowPendingGuest));
            console.log(`║ 📢 SYNC_SPOTS → ${liveAvailableGuest} spots left`);
            sendGateCommand('SYNC_SPOTS', { spots: liveAvailableGuest, reason: 'GUEST_ENTRY' });

            return logAndSend(res, 200, {
                success: true,
                action: 'OPEN_GATE',
                type: 'GUEST',
                plateNumber: plate,
                message: 'Guest session started. Gate opening.'
            });
        }

    } catch (error) {
        console.error('[Entry] Error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

/* ─────────────────────────────────────────────────────────────────
   POST /api/gate/exit
   Called by ESP32 back gate with an image.
   Flow:
     1. OCR → plate number
     2. Find active session for that plate
     3. Calculate duration + price
     4. Complete session, create Transaction, open gate
───────────────────────────────────────────────────────────────── */
const handleExitCapture = async (req, res) => {
    try {
        console.log('\n╔═══ EXIT CAPTURE ═══════════════════════════');
        if (!req.file) {
            console.log('║ ❌ No image in request');
            console.log('╚═══════════════════════════════════════════');
            return res.status(400).json({ success: false, message: 'No image provided' });
        }
        console.log(`║ Image   : ${req.file.originalname}  (${req.file.size} bytes)`);

        const plateNumber = await recognizePlate(req.file.path);
        console.log(`║ OCR raw : "${plateNumber || '(nothing)'}"`);

        // ── Item 7: OCR returned nothing ─────────────────────────────
        if (!plateNumber) {
            console.log('║ ❌ OCR — no plate detected');
            console.log('╚═══════════════════════════════════════════');
            sendGateCommand('DENY_EXIT', { type: 'NO_PLATE', message: 'No plate detected' });
            return res.json({ success: true, action: 'DO_NOTHING', message: 'No plate detected' });
        }

        const plate = plateNumber.toUpperCase().trim();
        console.log(`║ Plate   : ${plate}`);

        const session = await ParkingSession.findOne({
            where: { plateNumber: plate, status: 'active' },
            order: [['entryTime', 'DESC']]
        });

        if (!session) {
            console.log(`║ ❌ No active session for plate ${plate}`);
            console.log('╚═══════════════════════════════════════════');
            sendGateCommand('DENY_EXIT', { type: 'UNKNOWN', plateNumber: plate, message: 'No active session' });
            return res.json({ success: true, action: 'DO_NOTHING', message: 'No active session' });
        }

        console.log(`║ Session : #${session.id}  entered ${session.entryTime}`);
        const durationMinutes = stopTimer(plate) || Math.ceil((Date.now() - new Date(session.entryTime).getTime()) / 60000);
        const price = calculatePrice(durationMinutes);
        console.log(`║ Duration: ${durationMinutes} min   Price: ${price} CFA`);

        await session.update({
            exitTime: new Date(),
            duration: durationMinutes,
            price,
            status: 'completed'
        });

        await Transaction.create({
            sessionId: session.id,
            userId: session.userId,
            amount: price,
            duration: durationMinutes,
            plateNumber: plate
        });

        // Mark the spot as free again
        if (session.reservationId) {
            const spot = await ParkingSpot.findOne({ where: { reservationId: session.reservationId } });
            if (spot) await spot.update({ isOccupied: false, isReserved: false, reservationId: null });
        }

        console.log('║ ✅ EXIT — gate opening, session completed');
        console.log('╚═══════════════════════════════════════════');
        sendGateCommand('OPEN_EXIT', {
            plateNumber: plate,
            message: 'Session completed. Gate opening.'
        });

        // ── Item 8: Immediately sync spot count on exit ──
        const maxSpots = parseInt(process.env.MAX_SPOTS) || 20;
        const nowActiveExit = await ParkingSession.count({ where: { status: 'active' } });
        const nowPendingExit = await Reservation.count({
            where: {
                status: { [Op.in]: ['pending', 'active'] },
                reservedFrom: { [Op.lte]: new Date() },
                reservedUntil: { [Op.gte]: new Date() }
            }
        });
        const liveAvailableExit = Math.max(0, maxSpots - Math.max(nowActiveExit, nowPendingExit));
        console.log(`║ 📢 SYNC_SPOTS → ${liveAvailableExit} spots left`);
        sendGateCommand('SYNC_SPOTS', { spots: liveAvailableExit, reason: 'VEHICLE_EXIT' });

        return res.json({
            success: true,
            action: 'OPEN_GATE',
            plateNumber: plate,
            duration: durationMinutes,
            price,
            message: `Session ended — ${durationMinutes} min, ${price} CFA. Gate opening.`
        });

    } catch (error) {
        console.error('[Exit] Error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

/* ─────────────────────────────────────────────────────────────────
   POST /api/gate/check-plate   (admin / manual)
   Body: { plateNumber }
   Manually check if a plate has a valid reservation (useful for
   kiosk / admin manual override).
───────────────────────────────────────────────────────────────── */
const checkPlate = async (req, res) => {
    try {
        const { plateNumber } = req.body;
        if (!plateNumber) {
            return res.status(400).json({ success: false, message: 'plateNumber is required' });
        }

        const plate = plateNumber.toUpperCase().trim();
        const reservation = await findValidReservation(plate);
        const user = await User.findOne({ where: { vehiclePlateNumber: plate } });

        if (reservation) {
            return res.json({
                success: true,
                hasReservation: true,
                plateNumber: plate,
                reservation: {
                    id: reservation.id,
                    spotNumber: reservation.spotNumber,
                    reservedFrom: reservation.reservedFrom,
                    reservedUntil: reservation.reservedUntil
                },
                user: user ? { name: user.name, email: user.email } : null,
                message: `Plate ${plate} has a valid reservation — Spot #${reservation.spotNumber}`
            });
        }

        return res.json({
            success: true,
            hasReservation: false,
            plateNumber: plate,
            user: user ? { name: user.name, email: user.email } : null,
            message: `No current reservation found for plate ${plate}`
        });

    } catch (error) {
        console.error('[CheckPlate] Error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

module.exports = {
    handleEntryCapture,
    handleExitCapture,
    checkPlate
};
