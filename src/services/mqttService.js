const mqtt = require('mqtt');
const dotenv = require('dotenv');
const { broadcast } = require('./sseService');
const { ParkingSpot, Reservation, ParkingSession } = require('../models');

dotenv.config();

const broker = process.env.MQTT_BROKER || 'mqtt://broker.emqx.io';
const clientId = process.env.MQTT_CLIENT_ID || 'parking_smart_server';

// Topics
const TOPIC_GATE_COMMAND = process.env.MQTT_TOPIC_GATE || 'parking/gate/command'; // server → ESP32
const TOPIC_GATE_STATUS = process.env.MQTT_TOPIC_STATUS || 'parking/gate/status';  // ESP32  → server

// ── Connect ────────────────────────────────────────────────────────
const client = mqtt.connect(broker, {
    clientId,
    clean: true,
    connectTimeout: 4000,
    reconnectPeriod: 1000,
});

// ── Connection events ──────────────────────────────────────────────
client.on('connect', () => {
    console.log('\n┌─── MQTT CONNECTED ────────────────────────────────────────');
    console.log(`│  Broker   : ${broker}`);
    console.log(`│  ClientID : ${clientId}`);
    console.log('└────────────────────────────────────────────────────────────\n');

    // Subscribe to the status topic so we see everything the ESP32 publishes
    client.subscribe(TOPIC_GATE_STATUS, { qos: 1 }, (err) => {
        if (err) {
            console.error(`[MQTT] ❌ Failed to subscribe to ${TOPIC_GATE_STATUS}:`, err.message);
        } else {
            console.log(`[MQTT] ✅ Subscribed to "${TOPIC_GATE_STATUS}" (ESP32 → Server)`);
        }
    });

    // Also subscribe to the command topic so we see our own publishes reflected back
    client.subscribe(TOPIC_GATE_COMMAND, { qos: 1 }, (err) => {
        if (err) {
            console.error(`[MQTT] ❌ Failed to subscribe to ${TOPIC_GATE_COMMAND}:`, err.message);
        } else {
            console.log(`[MQTT] ✅ Subscribed to "${TOPIC_GATE_COMMAND}" (Server → ESP32 echo)\n`);
        }
    });
});

client.on('error', (err) => {
    console.error('\n[MQTT] ❌ Connection Error:', err.message);
});

client.on('reconnect', () => {
    console.log('[MQTT] 🔄 Reconnecting to broker…');
});

client.on('offline', () => {
    console.log('[MQTT] ⚠️  Client is offline');
});

