import express from 'express';
import XLSX from 'xlsx';
import Category from '../models/Category.js';
import { protect, authorize } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

router.use(protect);

router.get('/', async (req, res) => {
  try {
    const { type, parent, tree, q, page, limit, formulaType } = req.query;
    if (tree === '1' || tree === 'true') {
      const all = await Category.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).lean();
      const categories = all.filter((c) => c.type === 'category');
      const mapChildren = (parentId, childType) =>
        all
          .filter((c) => c.type === childType && String(c.parent) === String(parentId))
          .map((c) => ({
            ...c,
            children:
              childType === 'subcategory'
                ? mapChildren(c._id, 'child')
                : undefined,
          }));

      const data = categories.map((cat) => ({
        ...cat,
        children: mapChildren(cat._id, 'subcategory'),
      }));
      return res.json(data);
    }

    const filter = {};
    if (type) filter.type = type;
    if (formulaType) filter.formulaType = formulaType;
    if (parent) filter.parent = parent === 'null' ? null : parent;
    if (q) {
      filter.$or = [
        { name: new RegExp(q, 'i') },
        { description: new RegExp(q, 'i') },
      ];
    }

    // Paginated list for admin tables
    if (page !== undefined) {
      const pageNum = Math.max(1, Number(page) || 1);
      const lim = Math.min(100, Math.max(1, Number(limit) || 10));
      const skip = (pageNum - 1) * lim;
      const [items, total] = await Promise.all([
        Category.find(filter)
          .populate('parent', 'name type')
          .sort({ sortOrder: 1, name: 1 })
          .skip(skip)
          .limit(lim),
        Category.countDocuments(filter),
      ]);
      return res.json({
        items,
        total,
        page: pageNum,
        pages: Math.ceil(total / lim) || 1,
      });
    }

    // Full list for dropdowns / product forms
    const list = await Category.find(filter).populate('parent', 'name type').sort({ sortOrder: 1, name: 1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  const cat = await Category.findById(req.params.id).populate('parent', 'name type');
  if (!cat) return res.status(404).json({ message: 'Category not found' });
  res.json(cat);
});

router.post('/', authorize('superadmin', 'staff'), upload.single('image'), async (req, res) => {
  try {
    const { name, description, type, parent, sortOrder, formulaType } = req.body;
    if (!name || !type) return res.status(400).json({ message: 'Name and type required' });

    const allowedFormula = ['none', 'W_H', 'W_D', 'W_H_D'];
    const cat = await Category.create({
      name,
      description: description || '',
      type,
      parent: parent || null,
      formulaType: allowedFormula.includes(formulaType) ? formulaType : 'none',
      sortOrder: Number(sortOrder) || 0,
      image: req.file ? `/uploads/${req.file.filename}` : '',
    });
    res.status(201).json(cat);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', authorize('superadmin'), upload.single('image'), async (req, res) => {
  try {
    const cat = await Category.findById(req.params.id);
    if (!cat) return res.status(404).json({ message: 'Category not found' });

    const { name, description, type, parent, sortOrder, isActive, formulaType } = req.body;
    if (name) cat.name = name;
    if (description !== undefined) cat.description = description;
    if (type) cat.type = type;
    if (parent !== undefined) cat.parent = parent || null;
    if (formulaType !== undefined && ['none', 'W_H', 'W_D', 'W_H_D'].includes(formulaType)) {
      cat.formulaType = formulaType;
    }
    if (sortOrder !== undefined) cat.sortOrder = Number(sortOrder) || 0;
    if (isActive !== undefined) cat.isActive = isActive === 'true' || isActive === true;
    if (req.file) cat.image = `/uploads/${req.file.filename}`;

    await cat.save();
    res.json(cat);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', authorize('superadmin'), async (req, res) => {
  const children = await Category.countDocuments({ parent: req.params.id });
  if (children > 0) {
    return res.status(400).json({ message: 'Delete child categories first' });
  }
  const cat = await Category.findByIdAndDelete(req.params.id);
  if (!cat) return res.status(404).json({ message: 'Category not found' });
  res.json({ message: 'Category deleted' });
});

router.post('/import', authorize('superadmin', 'staff'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Excel file required' });

    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    let created = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const name = row.name || row.Name || row.NAME;
        const type = (row.type || row.Type || 'category').toLowerCase();
        if (!name) {
          errors.push(`Row ${i + 2}: missing name`);
          continue;
        }
        if (!['category', 'subcategory', 'child'].includes(type)) {
          errors.push(`Row ${i + 2}: invalid type`);
          continue;
        }

        let parentId = null;
        const parentName = row.parent || row.Parent || row.parentName;
        if (parentName) {
          const parentType = type === 'child' ? 'subcategory' : 'category';
          let parent = await Category.findOne({ name: String(parentName).trim(), type: parentType });
          if (!parent && type === 'child') {
            parent = await Category.findOne({ name: String(parentName).trim() });
          }
          if (parent) parentId = parent._id;
        }

        const rawFormula = String(row.formulaType || row.FormulaType || row.formula || row.Formula || 'none')
          .trim()
          .toUpperCase()
          .replace(/[×xX]/g, '_')
          .replace(/\s+/g, '');
        let formulaType = 'none';
        if (rawFormula === 'W_H' || rawFormula === 'WH' || rawFormula === 'WXH') formulaType = 'W_H';
        else if (rawFormula === 'W_D' || rawFormula === 'WD' || rawFormula === 'WXD') formulaType = 'W_D';
        else if (
          rawFormula === 'W_H_D' ||
          rawFormula === 'WHD' ||
          rawFormula === 'WXHXD' ||
          rawFormula === 'W_H_X_D'
        ) {
          formulaType = 'W_H_D';
        }

        await Category.create({
          name: String(name).trim(),
          description: String(row.description || row.Description || ''),
          type,
          parent: parentId,
          formulaType,
          sortOrder: Number(row.sortOrder || row.SortOrder || 0),
          image: String(row.image || row.Image || ''),
        });
        created += 1;
      } catch (e) {
        errors.push(`Row ${i + 2}: ${e.message}`);
      }
    }

    res.json({ message: `Imported ${created} categories`, created, errors });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
