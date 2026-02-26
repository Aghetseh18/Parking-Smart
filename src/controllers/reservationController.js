const { Reservation, ParkingSpot, ParkingSession, User } = require('../models');
const { Op } = require('sequelize');
const { sendGateCommand, publishMessage } = require('../services/mqttService');

/* ─────────────────────────────────────────────────────────────────
   POST /api/reservations
   Body: { userId, plateNumber, reservedFrom, reservedUntil }

   ▸ plateNumber is REQUIRED — it's the gate-access identity
   ▸ Spot is auto-assigned (no manual spot selection)
   ▸ No one-time code — gate opens by plate scan
───────────────────────────────────────────────────────────────── */
const createReservation = async (req, res) => {
    try {
        const { userId, plateNumber, reservedFrom, reservedUntil } = req.body;

        if (!userId || !plateNumber || !reservedFrom || !reservedUntil) {
            return res.status(400).json({
                success: false,
                message: 'userId, plateNumber, reservedFrom and reservedUntil are all required'
            });
        }

        const plate = plateNumber.toUpperCase().trim();

        // ── Validate time range ─────────────────────────────────
        const from = new Date(reservedFrom);
        const until = new Date(reservedUntil);
        if (isNaN(from) || isNaN(until) || from >= until) {
            return res.status(400).json({ success: false, message: 'Invalid time range' });
        }

        const maxSpots = parseInt(process.env.MAX_SPOTS) || 20;

        // ── Count spots already committed in that window ────────
        const overlapping = await Reservation.count({
            where: {
                status: { [Op.in]: ['pending', 'active'] },
                reservedFrom: { [Op.lt]: until },
                reservedUntil: { [Op.gt]: from }
            }
        });

        const activeSessions = await ParkingSession.count({ where: { status: 'active' } });
        const used = Math.max(overlapping, activeSessions);

        if (used >= maxSpots) {
            return res.status(400).json({
                success: false,
                message: 'Parking lot is full for the selected period'
            });
        }

        // ── Check the plate doesn't already have an overlapping active reservation ──
        const duplicatePlate = await Reservation.findOne({
            where: {
                plateNumber: plate,
                status: { [Op.in]: ['pending', 'active'] },
                reservedFrom: { [Op.lt]: until },
                reservedUntil: { [Op.gt]: from }
            }
        });
        if (duplicatePlate) {
            return res.status(409).json({
                success: false,
                message: 'This plate already has a reservation in that time window'
            });
        }

        // ── Auto-assign a free spot ─────────────────────────────
        const availableSpot = await ParkingSpot.findOne({
            where: { isOccupied: false, isReserved: false },
            order: [['spotNumber', 'ASC']]
        });

        const assignedSpotNumber = availableSpot ? availableSpot.spotNumber : used + 1;

        // ── Create reservation ──────────────────────────────────
        const reservation = await Reservation.create({
            userId,
            plateNumber: plate,
            spotNumber: assignedSpotNumber,
            reservedFrom: from,
            reservedUntil: until,
            status: 'pending'
        });

        // ── Mark the spot as reserved ───────────────────────────
        if (availableSpot) {
            await availableSpot.update({ isReserved: true, reservationId: reservation.id });
        }

        // ── Item 6: Tell entry gate ESP32 to decrement its spot count ──
        // Re-query DB for the real live count after this reservation
        const nowActive = await ParkingSession.count({ where: { status: 'active' } });
        const nowPending = await Reservation.count({
            where: {
                status: { [Op.in]: ['pending', 'active'] },
                reservedFrom: { [Op.lte]: new Date() },
                reservedUntil: { [Op.gte]: new Date() }
            }
        });
        const liveAvailable = Math.max(0, maxSpots - Math.max(nowActive, nowPending));
        console.log(`[Reservation] 📢 SYNC_SPOTS → ${liveAvailable} spots — notifying entry gate`);
        sendGateCommand('SYNC_SPOTS', { spots: liveAvailable, reason: 'RESERVATION_CREATED' });

        res.status(201).json({
            success: true,
            message: 'Reservation confirmed — gate will open when your plate is scanned',
            data: {
                reservationId: reservation.id,
                plateNumber: plate,
                spotNumber: assignedSpotNumber,
                reservedFrom: from,
                reservedUntil: until
            }
        });

    } catch (error) {
        console.error('Reservation Create Error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

/* ─────────────────────────────────────────────────────────────────
   GET /api/reservations  — all (admin)
───────────────────────────────────────────────────────────────── */
const getAllReservations = async (req, res) => {
    try {
        const rows = await Reservation.findAll({
            include: [{ model: User, attributes: ['id', 'name', 'email', 'vehiclePlateNumber'] }],
            order: [['createdAt', 'DESC']]
        });
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Get All Reservations Error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

/* ─────────────────────────────────────────────────────────────────
   GET /api/reservations/user/:userId
───────────────────────────────────────────────────────────────── */
const getUserReservations = async (req, res) => {
    try {
        const rows = await Reservation.findAll({
            where: { userId: req.params.userId },
            include: [{ model: User, attributes: ['id', 'name', 'email', 'vehiclePlateNumber'] }],
            order: [['createdAt', 'DESC']]
        });
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Get User Reservations Error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

/* ─────────────────────────────────────────────────────────────────
   GET /api/reservations/:id
───────────────────────────────────────────────────────────────── */
const getReservation = async (req, res) => {
    try {
        const row = await Reservation.findByPk(req.params.id, {
            include: [{ model: User, attributes: ['id', 'name', 'email', 'vehiclePlateNumber'] }]
        });
        if (!row) return res.status(404).json({ success: false, message: 'Reservation not found' });
        res.json({ success: true, data: row });
    } catch (error) {
        console.error('Get Reservation Error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

/* ─────────────────────────────────────────────────────────────────
   PUT /api/reservations/:id  — update time/plate (pending only)
───────────────────────────────────────────────────────────────── */
const updateReservation = async (req, res) => {
    try {
        const row = await Reservation.findByPk(req.params.id);
        if (!row) return res.status(404).json({ success: false, message: 'Reservation not found' });

        if (row.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'Only pending reservations can be modified' });
        }

        const { reservedFrom, reservedUntil, plateNumber } = req.body;
        if (reservedFrom) row.reservedFrom = new Date(reservedFrom);
        if (reservedUntil) row.reservedUntil = new Date(reservedUntil);
        if (plateNumber) row.plateNumber = plateNumber.toUpperCase().trim();

        await row.save();
        res.json({ success: true, message: 'Reservation updated', data: row });
    } catch (error) {
        console.error('Update Reservation Error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

/* ─────────────────────────────────────────────────────────────────
   DELETE /api/reservations/:id  — cancel (frees spot)
───────────────────────────────────────────────────────────────── */
const cancelReservation = async (req, res) => {
    try {
        const row = await Reservation.findByPk(req.params.id);
        if (!row) return res.status(404).json({ success: false, message: 'Reservation not found' });
        if (row.status === 'cancelled') {
            return res.status(400).json({ success: false, message: 'Already cancelled' });
        }

        await row.update({ status: 'cancelled' });

        // Free the spot
        const spot = await ParkingSpot.findOne({ where: { reservationId: row.id } });
        if (spot) await spot.update({ isReserved: false, reservationId: null });

        // ── Item 8: Immediately sync spot count on cancel ──
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
        console.log(`[Reservation] 📢 SYNC_SPOTS → ${liveAvailable} spots left (cancelled)`);
        sendGateCommand('SYNC_SPOTS', { spots: liveAvailable, reason: 'RESERVATION_CANCELLED' });

        res.json({ success: true, message: 'Reservation cancelled and spot freed' });
    } catch (error) {
        console.error('Cancel Reservation Error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

/* ─────────────────────────────────────────────────────────────────
   GET /api/reservations/session/:sessionId  — bill details
───────────────────────────────────────────────────────────────── */
const getSessionDetails = async (req, res) => {
    try {
        const session = await ParkingSession.findByPk(req.params.sessionId, {
            include: ['User', 'Reservation']
        });
        if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
        if (session.status !== 'completed') {
            return res.status(400).json({ success: false, message: 'Session is still active' });
        }
        res.json({
            success: true,
            data: {
                plateNumber: session.plateNumber,
                userName: session.User ? session.User.name : 'Guest',
                entryTime: session.entryTime,
                exitTime: session.exitTime,
                duration: session.duration,
                price: session.price,
                spotNumber: session.Reservation ? session.Reservation.spotNumber : 'N/A',
                status: 'Paid'
            }
        });
    } catch (error) {
        console.error('Get Session Details Error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

module.exports = {
    createReservation,
    getAllReservations,
    getUserReservations,
    getReservation,
    updateReservation,
    cancelReservation,
    getSessionDetails
};
