import express from 'express';
import BOQ from '../models/BOQ.js';
import { protect, authorize } from '../middleware/auth.js';
import { buildBoqPdf } from '../utils/boqPdf.js';
import { buildBoqExcel } from '../utils/boqExcel.js';
import { calcLineItem, resolveFormulaType } from '../utils/boqFormula.js';

const router = express.Router();

router.use(protect);

const calcTotals = (items = [], discount = 0, applyGst = false, gstPercent = 18) => {
  const subtotal = items
    .filter((i) => !i.isSectionHeader)
    .reduce((sum, i) => sum + Number(i.amount || 0), 0);
  const disc = Number(discount) || 0;
  const totalWithoutGst = Math.max(0, subtotal - disc);
  const percent = Number(gstPercent) || 18;
  const gstAmount = applyGst ? (totalWithoutGst * percent) / 100 : 0;
  const grandTotal = totalWithoutGst + gstAmount;
  return {
    subtotal,
    discount: disc,
    totalWithoutGst,
    applyGst: Boolean(applyGst),
    gstExtra: Boolean(applyGst),
    gstPercent: percent,
    gstAmount: Math.round(gstAmount * 100) / 100,
    grandTotal: Math.round(grandTotal * 100) / 100,
  };
};

const toObjectIdOrNull = (value) => {
  if (value == null || value === '' || value === 'undefined' || value === 'null') return null;
  return value;
};

const normalizeItems = (items = []) =>
  items.map((item, idx) => {
    if (item.isSectionHeader) {
      return {
        ...item,
        product: undefined,
        categoryId: toObjectIdOrNull(item.categoryId),
        specification: item.specification || item.categoryLabel || 'Section',
        image: '',
        rate: 0,
        amount: 0,
        width: 0,
        height: 0,
        depth: 0,
        formulaType: 'none',
        nos: 1,
        quantity: 1,
        qty: 0,
        sortOrder: idx,
      };
    }
    const formulaType = resolveFormulaType(item, null, { preferItem: true });
    const calc = calcLineItem({ ...item, formulaType });
    return {
      ...item,
      product: toObjectIdOrNull(item.product),
      categoryId: toObjectIdOrNull(item.categoryId),
      image: item.image || '',
      formulaType: calc.formulaType,
      width: calc.width,
      height: calc.height,
      depth: calc.depth,
      nos: 1,
      quantity: calc.quantity,
      qty: calc.qty,
      rate: calc.rate,
      amount: calc.amount,
      sortOrder: idx,
    };
  });

router.get('/', async (req, res) => {
  try {
    const { month, year, q, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (req.user.role === 'staff') {
      filter.createdBy = req.user._id;
    }

    if (month && year) {
      const m = Number(month) - 1;
      const y = Number(year);
      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 1);
      filter.createdAt = { $gte: start, $lt: end };
    } else if (year) {
      const y = Number(year);
      filter.createdAt = { $gte: new Date(y, 0, 1), $lt: new Date(y + 1, 0, 1) };
    }

    if (q) {
      filter.$or = [
        { clientName: new RegExp(q, 'i') },
        { billNo: new RegExp(q, 'i') },
        { location: new RegExp(q, 'i') },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      BOQ.find(filter)
        .populate('createdBy', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      BOQ.countDocuments(filter),
    ]);

    res.json({ items, total, page: Number(page), pages: Math.ceil(total / Number(limit) || 1) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  const boq = await BOQ.findById(req.params.id).populate('createdBy', 'name email role');
  if (!boq) return res.status(404).json({ message: 'BOQ not found' });
  if (req.user.role === 'staff' && String(boq.createdBy._id || boq.createdBy) !== String(req.user._id)) {
    return res.status(403).json({ message: 'Access denied' });
  }
  res.json(boq);
});

router.post('/', authorize('superadmin', 'staff'), async (req, res) => {
  try {
    const {
      title,
      clientName,
      location,
      kindAttn,
      billDate,
      items,
      discount,
      gstPercent,
      applyGst,
      gstExtra,
      notes,
      paymentTerms,
      status,
    } = req.body;

    if (!clientName) return res.status(400).json({ message: 'Client name required' });
    if (!items?.length) return res.status(400).json({ message: 'Add at least one line item' });

    const normalized = normalizeItems(items);
    const shouldApplyGst = applyGst === true || applyGst === 'true' || gstExtra === true || gstExtra === 'true';
    const totals = calcTotals(normalized, discount, shouldApplyGst, gstPercent ?? 18);

    const boq = await BOQ.create({
      title: title || 'FESTON INTERIOR WORKS COSTING',
      clientName,
      location: location || '',
      kindAttn: kindAttn || '',
      billDate: billDate || new Date(),
      items: normalized,
      ...totals,
      notes,
      paymentTerms,
      status: status || 'final',
      createdBy: req.user._id,
    });

    res.status(201).json(boq);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', authorize('superadmin'), async (req, res) => {
  try {
    const boq = await BOQ.findById(req.params.id);
    if (!boq) return res.status(404).json({ message: 'BOQ not found' });

    const fields = [
      'title',
      'clientName',
      'location',
      'kindAttn',
      'billDate',
      'notes',
      'paymentTerms',
      'status',
    ];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) boq[f] = req.body[f];
    });

    if (req.body.items) {
      boq.items = normalizeItems(req.body.items);
    }

    const shouldApplyGst =
      req.body.applyGst !== undefined
        ? req.body.applyGst === true || req.body.applyGst === 'true'
        : req.body.gstExtra !== undefined
          ? req.body.gstExtra === true || req.body.gstExtra === 'true'
          : boq.applyGst;
    const gstPercent = req.body.gstPercent ?? boq.gstPercent ?? 18;
    const totals = calcTotals(boq.items, req.body.discount ?? boq.discount, shouldApplyGst, gstPercent);
    Object.assign(boq, totals);

    await boq.save();
    res.json(boq);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', authorize('superadmin'), async (req, res) => {
  const boq = await BOQ.findByIdAndDelete(req.params.id);
  if (!boq) return res.status(404).json({ message: 'BOQ not found' });
  res.json({ message: 'BOQ deleted' });
});

router.get('/:id/pdf', async (req, res) => {
  try {
    const boq = await BOQ.findById(req.params.id);
    if (!boq) return res.status(404).json({ message: 'BOQ not found' });
    if (req.user.role === 'staff' && String(boq.createdBy) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    buildBoqPdf(boq, res);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id/excel', async (req, res) => {
  try {
    const boq = await BOQ.findById(req.params.id);
    if (!boq) return res.status(404).json({ message: 'BOQ not found' });
    if (req.user.role === 'staff' && String(boq.createdBy) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    await buildBoqExcel(boq, res);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
