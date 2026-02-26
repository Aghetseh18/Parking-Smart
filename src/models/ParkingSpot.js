const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ParkingSpot = sequelize.define('ParkingSpot', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    spotNumber: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true
    },
    isOccupied: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    isReserved: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    reservationId: {
        type: DataTypes.UUID,
        allowNull: true
    },
    lastUpdated: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
});

module.exports = ParkingSpot;
