const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/spotController');
const { authenticate, requireAdmin } = require('../middleware/authMiddleware');

/**
 * @swagger
 * tags:
 *   name: Spots
 *   description: Parking spot CRUD + live count (ESP32/LoRa)
 */

/**
 * @swagger
 * /api/spots:
 *   get:
 *     summary: Get all parking spots with live available count
 *     tags: [Spots]
 *     responses:
 *       200:
 *         description: Array of spots + availablePlaces count
 */
router.get('/', ctrl.getAllSpots);

/**
 * @swagger
 * /api/spots/available-count:
 *   get:
 *     summary: Get live available places count (total/occupied/reserved/available)
 *     tags: [Spots]
 *     responses:
 *       200:
 *         description: Live count object from DB + sensors
 */
router.get('/available-count', ctrl.getAvailablePlaces);

/**
 * @swagger
 * /api/spots/by-id/{id}:
 *   delete:
 *     summary: Admin — remove a spot by its UUID (used by dashboard UI)
 *     tags: [Spots]
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
 *         description: Spot deleted
 */
router.delete('/by-id/:id', ctrl.deleteSpotById);


/**
 * @swagger
 * /api/spots/update:
 *   post:
 *     summary: ESP32 — report a spot's occupancy status
 *     tags: [Spots]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [spotNumber, isOccupied]
 *             properties:
 *               spotNumber:
 *                 type: integer
 *               isOccupied:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Spot updated, returns all spots + live count
 */
router.post('/update', ctrl.updateSpotStatus);

/**
 * @swagger
 * /api/spots/sync-count:
 *   post:
 *     summary: LoRa gateway — sync total available space count
 *     tags: [Spots]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [availableSpaces]
 *             properties:
 *               availableSpaces:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Sync acknowledged
 */
router.post('/sync-count', ctrl.syncCount);

/**
 * @swagger
 * /api/spots/{spotNumber}:
 *   get:
 *     summary: Get a single spot by spot number
 *     tags: [Spots]
 *     parameters:
 *       - in: path
 *         name: spotNumber
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Spot data
 */
router.get('/:spotNumber', ctrl.getSpot);

/**
 * @swagger
 * /api/spots/{spotNumber}:
 *   put:
 *     summary: Admin — manually override a spot's status
 *     tags: [Spots]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: spotNumber
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isOccupied:
 *                 type: boolean
 *               isReserved:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Spot updated
 */
router.put('/:spotNumber', ctrl.updateSpot);

/**
 * @swagger
 * /api/spots/{spotNumber}:
 *   delete:
 *     summary: Admin — remove a spot record from the database
 *     tags: [Spots]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: spotNumber
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Spot deleted
 */
router.delete('/:spotNumber', ctrl.deleteSpot);

module.exports = router;
