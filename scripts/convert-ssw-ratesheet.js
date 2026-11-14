import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(__dirname, '../../Rate sheet - SSW - COMPLETED.xlsx');
const outDir = path.resolve(__dirname, '../../frontend/public/samples');
fs.mkdirSync(outDir, { recursive: true });

const wb = XLSX.readFile(src);
const rows = XLSX.utils.sheet_to_json(wb.Sheets['SPECIFICATION'], { header: 1, defval: '' });

const skipHeaders = new Set(['', 'sl. no', 'sl.no', 'rate sheet', 'specification', 'brand', 'unit', 'rate']);

const normalizeUnit = (u) => {
  const v = String(u || 'Nos').trim().toUpperCase();
  if (!v) return 'Nos';
  if (['SFT', 'SQFT', 'SQ.FT', 'SQ FT'].includes(v)) return 'Sft';
  if (['NOS', 'NO', 'NO.', 'NUM'].includes(v)) return 'Nos';
  if (['RFT', 'R.FT'].includes(v)) return 'Rft';
  if (['SQM', 'SQ.M'].includes(v)) return 'Sqm';
  if (['LS', 'LUMPSUM', 'LUMP SUM'].includes(v)) return 'Lumpsum';
  return String(u).trim() || 'Nos';
};

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

const makeName = (spec) => {
  const t = clean(spec);
  if (t.length <= 80) return t;
  const cut = t.slice(0, 80);
  const sp = cut.lastIndexOf(' ');
  return (sp > 40 ? cut.slice(0, sp) : cut) + '…';
};

const categories = [];
const brandsMap = new Map();
const products = [];
let currentCategory = '';
let catCode = 0;

for (let i = 0; i < rows.length; i++) {
  const r = rows[i];
  const colB = clean(r[1]);
  const colC = clean(r[2]);
  const colD = clean(r[3]);
  const colE = clean(r[4]);
  const colF = r[5];

  const bLower = colB.toLowerCase();
  if (skipHeaders.has(bLower) && !colC) continue;

  // Section header: has label in B, no specification in C
  if (colB && !colC && !skipHeaders.has(bLower)) {
    currentCategory = colB;
    catCode += 1;
    const code = String.fromCharCode(64 + ((catCode - 1) % 26) + 1); // A,B,C...
    // For >26 use AA style simply as number suffix
    const finalCode = catCode <= 26 ? code : `S${catCode}`;
    categories.push({
      name: currentCategory,
      type: 'category',
      code: finalCode,
      parent: '',
      description: `From SSW rate sheet`,
      sortOrder: catCode,
    });
    continue;
  }

  // Product row: has specification + rate
  const rate = Number(colF);
  if (!colC || Number.isNaN(rate)) continue;
  if (!currentCategory) {
    currentCategory = 'GENERAL';
    if (!categories.find((c) => c.name === 'GENERAL')) {
      catCode += 1;
      categories.push({
        name: 'GENERAL',
        type: 'category',
        code: 'Z',
        parent: '',
        description: 'Unsectioned items',
        sortOrder: 999,
      });
    }
  }

  let brand = colD;
  if (brand) {
    const key = brand.toLowerCase();
    if (!brandsMap.has(key)) {
      brandsMap.set(key, { name: brand, description: '' });
    }
  }

  products.push({
    name: makeName(colC),
    specification: colC,
    brand: brand || '',
    unit: normalizeUnit(colE),
    rate,
    category: currentCategory,
    subcategory: '',
    child: '',
    remarks: '',
    image: '',
  });
}

const brands = [...brandsMap.values()].sort((a, b) => a.name.localeCompare(b.name));

function write(filename, data) {
  const book = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(book, sheet, 'Sheet1');
  const file = path.join(outDir, filename);
  XLSX.writeFile(book, file);
  console.log(`Wrote ${filename} (${data.length} rows)`);
}

write('sample-categories.xlsx', categories);
write('sample-brands.xlsx', brands);
write('sample-products.xlsx', products);

// Also keep SSW-named copies
write('ssw-categories.xlsx', categories);
write('ssw-brands.xlsx', brands);
write('ssw-products.xlsx', products);

console.log('\nSummary');
console.log('Categories:', categories.length);
console.log('Brands:', brands.length);
console.log('Products:', products.length);
