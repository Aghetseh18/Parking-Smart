// ──────────────────────────────────────────────────────────────────
//  SSE Service — Server-Sent Events broadcaster
//
//  Usage (server-side):
//    const { broadcast } = require('./sseService');
//    broadcast('spots_updated', { spots: 18 });
//
//  Usage (frontend):
//    const es = new EventSource('http://localhost:3000/api/dashboard/live');
//    es.addEventListener('spots_updated', e => refresh());
//    es.addEventListener('gate_event',    e => refresh());
// ──────────────────────────────────────────────────────────────────

/** @type {Set<import('express').Response>} */
const clients = new Set();

/**
 * Express route handler — keep the SSE connection alive.
 * Mount at:  GET /api/dashboard/live
 */
const sseHandler = (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');   // disable nginx buffering if any
    res.flushHeaders();

    // Welcome ping
    res.write(`event: connected\ndata: ${JSON.stringify({ message: 'SSE connected' })}\n\n`);

    clients.add(res);
    console.log(`[SSE] Client connected — total: ${clients.size}`);

    // Heartbeat every 25 s to keep proxy connections alive
    const heartbeat = setInterval(() => {
        res.write(': heartbeat\n\n');
    }, 25000);

    req.on('close', () => {
        clearInterval(heartbeat);
        clients.delete(res);
        console.log(`[SSE] Client disconnected — total: ${clients.size}`);
    });
};

/**
 * Push an event to all connected SSE clients.
 * @param {string} event  - Event name (e.g. 'spots_updated', 'gate_event')
 * @param {object} data   - JSON payload
 */
const broadcast = (event, data = {}) => {
    if (clients.size === 0) return;

    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    let dead = 0;

    clients.forEach(res => {
        try {
            res.write(payload);
        } catch (_) {
            clients.delete(res);
            dead++;
        }
    });

    console.log(`[SSE] Broadcast "${event}" → ${clients.size} client(s)${dead ? ` (${dead} dead removed)` : ''}`);
};

module.exports = { sseHandler, broadcast };