// ── Incoming messages from ESP32 (or echoed commands) ─────────────
client.on('message', (topic, payload) => {
    const raw = payload.toString();

    // Determine direction label
    const direction = topic === TOPIC_GATE_STATUS
        ? '⬆  ESP32 → Server'
        : '⬇  Server → ESP32 (echo)';

    console.log('\n┌─── MQTT MESSAGE RECEIVED ──────────────────────────────────');
    console.log(`│  Direction : ${direction}`);
    console.log(`│  Topic     : ${topic}`);
    console.log(`│  Raw       : ${raw}`);

    // Try to pretty-print JSON
    try {
        const json = JSON.parse(raw);
        console.log('│  Parsed    :');
        Object.entries(json).forEach(([k, v]) => {
            console.log(`│    ${k.padEnd(12)}: ${v}`);
        });

        // Highlight important ESP32 events
        if (json.event) {
            const eventMap = {
                GATE_OPENED: '✅  Gate OPENED  — servo turned',
                GATE_DENIED: '🔒  Gate DENIED  — servo stayed closed',
                GATE_DENIED_FULL: '🔒  Gate DENIED  — parking lot full',
                GATE_ONLINE: '📡  Gate came ONLINE',
                SPOTS_SYNCED: '🔄  Spot count synced from server',
                EXIT_CONFIRMED: '🚗  Car EXITED back gate — spot freed',
                SPOTS_UPDATED: '🔄  Spot count updated via LoRa heartbeat',
                ENTRY_CONFIRMED: '🚘  Entry CONFIRMED by back gate',
            };
            const note = eventMap[json.event];
            if (note) console.log(`│  ► ${note}`);
            if (json.spots !== undefined) {
                console.log(`│  ► Available spots now: ${json.spots}`);
            }

            // ── The Database is the Absolute Source of Truth ─────────────
            // Ignore the ESP32's local count (it might have reset during power loss).
            // Calculate the exact spots from PostgreSQL and force it down to the ESP32.
            const syncTriggerEvents = ['GATE_ONLINE', 'EXIT_CONFIRMED', 'SPOTS_UPDATED', 'ENTRY_CONFIRMED', 'GATE_OPENED'];
            if (syncTriggerEvents.includes(json.event)) {
                setTimeout(async () => {
                    try {
                        const maxSpots = parseInt(process.env.MAX_SPOTS) || 20;
                        const occupied = await ParkingSpot.count({ where: { isOccupied: true } });
                        const reserved = await Reservation.count({ where: { status: 'pending' } });
                        const active = await ParkingSession.count({ where: { status: 'active' } });

                        const effectiveOccupied = Math.max(occupied, active);
                        const effectiveAvailable = Math.max(0, maxSpots - effectiveOccupied - reserved);

                        console.log(`│  ► DB Truth: sending SYNC_SPOTS (${effectiveAvailable}) to fix/confirm ESP32`);
                        sendGateCommand('SYNC_SPOTS', { spots: effectiveAvailable, source: 'server_truth' });

                        // Also trigger the frontend to fetch latest stats
                        broadcast('spots_updated', {
                            event: 'SERVER_SYNC',
                            spots: effectiveAvailable,
                            timestamp: new Date().toISOString(),
                        });
                    } catch (err) {
                        console.error('│  ❌ Failed to calculate true spots:', err.message);
                    }
                }, 300); // 300ms delay ensures DB commits from the HTTP route finish first
            }

            // ── Push gate open/deny events to frontend too ───────────
            const gateEvents = ['GATE_OPENED', 'GATE_DENIED', 'GATE_DENIED_FULL'];
            if (gateEvents.includes(json.event)) {
                broadcast('gate_event', {
                    event: json.event,
                    spots: json.spots,
                    timestamp: new Date().toISOString(),
                });
            }
        }

        // Highlight server commands being sent to ESP32
        if (json.action) {
            const actionMap = {
                OPEN: '✅  Telling ENTRY gate: OPEN servo',
                DENY: '🔒  Telling ENTRY gate: STAY CLOSED',
                OPEN_EXIT: '✅  Telling EXIT gate: OPEN servo',
                DENY_EXIT: '🔒  Telling EXIT gate: STAY CLOSED',
                NO_PLATE: '📷  Telling ESP32s: no plate found — show LCD hint',
                SYNC_SPOTS: '🔢  Telling ESP32s: force update spot count',
            };
            const note = actionMap[json.action];
            if (note) console.log(`│  ► ${note}`);
        }

    } catch (_) {
        console.log('│  (not valid JSON — raw text above)');
    }
    console.log('└────────────────────────────────────────────────────────────\n');
});

// ── Publish helper (used internally) ──────────────────────────────
const publishMessage = (topic, message) => {
    const payload = JSON.stringify(message);

    if (!client.connected) {
        console.warn('[MQTT] ⚠️  Not connected — cannot publish');
        return;
    }

    console.log('\n┌─── MQTT SENDING (Server → ESP32) ─────────────────────────');
    console.log(`│  Topic     : ${topic}`);
    console.log(`│  Payload   : ${payload}`);

    client.publish(topic, payload, { qos: 1 }, (err) => {
        if (err) {
            console.error(`│  ❌ Publish FAILED: ${err.message}`);
        } else {
            console.log('│  ✅ Delivered to broker');
        }
        console.log('└────────────────────────────────────────────────────────────\n');
    });
};

// ── sendGateCommand — used by gateController ──────────────────────
const sendGateCommand = (action, metadata = {}) => {
    const payload = {
        action,
        timestamp: new Date().toISOString(),
        ...metadata,
    };
    publishMessage(TOPIC_GATE_COMMAND, payload);
};

module.exports = { publishMessage, sendGateCommand };
