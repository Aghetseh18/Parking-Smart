const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Reservation = sequelize.define('Reservation', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    userId: {
        type: DataTypes.UUID,
        allowNull: false
    },
    // Plate number is now the key identity for gate access (no one-time code)
    plateNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        set(value) {
            this.setDataValue('plateNumber', value ? value.toUpperCase().trim() : value);
        }
    },
    spotNumber: {
        type: DataTypes.INTEGER,
        allowNull: true   // auto-assigned by server
    },
    reservedFrom: {
        type: DataTypes.DATE,
        allowNull: false
    },
    reservedUntil: {
        type: DataTypes.DATE,
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('pending', 'active', 'expired', 'cancelled'),
        defaultValue: 'pending'
    }
});

module.exports = Reservation;
