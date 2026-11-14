import express from 'express';
import XLSX from 'xlsx';
import Brand from '../models/Brand.js';
import { protect, authorize } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

router.use(protect);

router.get('/', async (_req, res) => {
  try {
    const brands = await Brand.find().sort({ name: 1 });
    res.json(brands);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', authorize('superadmin', 'staff'), async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ message: 'Brand name required' });

    const exists = await Brand.findOne({ name: new RegExp(`^${name}$`, 'i') });
    if (exists) return res.status(400).json({ message: 'Brand already exists', brand: exists });

    const brand = await Brand.create({
      name,
      description: req.body.description || '',
    });
    res.status(201).json(brand);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', authorize('superadmin'), async (req, res) => {
  try {
    const brand = await Brand.findById(req.params.id);
    if (!brand) return res.status(404).json({ message: 'Brand not found' });

    if (req.body.name !== undefined) brand.name = String(req.body.name).trim();
    if (req.body.description !== undefined) brand.description = req.body.description;
    if (req.body.isActive !== undefined) brand.isActive = req.body.isActive;

    await brand.save();
    res.json(brand);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', authorize('superadmin'), async (req, res) => {
  const brand = await Brand.findByIdAndDelete(req.params.id);
  if (!brand) return res.status(404).json({ message: 'Brand not found' });
  res.json({ message: 'Brand deleted' });
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
        const name = String(row.name || row.Name || row.brand || row.Brand || '').trim();
        if (!name) {
          errors.push(`Row ${i + 2}: missing name`);
          continue;
        }
        const exists = await Brand.findOne({ name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
        if (exists) {
          errors.push(`Row ${i + 2}: brand already exists (${exists.name})`);
          continue;
        }
        await Brand.create({
          name,
          description: String(row.description || row.Description || ''),
        });
        created += 1;
      } catch (e) {
        errors.push(`Row ${i + 2}: ${e.message}`);
      }
    }

    res.json({ message: `Imported ${created} brands`, created, errors });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
