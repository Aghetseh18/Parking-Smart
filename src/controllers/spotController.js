const { ParkingSpot } = require('../models');

/* Shared: compute live available count */
const getAvailableCount = async () => {
    const maxSpots = parseInt(process.env.MAX_SPOTS) || 20;
    const occupiedCount = await ParkingSpot.count({ where: { isOccupied: true } });
    const reservedCount = await ParkingSpot.count({ where: { isReserved: true } });
    return Math.max(0, maxSpots - occupiedCount - reservedCount);
};

/* ─────────────────────────────────────────────────────────────────
   GET /api/spots
───────────────────────────────────────────────────────────────── */
const getAllSpots = async (req, res) => {
    try {
        const allSpots = await ParkingSpot.findAll({ order: [['spotNumber', 'ASC']] });
        const availablePlaces = await getAvailableCount();
        res.json({ success: true, data: allSpots, availablePlaces });
    } catch (error) {
        console.error('Get Spots Error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

/* ─────────────────────────────────────────────────────────────────
   GET /api/spots/available-count
   → Used by the dashboard to see live remaining places
───────────────────────────────────────────────────────────────── */
const getAvailablePlaces = async (req, res) => {
    try {
        const maxSpots = parseInt(process.env.MAX_SPOTS) || 20;
        const occupiedCount = await ParkingSpot.count({ where: { isOccupied: true } });
        const reservedCount = await ParkingSpot.count({ where: { isReserved: true } });
        const available = Math.max(0, maxSpots - occupiedCount - reservedCount);

        res.json({
            success: true,
            data: {
                total: maxSpots,
                occupied: occupiedCount,
                reserved: reservedCount,
                available
            }
        });
    } catch (error) {
        console.error('Available Count Error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

/* ─────────────────────────────────────────────────────────────────
   GET /api/spots/:spotNumber
───────────────────────────────────────────────────────────────── */
const getSpot = async (req, res) => {
    try {
        const spot = await ParkingSpot.findOne({ where: { spotNumber: req.params.spotNumber } });
        if (!spot) return res.status(404).json({ success: false, message: 'Spot not found' });
        res.json({ success: true, data: spot });
    } catch (error) {
        console.error('Get Spot Error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

/* ─────────────────────────────────────────────────────────────────
   POST /api/spots/update
   ESP32 calls this to report a spot's occupancy
   Body: { spotNumber, isOccupied }
───────────────────────────────────────────────────────────────── */
const updateSpotStatus = async (req, res) => {
    try {
        const { spotNumber, isOccupied } = req.body;
        if (spotNumber === undefined || isOccupied === undefined) {
            return res.status(400).json({ success: false, message: 'spotNumber and isOccupied are required' });
        }

        let [spot, created] = await ParkingSpot.findOrCreate({
            where: { spotNumber },
            defaults: { isOccupied, isReserved: false }
        });

        if (!created) {
            await spot.update({ isOccupied, lastUpdated: new Date() });
        }

        // Return full updated snapshot + live count
        const allSpots = await ParkingSpot.findAll({ order: [['spotNumber', 'ASC']] });
        const availablePlaces = await getAvailableCount();

        res.json({
            success: true,
            message: `Spot ${spotNumber} → ${isOccupied ? 'Occupied' : 'Free'}`,
            availablePlaces,
            data: allSpots
        });

    } catch (error) {
        console.error('Spot Update Error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

/* ─────────────────────────────────────────────────────────────────
   POST /api/spots/sync-count
   LoRa gateway sends total available space count
   Body: { availableSpaces }
───────────────────────────────────────────────────────────────── */
const syncCount = async (req, res) => {
    try {
        const { availableSpaces } = req.body;
        if (availableSpaces === undefined) {
            return res.status(400).json({ success: false, message: 'availableSpaces is required' });
        }

        console.log(`[LoRa Sync] Received available spaces from hardware: ${availableSpaces}`);

        // Store as override in a synthetic "virtual" spot entry
        // (you can persist this in a Settings table later if needed)
        res.json({
            success: true,
            message: 'Sync received',
            data: { availableSpaces }
        });

    } catch (error) {
        console.error('Sync Count Error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

/* ─────────────────────────────────────────────────────────────────
   PUT /api/spots/:spotNumber   — admin manual override
───────────────────────────────────────────────────────────────── */
const updateSpot = async (req, res) => {
    try {
        const spot = await ParkingSpot.findOne({ where: { spotNumber: req.params.spotNumber } });
        if (!spot) return res.status(404).json({ success: false, message: 'Spot not found' });

        const { isOccupied, isReserved } = req.body;
        if (isOccupied !== undefined) spot.isOccupied = isOccupied;
        if (isReserved !== undefined) spot.isReserved = isReserved;
        spot.lastUpdated = new Date();
        await spot.save();

        const availablePlaces = await getAvailableCount();
        res.json({ success: true, message: 'Spot updated', availablePlaces, data: spot });
    } catch (error) {
        console.error('Update Spot Error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

/* ─────────────────────────────────────────────────────────────────
   DELETE /api/spots/:spotNumber  — admin remove spot record
───────────────────────────────────────────────────────────────── */
const deleteSpot = async (req, res) => {
    try {
        const spot = await ParkingSpot.findOne({ where: { spotNumber: req.params.spotNumber } });
        if (!spot) return res.status(404).json({ success: false, message: 'Spot not found' });
        await spot.destroy();
        res.json({ success: true, message: `Spot ${req.params.spotNumber} removed` });
    } catch (error) {
        console.error('Delete Spot Error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

/* ─────────────────────────────────────────────────────────────────
   DELETE /api/spots/by-id/:id  — admin remove spot by UUID
   Used by the Parking Map dashboard UI
───────────────────────────────────────────────────────────────── */
const deleteSpotById = async (req, res) => {
    try {
        const spot = await ParkingSpot.findByPk(req.params.id);
        if (!spot) return res.status(404).json({ success: false, message: 'Spot not found' });
        await spot.destroy();
        res.json({ success: true, message: `Spot #${spot.spotNumber} removed` });
    } catch (error) {
        console.error('Delete Spot By ID Error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

module.exports = {
    getAllSpots,
    getAvailablePlaces,
    getSpot,
    updateSpotStatus,
    syncCount,
    updateSpot,
    deleteSpot,
    deleteSpotById
};
