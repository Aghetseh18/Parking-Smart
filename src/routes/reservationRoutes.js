const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/reservationController');
// Auth middleware kept but NOT applied yet — no login UI
// Re-add authenticate / requireAdmin once login is fully implemented

/**
 * @swagger
 * tags:
 *   name: Reservations
 *   description: Parking reservation CRUD (spot auto-assigned, gate opens by plate scan)
 */

/**
 * @swagger
 * /api/reservations:
 *   post:
 *     summary: Create a new reservation (plateNumber required, spot auto-assigned)
 *     tags: [Reservations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, plateNumber, reservedFrom, reservedUntil]
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *               plateNumber:
 *                 type: string
 *                 example: ABC123
 *               reservedFrom:
 *                 type: string
 *                 format: date-time
 *               reservedUntil:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Reservation created with auto-assigned spot number
 *       400:
 *         description: Parking full or invalid time range
 *       409:
 *         description: Plate already has a reservation in that window
 */
router.post('/', ctrl.createReservation);

/**
 * @swagger
 * /api/reservations:
 *   get:
 *     summary: Get all reservations
 *     tags: [Reservations]
 *     responses:
 *       200:
 *         description: List of all reservations
 */
router.get('/', ctrl.getAllReservations);

/**
 * @swagger
 * /api/reservations/user/{userId}:
 *   get:
 *     summary: Get all reservations for a specific user
 *     tags: [Reservations]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: List of user reservations
 */
router.get('/user/:userId', ctrl.getUserReservations);

/**
 * @swagger
 * /api/reservations/session/{sessionId}:
 *   get:
 *     summary: Get bill details for a completed session
 *     tags: [Reservations]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Bill details
 */
router.get('/session/:sessionId', ctrl.getSessionDetails);

/**
 * @swagger
 * /api/reservations/{id}:
 *   get:
 *     summary: Get a single reservation by ID
 *     tags: [Reservations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Reservation data
 */
router.get('/:id', ctrl.getReservation);

/**
 * @swagger
 * /api/reservations/{id}:
 *   put:
 *     summary: Update a pending reservation's time window or plate
 *     tags: [Reservations]
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
 *               reservedFrom:
 *                 type: string
 *                 format: date-time
 *               reservedUntil:
 *                 type: string
 *                 format: date-time
 *               plateNumber:
 *                 type: string
 *     responses:
 *       200:
 *         description: Reservation updated
 */
router.put('/:id', ctrl.updateReservation);

/**
 * @swagger
 * /api/reservations/{id}:
 *   delete:
 *     summary: Cancel a reservation (frees the spot)
 *     tags: [Reservations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Reservation cancelled and spot freed
 */
router.delete('/:id', ctrl.cancelReservation);

module.exports = router;
