const User = require('./User');
const ParkingSession = require('./ParkingSession');
const Reservation = require('./Reservation');
const ParkingSpot = require('./ParkingSpot');
const Transaction = require('./Transaction');

// Associations
User.hasMany(ParkingSession, { foreignKey: 'userId' });
ParkingSession.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Reservation, { foreignKey: 'userId' });
Reservation.belongsTo(User, { foreignKey: 'userId' });

Reservation.hasOne(ParkingSession, { foreignKey: 'reservationId' });
ParkingSession.belongsTo(Reservation, { foreignKey: 'reservationId' });

Reservation.hasOne(ParkingSpot, { foreignKey: 'reservationId' });
ParkingSpot.belongsTo(Reservation, { foreignKey: 'reservationId' });

ParkingSession.hasOne(Transaction, { foreignKey: 'sessionId' });
Transaction.belongsTo(ParkingSession, { foreignKey: 'sessionId' });

User.hasMany(Transaction, { foreignKey: 'userId' });
Transaction.belongsTo(User, { foreignKey: 'userId' });

module.exports = {
    User,
    ParkingSession,
    Reservation,
    ParkingSpot,
    Transaction
};
