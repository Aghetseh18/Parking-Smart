const express = require('express');
const router = express.Router();
const { handleEntryCapture, handleExitCapture, checkPlate } = require('../controllers/gateController');
const upload = require('../middleware/upload');

/**
 * @swagger
 * tags:
 *   name: Gate
 *   description: ESP32-CAM plate-based gate control (no codes)
 */

/**
 * @swagger
 * /api/gate/entry/capture:
 *   post:
 *     summary: ESP32 front gate — snap plate image, check reservation, open gate
 *     description: |
 *       OCR reads the plate. If the plate has an active reservation in the current
 *       time window the gate opens as RESERVATION. Otherwise it opens as GUEST.
 *     tags: [Gate]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: OPEN_GATE or DO_NOTHING with type (RESERVATION | GUEST)
 */
router.post('/entry/capture', upload.single('image'), handleEntryCapture);

/**
 * @swagger
 * /api/gate/exit/capture:
 *   post:
 *     summary: ESP32 back gate — snap plate image, end session, open gate
 *     tags: [Gate]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: OPEN_GATE or DO_NOTHING with price and duration
 */
router.post('/exit/capture', upload.single('image'), handleExitCapture);

/**
 * @swagger
 * /api/gate/check-plate:
 *   post:
 *     summary: Admin / kiosk — check if a plate has a valid current reservation
 *     tags: [Gate]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [plateNumber]
 *             properties:
 *               plateNumber:
 *                 type: string
 *                 example: ABC123
 *     responses:
 *       200:
 *         description: Reservation status for the plate
 */
router.post('/check-plate', checkPlate);

module.exports = router;
