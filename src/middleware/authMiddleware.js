const jwt = require('jsonwebtoken');
const { User } = require('../models');

/**
 * Verify JWT token from Authorization header.
 * Attaches req.user on success.
 */
const authenticate = async (req, res, next) => {
    try {
        const header = req.headers['authorization'];
        if (!header || !header.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'No token provided' });
        }

        const token = header.slice(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findByPk(decoded.id);
        if (!user) {
            return res.status(401).json({ success: false, message: 'User not found' });
        }

        req.user = user;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
};

/**
 * Restrict to admins only.
 * Must be used after `authenticate`.
 */
const requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    next();
};

module.exports = { authenticate, requireAdmin };
