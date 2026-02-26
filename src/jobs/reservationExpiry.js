const cron = require('node-cron');
const { Reservation, ParkingSpot } = require('../models');
const { Op } = require('sequelize');

const startExpiryJob = () => {
    cron.schedule('*/5 * * * *', async () => {
        console.log('Running reservation expiry check...');
        try {
            const now = new Date();

            const expiredReservations = await Reservation.findAll({
                where: {
                    status: 'pending',
                    reservedUntil: { [Op.lt]: now }
                }
            });

            for (const res of expiredReservations) {
                await res.update({ status: 'expired' });

                const spot = await ParkingSpot.findOne({
                    where: {
                        spotNumber: res.spotNumber,
                        reservationId: res.id
                    }
                });

                if (spot) {
                    await spot.update({
                        isReserved: false,
                        reservationId: null
                    });
                }

                console.log(`Reservation ${res.id} for spot ${res.spotNumber} marked as expired.`);
            }
        } catch (error) {
            console.error('Error in reservation expiry job:', error);
        }
    });
};

module.exports = { startExpiryJob };
