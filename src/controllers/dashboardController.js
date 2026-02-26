const { ParkingSession, Transaction, ParkingSpot, Reservation, User } = require('../models');
const { Op } = require('sequelize');

/* ─────────────────────────────────────────────────────────────
   SESSIONS
───────────────────────────────────────────────────────────── */
const getActiveSessions = async (req, res) => {
    try {
        const sessions = await ParkingSession.findAll({
            where: { status: 'active' },
            include: [{ model: User, attributes: ['id', 'name', 'email', 'vehiclePlateNumber'] }],
            order: [['entryTime', 'DESC']]
        });
        res.json({ success: true, data: sessions });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

const getSessionHistory = async (req, res) => {
    try {
        const sessions = await ParkingSession.findAll({
            where: { status: 'completed' },
            include: [{ model: User, attributes: ['id', 'name', 'email', 'vehiclePlateNumber'] }],
            order: [['exitTime', 'DESC']]
        });
        res.json({ success: true, data: sessions });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

const getSession = async (req, res) => {
    try {
        const session = await ParkingSession.findByPk(req.params.id, {
            include: [
                { model: User, attributes: ['id', 'name', 'email', 'vehiclePlateNumber'] },
                { model: Reservation }
            ]
        });
        if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
        res.json({ success: true, data: session });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

/* Admin: manually close a stuck session */
const updateSession = async (req, res) => {
    try {
        const session = await ParkingSession.findByPk(req.params.id);
        if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

        const { status, exitTime, duration, price } = req.body;
        if (status) session.status = status;
        if (exitTime) session.exitTime = new Date(exitTime);
        if (duration !== undefined) session.duration = duration;
        if (price !== undefined) session.price = price;
        await session.save();

        res.json({ success: true, message: 'Session updated', data: session });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

const deleteSession = async (req, res) => {
    try {
        const session = await ParkingSession.findByPk(req.params.id);
        if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
        await session.destroy();
        res.json({ success: true, message: 'Session deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

/* Sessions for a specific user — queried by userId param */
const getSessionsByUser = async (req, res) => {
    try {
        const sessions = await ParkingSession.findAll({
            where: { userId: req.params.userId },
            include: [{ model: User, attributes: ['id', 'name', 'email', 'vehiclePlateNumber'] }],
            order: [['entryTime', 'DESC']]
        });
        res.json({ success: true, data: sessions });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};


/* ─────────────────────────────────────────────────────────────
   TRANSACTIONS
───────────────────────────────────────────────────────────── */
const getTransactions = async (req, res) => {
    try {
        const transactions = await Transaction.findAll({
            include: [{ model: User, attributes: ['id', 'name', 'email'] }],
            order: [['createdAt', 'DESC']]
        });
        res.json({ success: true, data: transactions });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

const getTransaction = async (req, res) => {
    try {
        const tx = await Transaction.findByPk(req.params.id, {
            include: [{ model: User, attributes: ['id', 'name', 'email'] }]
        });
        if (!tx) return res.status(404).json({ success: false, message: 'Transaction not found' });
        res.json({ success: true, data: tx });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

const deleteTransaction = async (req, res) => {
    try {
        const tx = await Transaction.findByPk(req.params.id);
        if (!tx) return res.status(404).json({ success: false, message: 'Transaction not found' });
        await tx.destroy();
        res.json({ success: true, message: 'Transaction deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

/* Transactions for a specific user */
const getTransactionsByUser = async (req, res) => {
    try {
        const txs = await Transaction.findAll({
            where: { userId: req.params.userId },
            include: [{ model: User, attributes: ['id', 'name', 'email'] }],
            order: [['createdAt', 'DESC']]
        });
        res.json({ success: true, data: txs });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};


/* ─────────────────────────────────────────────────────────────
   DASHBOARD STATS
   Reads live spot count from DB rows (updated by ESP32),
   so the UI always reflects real sensor data.
───────────────────────────────────────────────────────────────  */
const getStats = async (req, res) => {
    try {
        const maxSpots = parseInt(process.env.MAX_SPOTS) || 20;

        // Sensor-driven counts from ParkingSpot rows
        const occupiedSpotsCount = await ParkingSpot.count({ where: { isOccupied: true } });
        const reservedSpotsCount = await Reservation.count({ where: { status: 'pending' } });

        // Fallback: count active sessions if no sensor data yet
        const activeSessionCount = await ParkingSession.count({ where: { status: 'active' } });

        // Use whichever is higher (sensor vs session) for occupied
        const effectiveOccupied = Math.max(occupiedSpotsCount, activeSessionCount);
        const effectiveAvailable = Math.max(0, maxSpots - effectiveOccupied - reservedSpotsCount);

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const totalRevenueToday = await Transaction.sum('amount', {
            where: { createdAt: { [Op.gte]: startOfDay } }
        }) || 0;

        const totalRevenue = await Transaction.sum('amount') || 0;

        res.json({
            success: true,
            data: {
                totalSpots: maxSpots,
                occupiedSpots: effectiveOccupied,
                reservedSpots: reservedSpotsCount,
                availableSpots: effectiveAvailable,
                revenueToday: totalRevenueToday,
                totalRevenue,
                lastUpdated: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Stats Error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

module.exports = {
    getActiveSessions,
    getSessionHistory,
    getSession,
    updateSession,
    deleteSession,
    getSessionsByUser,
    getTransactions,
    getTransaction,
    deleteTransaction,
    getTransactionsByUser,
    getStats
};

