import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(__dirname, '../../frontend/public/samples');
fs.mkdirSync(out, { recursive: true });

const cats = [
  {
    name: 'M.D Cabin 1 & 2',
    type: 'category',
    code: 'A',
    parent: '',
    description: 'MD cabin furniture',
    sortOrder: 1,
  },
  {
    name: 'Meeting Room',
    type: 'category',
    code: 'B',
    parent: '',
    description: 'Meeting room works',
    sortOrder: 2,
  },
  {
    name: 'Reception Area',
    type: 'category',
    code: 'C',
    parent: '',
    description: '',
    sortOrder: 3,
  },
  {
    name: 'Furniture',
    type: 'subcategory',
    code: '',
    parent: 'M.D Cabin 1 & 2',
    description: '',
    sortOrder: 1,
  },
  {
    name: 'Panelling',
    type: 'subcategory',
    code: '',
    parent: 'Meeting Room',
    description: '',
    sortOrder: 1,
  },
  {
    name: 'Tables & Storage',
    type: 'child',
    code: '',
    parent: 'Furniture',
    description: '',
    sortOrder: 1,
  },
];

const brands = [
  { name: 'Sharon Plb, Ebco Fittings', description: 'Plywood and fittings' },
  { name: 'Kitply, Virgo Lam, Ebco Fittings', description: 'Kitply with laminate' },
  { name: 'Interface / Equivalent', description: 'Carpet brand' },
];

const products = [
  {
    name: 'M.D Table Top',
    specification:
      'Supply And Fixing M.D Table Top Made Of 18mm Plywood With Laminate Finish. Size: W 6ft x D 2.6ft x H 2.6ft',
    brand: 'Sharon Plb, Ebco Fittings',
    unit: 'Nos',
    rate: 28875,
    category: 'M.D Cabin 1 & 2',
    subcategory: 'Furniture',
    child: 'Tables & Storage',
    remarks: '',
    image: '',
  },
  {
    name: 'Wall Paneling',
    specification:
      'Supply and Fixing of Wall Paneling with 12mm Kitplywood and Gloss Finish Laminate',
    brand: 'Kitply, Virgo Lam, Ebco Fittings',
    unit: 'Sft',
    rate: 850,
    category: 'Meeting Room',
    subcategory: 'Panelling',
    child: '',
    remarks: '',
    image: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=400',
  },
  {
    name: 'Modular Workstation',
    specification: 'Supply And Fixing Modular Workstation 4ft with Partition and Cable Tray',
    brand: '',
    unit: 'Nos',
    rate: 12500,
    category: 'Reception Area',
    subcategory: '',
    child: '',
    remarks: 'Brand optional - left blank',
    image: '',
  },
];

function write(name, rows) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const file = path.join(out, name);
  XLSX.writeFile(wb, file);
  console.log('Wrote', file);
}

write('sample-categories.xlsx', cats);
write('sample-brands.xlsx', brands);
write('sample-products.xlsx', products);
