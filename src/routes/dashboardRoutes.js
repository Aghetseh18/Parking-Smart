const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/dashboardController');
const { authenticate, requireAdmin } = require('../middleware/authMiddleware');
const { sseHandler } = require('../services/sseService');

// ── SSE — Real-time push to frontend ────────────────────────────────
// Frontend connects: new EventSource('/api/dashboard/live')
// Server pushes:     broadcast('spots_updated', { spots: N })
router.get('/live', sseHandler);

/**
 * @swagger
 * tags:
 *   name: Dashboard
 *   description: Admin stats, sessions and transactions (CRUD)
 */

// ── Stats ──────────────────────────────────────────────────────
/**
 * @swagger
 * /api/dashboard/stats:
 *   get:
 *     summary: Global stats — spots, revenue, sensor data
 *     tags: [Dashboard]
 *     responses:
 *       200:
 *         description: Stats object
 */
router.get('/stats', ctrl.getStats);

// ── Sessions ────────────────────────────────────────────────────
/**
 * @swagger
 * /api/dashboard/sessions/active:
 *   get:
 *     summary: Get all active sessions
 *     tags: [Dashboard]
 *     responses:
 *       200:
 *         description: List of active sessions
 */
router.get('/sessions/active', ctrl.getActiveSessions);

/**
 * @swagger
 * /api/dashboard/sessions/history:
 *   get:
 *     summary: Get all completed sessions
 *     tags: [Dashboard]
 *     responses:
 *       200:
 *         description: Session history
 */
router.get('/sessions/history', ctrl.getSessionHistory);

/**
 * @swagger
 * /api/dashboard/sessions/{id}:
 *   get:
 *     summary: Get a single session by ID
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Session data
 */
router.get('/sessions/:id', ctrl.getSession);

/**
 * @swagger
 * /api/dashboard/sessions/{id}:
 *   put:
 *     summary: Admin — manually close or update a session
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, completed]
 *               exitTime:
 *                 type: string
 *                 format: date-time
 *               duration:
 *                 type: integer
 *               price:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Session updated
 */
router.put('/sessions/:id', ctrl.updateSession);

/**
 * @swagger
 * /api/dashboard/sessions/{id}:
 *   delete:
 *     summary: Admin — delete a session record
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Session deleted
 */
router.delete('/sessions/:id', ctrl.deleteSession);
router.get('/sessions/user/:userId', ctrl.getSessionsByUser);


// ── Transactions ─────────────────────────────────────────────────
/**
 * @swagger
 * /api/dashboard/transactions:
 *   get:
 *     summary: Get all transactions
 *     tags: [Dashboard]
 *     responses:
 *       200:
 *         description: Transaction list
 */
router.get('/transactions', ctrl.getTransactions);

/**
 * @swagger
 * /api/dashboard/transactions/{id}:
 *   get:
 *     summary: Get a single transaction by ID
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Transaction data
 */
router.get('/transactions/:id', ctrl.getTransaction);

/**
 * @swagger
 * /api/dashboard/transactions/{id}:
 *   delete:
 *     summary: Admin — delete a transaction record
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Transaction deleted
 */
router.delete('/transactions/:id', ctrl.deleteTransaction);
router.get('/transactions/user/:userId', ctrl.getTransactionsByUser);

module.exports = router;

