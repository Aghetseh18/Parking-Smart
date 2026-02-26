const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./config/swagger');
const sequelize = require('./config/database');
const { startExpiryJob } = require('./jobs/reservationExpiry');

// Load env vars
dotenv.config();

// Routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const gateRoutes = require('./routes/gateRoutes');
const spotRoutes = require('./routes/spotRoutes');
const reservationRoutes = require('./routes/reservationRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));

// ── Routes ───────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/gate', gateRoutes);
app.use('/api/spots', spotRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Database Connection
sequelize.sync({ alter: true })
    .then(() => {
        console.log('PostgreSQL Database Connected & Synced');
        startExpiryJob();
    })
    .catch(err => {
        console.error('PostgreSQL connection error:', err);
    });

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, message: 'Internal Server Error', error: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n🚀 Parking Smart API running on http://localhost:${PORT}`);
    console.log(`📖 Swagger docs at    http://localhost:${PORT}/api-docs\n`);
});

module.exports = app;
