import express from 'express';
import BOQ from '../models/BOQ.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import User from '../models/User.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/stats', async (req, res) => {
  try {
    const isAdmin = req.user.role === 'superadmin';
    const boqFilter = isAdmin ? {} : { createdBy: req.user._id };

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [
      totalBoq,
      monthBoq,
      products,
      categories,
      staffCount,
      monthAgg,
      yearly,
      recent,
    ] = await Promise.all([
      BOQ.countDocuments(boqFilter),
      BOQ.countDocuments({ ...boqFilter, createdAt: { $gte: monthStart, $lt: monthEnd } }),
      isAdmin ? Product.countDocuments() : Promise.resolve(null),
      isAdmin ? Category.countDocuments() : Promise.resolve(null),
      isAdmin ? User.countDocuments({ role: 'staff' }) : Promise.resolve(null),
      BOQ.aggregate([
        { $match: { ...boqFilter, createdAt: { $gte: monthStart, $lt: monthEnd } } },
        {
          $group: {
            _id: null,
            revenue: { $sum: '$totalWithoutGst' },
            count: { $sum: 1 },
          },
        },
      ]),
      BOQ.aggregate([
        {
          $match: {
            ...boqFilter,
            createdAt: { $gte: new Date(now.getFullYear(), 0, 1) },
          },
        },
        {
          $group: {
            _id: { $month: '$createdAt' },
            total: { $sum: '$totalWithoutGst' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      BOQ.find(boqFilter)
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 })
        .limit(8)
        .select('billNo clientName location totalWithoutGst createdAt createdBy'),
    ]);

    const months = Array.from({ length: 12 }, (_, i) => {
      const found = yearly.find((y) => y._id === i + 1);
      return {
        month: i + 1,
        label: new Date(2000, i, 1).toLocaleString('en', { month: 'short' }),
        total: found?.total || 0,
        count: found?.count || 0,
      };
    });

    res.json({
      totalBoq,
      monthBoq,
      monthRevenue: monthAgg[0]?.revenue || 0,
      products,
      categories,
      staffCount,
      monthlyChart: months,
      recent,
      role: req.user.role,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/export', authorize('superadmin', 'staff'), async (req, res) => {
  try {
    const { month, year } = req.query;
    const filter = req.user.role === 'staff' ? { createdBy: req.user._id } : {};

    if (month && year) {
      const m = Number(month) - 1;
      const y = Number(year);
      filter.createdAt = { $gte: new Date(y, m, 1), $lt: new Date(y, m + 1, 1) };
    }

    const list = await BOQ.find(filter)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    res.json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
