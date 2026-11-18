/**
 * Generates Excel samples matching all form fields.
 * Run: node scripts/generate-samples.js
 */
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(__dirname, '../../frontend/public/samples');
fs.mkdirSync(out, { recursive: true });

/** Categories form fields: name, type, parent, formulaType, sortOrder, description, image */
const cats = [
  {
    name: 'PARTITION WORK',
    type: 'category',
    parent: '',
    formulaType: 'W_H',
    sortOrder: 1,
    description: 'Partition / wall panel works — Qty × (W × H)',
    image: '',
  },
  {
    name: 'CEILING WORK',
    type: 'category',
    parent: '',
    formulaType: 'W_D',
    sortOrder: 2,
    description: 'False ceiling — Qty × (W × D)',
    image: '',
  },
  {
    name: 'FLOORING WORK',
    type: 'category',
    parent: '',
    formulaType: 'W_D',
    sortOrder: 3,
    description: 'Flooring — Qty × (W × D)',
    image: '',
  },
  {
    name: 'DOOR WORK',
    type: 'category',
    parent: '',
    formulaType: 'none',
    sortOrder: 4,
    description: 'Doors — Qty × Rate (Nos)',
    image: '',
  },
  {
    name: 'Furniture',
    type: 'subcategory',
    parent: 'PARTITION WORK',
    formulaType: 'none',
    sortOrder: 1,
    description: 'Sub category under Partition',
    image: '',
  },
  {
    name: 'Tables & Storage',
    type: 'child',
    parent: 'Furniture',
    formulaType: 'none',
    sortOrder: 1,
    description: 'Child under Furniture',
    image: '',
  },
];

/** Brands form fields: name, description */
const brands = [
  { name: 'Sharon Plb, Ebco Fittings', description: 'Plywood and fittings' },
  { name: 'Kitply, Virgo Lam, Ebco Fittings', description: 'Kitply with laminate' },
  { name: 'Interface / Equivalent', description: 'Carpet brand' },
  { name: 'KAG', description: 'Tiles' },
  { name: 'CP Plus', description: 'CCTV / DVR' },
];

/**
 * Products form fields:
 * name, specification, brand, unit, formulaType, rate,
 * category, subcategory, child, remarks, image
 * formulaType: inherit | none | W_H | W_D | W_H_D
 */
const products = [
  {
    name: 'Aluminium Partition',
    specification: 'Supply And Fixing Aluminium Partition With 5mm Glass',
    brand: 'Sharon Plb, Ebco Fittings',
    unit: 'Sft',
    formulaType: 'inherit',
    rate: 450,
    category: 'PARTITION WORK',
    subcategory: '',
    child: '',
    remarks: 'Inherits category formula W_H',
    image: '',
  },
  {
    name: 'False Ceiling Gypsum',
    specification: 'Supply And Fixing Gypsum False Ceiling',
    brand: 'Kitply, Virgo Lam, Ebco Fittings',
    unit: 'Sft',
    formulaType: 'W_D',
    rate: 95,
    category: 'CEILING WORK',
    subcategory: '',
    child: '',
    remarks: '',
    image: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=400',
  },
  {
    name: 'Main Door',
    specification: 'Supply And Fixing Main Door With Frame And Lock',
    brand: '',
    unit: 'Nos',
    formulaType: 'none',
    rate: 18500,
    category: 'DOOR WORK',
    subcategory: '',
    child: '',
    remarks: 'No W/H/D — Qty × Rate only',
    image: '',
  },
  {
    name: 'Water Sump Volume',
    specification: 'RCC Water Sump / Tank volume work',
    brand: '',
    unit: 'Sft',
    formulaType: 'W_H_D',
    rate: 350,
    category: 'FLOORING WORK',
    subcategory: '',
    child: '',
    remarks: 'Qty × (W × H × D)',
    image: '',
  },
  {
    name: 'Storage Unit',
    specification: 'Supply And Fixing Storage Made Of 18mm Plywood',
    brand: 'Sharon Plb, Ebco Fittings',
    unit: 'Sft',
    formulaType: 'W_H',
    rate: 1250,
    category: 'PARTITION WORK',
    subcategory: 'Furniture',
    child: 'Tables & Storage',
    remarks: '',
    image: '',
  },
];

function write(name, rows) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  // Widen columns a bit for readability
  const keys = Object.keys(rows[0] || {});
  ws['!cols'] = keys.map((k) => ({ wch: Math.max(12, k.length + 2, 18) }));
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const file = path.join(out, name);
  XLSX.writeFile(wb, file);
  console.log('Wrote', file);
}

write('sample-categories.xlsx', cats);
write('sample-brands.xlsx', brands);
write('sample-products.xlsx', products);

console.log('\nSample columns:');
console.log('Categories:', Object.keys(cats[0]).join(', '));
console.log('Brands:', Object.keys(brands[0]).join(', '));
console.log('Products:', Object.keys(products[0]).join(', '));
