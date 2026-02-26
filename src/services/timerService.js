/**
 * In-memory session timers
 * Key: plateNumber
 * Value: { startTime, intervalId }
 * 
 * Note: These are for prototype purposes. 
 * Real-world systems should rely on DB timestamps.
 */
const activeSessions = new Map();

const startTimer = (plateNumber) => {
    if (activeSessions.has(plateNumber)) {
        console.warn(`Session already exists for plate: ${plateNumber}`);
        return;
    }

    const startTime = new Date();
    activeSessions.set(plateNumber, {
        startTime,
        intervalId: null // We could add a callback here if needed
    });

    console.log(`Timer started for ${plateNumber} at ${startTime}`);
};

const stopTimer = (plateNumber) => {
    const session = activeSessions.get(plateNumber);
    if (!session) {
        console.error(`No active session found for plate: ${plateNumber}`);
        return null;
    }

    const endTime = new Date();
    const durationMs = endTime - session.startTime;
    const durationMinutes = Math.ceil(durationMs / (1000 * 60));

    activeSessions.delete(plateNumber);

    console.log(`Timer stopped for ${plateNumber}. Duration: ${durationMinutes} mins`);
    return durationMinutes;
};

const getActiveSession = (plateNumber) => {
    return activeSessions.get(plateNumber);
};

module.exports = {
    startTimer,
    stopTimer,
    getActiveSession
};
