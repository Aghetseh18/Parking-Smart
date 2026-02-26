const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');

const SALT_ROUNDS = 10;

/* ─────────────────────────────────────────────────────────────────
   POST /api/auth/register
   Body: { name, email, phone, vehiclePlateNumber, password, role? }
───────────────────────────────────────────────────────────────── */
const register = async (req, res) => {
    try {
        const { name, email, phone, vehiclePlateNumber, password, role } = req.body;

        if (!name || !email || !phone || !vehiclePlateNumber || !password) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }

        const existing = await User.findOne({ where: { email } });
        if (existing) {
            return res.status(409).json({ success: false, message: 'Email already registered' });
        }

        const plateTaken = await User.findOne({ where: { vehiclePlateNumber: vehiclePlateNumber.toUpperCase() } });
        if (plateTaken) {
            return res.status(409).json({ success: false, message: 'Plate number already registered' });
        }

        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        const user = await User.create({
            name,
            email: email.toLowerCase(),
            phone,
            vehiclePlateNumber: vehiclePlateNumber.toUpperCase(),
            passwordHash,
            role: role === 'admin' ? 'admin' : 'user'   // only explicitly set admin
        });

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        res.status(201).json({
            success: true,
            message: 'Registration successful',
            data: {
                token,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    vehiclePlateNumber: user.vehiclePlateNumber,
                    role: user.role
                }
            }
        });

    } catch (error) {
        console.error('Register Error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

/* ─────────────────────────────────────────────────────────────────
   POST /api/auth/login
   Body: { email, password }
───────────────────────────────────────────────────────────────── */
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required' });
        }

        const user = await User.findOne({ where: { email: email.toLowerCase() } });
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const match = await bcrypt.compare(password, user.passwordHash);
        if (!match) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        res.json({
            success: true,
            message: 'Login successful',
            data: {
                token,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    vehiclePlateNumber: user.vehiclePlateNumber,
                    role: user.role
                }
            }
        });

    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

/* ─────────────────────────────────────────────────────────────────
   GET /api/auth/me   (requires Bearer token)
───────────────────────────────────────────────────────────────── */
const getMe = async (req, res) => {
    const { passwordHash, ...safe } = req.user.toJSON();
    res.json({ success: true, data: safe });
};

/* ─────────────────────────────────────────────────────────────────
   PUT /api/auth/me   (requires Bearer token)
   Body: { name?, phone?, vehiclePlateNumber?, currentPassword?, newPassword? }
───────────────────────────────────────────────────────────────── */
const updateMe = async (req, res) => {
    try {
        const { name, phone, vehiclePlateNumber, currentPassword, newPassword } = req.body;
        const user = req.user;

        if (newPassword) {
            if (!currentPassword) {
                return res.status(400).json({ success: false, message: 'Current password required to set a new password' });
            }
            const match = await bcrypt.compare(currentPassword, user.passwordHash);
            if (!match) {
                return res.status(401).json({ success: false, message: 'Current password is incorrect' });
            }
            user.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
        }

        if (name) user.name = name;
        if (phone) user.phone = phone;
        if (vehiclePlateNumber) {
            const plateTaken = await User.findOne({
                where: { vehiclePlateNumber: vehiclePlateNumber.toUpperCase() }
            });
            if (plateTaken && plateTaken.id !== user.id) {
                return res.status(409).json({ success: false, message: 'Plate number already in use' });
            }
            user.vehiclePlateNumber = vehiclePlateNumber.toUpperCase();
        }

        await user.save();

        const { passwordHash, ...safe } = user.toJSON();
        res.json({ success: true, message: 'Profile updated', data: safe });

    } catch (error) {
        console.error('Update Me Error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

module.exports = { register, login, getMe, updateMe };
