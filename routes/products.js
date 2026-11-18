import express from 'express';
import XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import Brand from '../models/Brand.js';
import { protect, authorize } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsRoot = path.join(__dirname, '..', 'uploads');

const router = express.Router();

router.use(protect);

router.get('/', async (req, res) => {
  try {
    const { q, category, subcategory, childCategory, unit, formulaType, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (q) {
      filter.$or = [
        { name: new RegExp(q, 'i') },
        { specification: new RegExp(q, 'i') },
        { brand: new RegExp(q, 'i') },
        { remarks: new RegExp(q, 'i') },
      ];
    }
    if (category) filter.category = category;
    if (subcategory) filter.subcategory = subcategory;
    if (childCategory) filter.childCategory = childCategory;
    if (unit) filter.unit = unit;
    if (formulaType) filter.formulaType = formulaType;

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      Product.find(filter)
        .populate('category', 'name formulaType')
        .populate('subcategory', 'name')
        .populate('childCategory', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Product.countDocuments(filter),
    ]);
    res.json({ items, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  const product = await Product.findById(req.params.id)
    .populate('category', 'name formulaType')
    .populate('subcategory', 'name')
    .populate('childCategory', 'name');
  if (!product) return res.status(404).json({ message: 'Product not found' });
  res.json(product);
});

const allowedProductFormula = ['inherit', 'none', 'W_H', 'W_D', 'W_H_D'];

router.post('/', authorize('superadmin', 'staff'), upload.single('image'), async (req, res) => {
  try {
    const {
      name,
      specification,
      brand,
      unit,
      formulaType,
      rate,
      category,
      subcategory,
      childCategory,
      remarks,
    } = req.body;
    if (!name) return res.status(400).json({ message: 'Product name required' });

    const product = await Product.create({
      name,
      specification: specification || name,
      brand: brand || '',
      unit: unit || 'Nos',
      formulaType: allowedProductFormula.includes(formulaType) ? formulaType : 'inherit',
      rate: Number(rate) || 0,
      category: category || null,
      subcategory: subcategory || null,
      childCategory: childCategory || null,
      remarks: remarks || '',
      image: req.file ? `/uploads/${req.file.filename}` : '',
    });
    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', authorize('superadmin'), upload.single('image'), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const fields = [
      'name',
      'specification',
      'brand',
      'unit',
      'formulaType',
      'rate',
      'category',
      'subcategory',
      'childCategory',
      'remarks',
      'isActive',
    ];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) {
        if (f === 'rate') product[f] = Number(req.body[f]) || 0;
        else if (['category', 'subcategory', 'childCategory'].includes(f)) {
          product[f] = req.body[f] || null;
        } else if (f === 'formulaType') {
          product[f] = allowedProductFormula.includes(req.body[f]) ? req.body[f] : 'inherit';
        } else if (f === 'isActive') {
          product[f] = req.body[f] === 'true' || req.body[f] === true;
        } else product[f] = req.body[f];
      }
    });
    if (req.file) product.image = `/uploads/${req.file.filename}`;
    await product.save();
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', authorize('superadmin'), async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found' });
  res.json({ message: 'Product deleted' });
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
        const name = row.name || row.Name || row.product || row.Product;
        if (!name) {
          errors.push(`Row ${i + 2}: missing name`);
          continue;
        }

        const findCat = async (val, type) => {
          if (!val) return null;
          const cat = await Category.findOne({ name: String(val).trim(), type });
          return cat?._id || null;
        };

        let brandName = String(row.brand || row.Brand || '').trim();
        if (brandName) {
          const existing = await Brand.findOne({
            name: new RegExp(`^${brandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
          });
          if (existing) brandName = existing.name;
          else {
            const createdBrand = await Brand.create({ name: brandName });
            brandName = createdBrand.name;
          }
        }

        let image = '';
        const imageVal = String(row.image || row.Image || row.imageUrl || row.ImageUrl || '').trim();
        if (imageVal) {
          if (/^https?:\/\//i.test(imageVal)) {
            try {
              const resp = await fetch(imageVal);
              if (resp.ok) {
                const buf = Buffer.from(await resp.arrayBuffer());
                const ext = path.extname(new URL(imageVal).pathname) || '.jpg';
                const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext.toLowerCase())
                  ? ext.toLowerCase()
                  : '.jpg';
                const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`;
                fs.writeFileSync(path.join(uploadsRoot, filename), buf);
                image = `/uploads/${filename}`;
              }
            } catch {
              errors.push(`Row ${i + 2}: image URL download failed`);
            }
          } else {
            const local = path.join(uploadsRoot, path.basename(imageVal));
            if (fs.existsSync(local)) {
              image = `/uploads/${path.basename(imageVal)}`;
            } else {
              errors.push(`Row ${i + 2}: image file not found in uploads (${imageVal})`);
            }
          }
        }

        const rawFormula = String(
          row.formulaType || row.FormulaType || row.formula || row.Formula || 'inherit'
        )
          .trim()
          .toUpperCase()
          .replace(/[×xX]/g, '_')
          .replace(/\s+/g, '');
        let formulaType = 'inherit';
        if (rawFormula === 'NONE' || rawFormula === 'NOS' || rawFormula === 'RFT' || rawFormula === 'LS') {
          formulaType = 'none';
        } else if (rawFormula === 'W_H' || rawFormula === 'WH' || rawFormula === 'WXH') {
          formulaType = 'W_H';
        } else if (rawFormula === 'W_D' || rawFormula === 'WD' || rawFormula === 'WXD') {
          formulaType = 'W_D';
        } else if (rawFormula === 'W_H_D' || rawFormula === 'WHD' || rawFormula === 'WXHXD') {
          formulaType = 'W_H_D';
        } else if (rawFormula === 'INHERIT' || rawFormula === 'CATEGORY') {
          formulaType = 'inherit';
        }

        await Product.create({
          name: String(name).trim(),
          specification: String(row.specification || row.Specification || name),
          brand: brandName,
          unit: String(row.unit || row.Unit || 'Nos'),
          formulaType,
          rate: Number(row.rate || row.Rate || 0),
          remarks: String(row.remarks || row.Remarks || ''),
          image,
          category: await findCat(row.category || row.Category, 'category'),
          subcategory: await findCat(row.subcategory || row.Subcategory || row.subCategory, 'subcategory'),
          childCategory: await findCat(row.child || row.childCategory || row.Child, 'child'),
        });
        created += 1;
      } catch (e) {
        errors.push(`Row ${i + 2}: ${e.message}`);
      }
    }

    res.json({ message: `Imported ${created} products`, created, errors });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
