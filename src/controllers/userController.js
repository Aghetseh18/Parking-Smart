const bcrypt = require('bcryptjs');
const { User, Reservation, ParkingSession } = require('../models');

/* ─────────────────────────────────────────────────────────────────
   GET /api/users            — list all users  (admin)
───────────────────────────────────────────────────────────────── */
const getAllUsers = async (req, res) => {
    try {
        const users = await User.findAll({
            attributes: { exclude: ['passwordHash'] },
            order: [['createdAt', 'DESC']]
        });
        res.json({ success: true, data: users });
    } catch (err) {
        console.error('Get All Users Error:', err);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

/* ─────────────────────────────────────────────────────────────────
   GET /api/users/:id
───────────────────────────────────────────────────────────────── */
const getUser = async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id, {
            attributes: { exclude: ['passwordHash'] },
            include: [
                { model: Reservation, as: 'Reservations' },
                { model: ParkingSession, as: 'ParkingSessions' }
            ]
        });
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        res.json({ success: true, data: user });
    } catch (err) {
        console.error('Get User Error:', err);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

/* ─────────────────────────────────────────────────────────────────
   PUT /api/users/:id  (admin only — can also change role)
───────────────────────────────────────────────────────────────── */
const updateUser = async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const { name, email, phone, vehiclePlateNumber, password, role } = req.body;
        if (name) user.name = name;
        if (email) user.email = email.toLowerCase();
        if (phone) user.phone = phone;
        if (vehiclePlateNumber) user.vehiclePlateNumber = vehiclePlateNumber.toUpperCase();
        if (role) user.role = role;
        if (password) user.passwordHash = await bcrypt.hash(password, 10);

        await user.save();
        const { passwordHash, ...safe } = user.toJSON();
        res.json({ success: true, message: 'User updated', data: safe });
    } catch (err) {
        console.error('Update User Error:', err);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

/* ─────────────────────────────────────────────────────────────────
   DELETE /api/users/:id  (admin only)
───────────────────────────────────────────────────────────────── */
const deleteUser = async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        await user.destroy();
        res.json({ success: true, message: 'User deleted' });
    } catch (err) {
        console.error('Delete User Error:', err);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

module.exports = { getAllUsers, getUser, updateUser, deleteUser };
