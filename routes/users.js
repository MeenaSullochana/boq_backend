import express from 'express';
import User from '../models/User.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect, authorize('superadmin'));

router.get('/', async (req, res) => {
  try {
    const { q, role, page, limit } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (q) {
      filter.$or = [
        { name: new RegExp(q, 'i') },
        { email: new RegExp(q, 'i') },
        { phone: new RegExp(q, 'i') },
      ];
    }

    if (page !== undefined) {
      const pageNum = Math.max(1, Number(page) || 1);
      const lim = Math.min(100, Math.max(1, Number(limit) || 10));
      const skip = (pageNum - 1) * lim;
      const [items, total] = await Promise.all([
        User.find(filter).select('-password').sort({ createdAt: -1 }).skip(skip).limit(lim),
        User.countDocuments(filter),
      ]);
      return res.json({
        items,
        total,
        page: pageNum,
        pages: Math.ceil(total / lim) || 1,
      });
    }

    const users = await User.find(filter).select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password required' });
    }
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(400).json({ message: 'Email already registered' });

    const user = await User.create({
      name,
      email,
      password,
      role: role === 'superadmin' ? 'superadmin' : 'staff',
      phone: phone || '',
    });
    res.status(201).json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      isActive: user.isActive,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const { name, email, password, role, phone, isActive } = req.body;
    if (name) user.name = name;
    if (email) user.email = email.toLowerCase();
    if (role) user.role = role;
    if (phone !== undefined) user.phone = phone;
    if (isActive !== undefined) user.isActive = isActive;
    if (password) user.password = password;

    await user.save();
    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      isActive: user.isActive,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  if (String(req.user._id) === req.params.id) {
    return res.status(400).json({ message: 'Cannot delete your own account' });
  }
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json({ message: 'User deleted' });
});

export default router;
