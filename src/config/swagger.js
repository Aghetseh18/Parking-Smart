const swaggerJsdoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Smart Parking System API',
            version: '1.0.0',
            description: 'API documentation for the Smart Parking System (Node.js/Postgres)',
        },
        servers: [
            {
                url: 'http://localhost:3000',
                description: 'Local server',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT'
                }
            },
            schemas: {
                User: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        name: { type: 'string' },
                        email: { type: 'string', format: 'email' },
                        phone: { type: 'string' },
                        vehiclePlateNumber: { type: 'string' },
                        role: { type: 'string', enum: ['user', 'admin'] }
                    }
                },
                ParkingSpot: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        spotNumber: { type: 'integer' },
                        isOccupied: { type: 'boolean' },
                        isReserved: { type: 'boolean' },
                        lastUpdated: { type: 'string', format: 'date-time' }
                    }
                },
                Reservation: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        userId: { type: 'string', format: 'uuid' },
                        spotNumber: { type: 'integer', description: 'Auto-assigned by server' },
                        reservedFrom: { type: 'string', format: 'date-time' },
                        reservedUntil: { type: 'string', format: 'date-time' },
                        status: { type: 'string', enum: ['pending', 'active', 'expired', 'cancelled'] },
                        oneTimeCode: { type: 'string' },
                        codeUsed: { type: 'boolean' }
                    }
                }
            }
        }

    },

    apis: ['./src/routes/*.js'], // Path to the API docs
};

const specs = swaggerJsdoc(options);

module.exports = specs;
