const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ParkingSession = sequelize.define('ParkingSession', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    plateNumber: {
        type: DataTypes.STRING,
        allowNull: false
    },
    userId: {
        type: DataTypes.UUID,
        allowNull: true
    },
    entryTime: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    exitTime: {
        type: DataTypes.DATE,
        allowNull: true
    },
    duration: {
        type: DataTypes.INTEGER,
        defaultValue: 0 // in minutes
    },
    price: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    status: {
        type: DataTypes.ENUM('active', 'completed'),
        defaultValue: 'active'
    },
    reservationId: {
        type: DataTypes.UUID,
        allowNull: true
    }
});

module.exports = ParkingSession;
