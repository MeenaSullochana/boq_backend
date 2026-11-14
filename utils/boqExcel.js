import ExcelJS from 'exceljs';
import fs from 'fs';
import { resolveUploadPath } from './imagePath.js';
import { withCategorySections } from './boqSections.js';

const formatNum = (n) => Number(n || 0);

export async function buildBoqExcel(boq, res) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('BOQ');
  const d = boq.billDate ? new Date(boq.billDate) : new Date();
  const dateStr = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;

  ws.mergeCells('A1:B2');
  ws.getCell('A1').value = 'ORANGE INTERIOR';
  ws.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FFE85D04' } };
  ws.getCell('A1').alignment = { vertical: 'middle' };

  ws.getCell('G1').value = 'Orange Interior';
  ws.getCell('G2').value = 'Guindy, Chennai.';
  ws.getCell('H1').value = 'sales@orangeinterior.in';
  ws.getCell('H2').value = '91-9003208146 / 91-984048513';
  ws.getCell('I1').value = 'GST No: 33DHUPS1600A1ZN';
  ws.getCell('I2').value = `Date: ${dateStr}`;

  ws.getCell('A4').value = `Client Name: ${boq.clientName || ''}`;
  ws.getCell('A5').value = `Location: ${boq.location || ''}`;
  ws.getCell('A6').value = `Kind Attn: ${boq.kindAttn ? `(${boq.kindAttn})` : '()'}`;

  ws.mergeCells('A8:I8');
  ws.getCell('A8').value = boq.title || 'INTERIOR WORKS COSTING';
  ws.getCell('A8').font = { bold: true, size: 12 };
  ws.getCell('A8').alignment = { horizontal: 'center' };
  ws.getCell('A8').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB8D4E8' } };

  const header = ['Sl.no', 'Specification of work', 'Brand', 'Unit', 'Nos', 'Qty', 'Rate', 'Total amount', 'Remarks'];
  const headerRow = ws.addRow(header);
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCFE2F3' } };
    cell.font = { bold: true, size: 10 };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
    cell.alignment = { horizontal: 'center' };
  });

  let sectionSl = 0;
  for (const item of withCategorySections(boq.items || [])) {
    if (item.isSectionHeader) {
      sectionSl = 0;
      const row = ws.addRow([item.specification || item.categoryLabel || '', '', '', '', '', '', '', '', '']);
      ws.mergeCells(`A${row.number}:I${row.number}`);
      row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF9DC3E6' } };
      row.getCell(1).font = { bold: true };
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
      continue;
    }

    sectionSl += 1;
    const row = ws.addRow([
      sectionSl,
      item.specification || '',
      item.brand || '',
      item.unit || '',
      item.nos ?? 1,
      item.qty ?? 1,
      formatNum(item.rate),
      formatNum(item.amount),
      item.remarks || '',
    ]);
    row.height = item.image ? 48 : 22;
    row.eachCell((cell, col) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
      cell.alignment = {
        wrapText: true,
        vertical: 'middle',
        horizontal: [1, 4, 5].includes(col) ? 'center' : [6, 7, 8].includes(col) ? 'right' : 'left',
      };
    });

    const imgPath = resolveUploadPath(item.image);
    if (imgPath) {
      try {
        const ext = imgPath.split('.').pop()?.toLowerCase();
        const type = ext === 'png' ? 'png' : ext === 'gif' ? 'gif' : 'jpeg';
        const imageId = wb.addImage({
          buffer: fs.readFileSync(imgPath),
          extension: type,
        });
        ws.addImage(imageId, {
          tl: { col: 1.02, row: row.number - 1 + 0.1 },
          ext: { width: 40, height: 40 },
          editAs: 'oneCell',
        });
      } catch {
        // skip
      }
    }
  }

  const applyGst = boq.applyGst === true || boq.gstExtra === true;
  const gstPercent = Number(boq.gstPercent) || 18;
  const base = Number(boq.totalWithoutGst) || 0;
  const gstAmount = applyGst ? Number(boq.gstAmount) || (base * gstPercent) / 100 : 0;
  const grandTotal = applyGst ? Number(boq.grandTotal) || base + gstAmount : base;

  const addTotal = (label, value, fill) => {
    const row = ws.addRow(['', '', '', '', '', '', label, value === '' ? '' : formatNum(value), '']);
    row.getCell(7).font = { bold: true };
    row.getCell(7).alignment = { horizontal: 'right' };
    row.getCell(8).font = { bold: true };
    row.getCell(8).alignment = { horizontal: 'right' };
    if (fill) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
      });
    }
  };

  addTotal('TOTAL', boq.subtotal);
  addTotal('DISCOUNT', boq.discount || '');
  addTotal('TOTAL ( WITHOUT GST )', base, 'FFB8D4E8');
  if (applyGst) {
    addTotal(`GST ${gstPercent}%`, gstAmount);
    addTotal('GRAND TOTAL', grandTotal, 'FFB8D4E8');
  }

  const gstRow = ws.addRow(['', '', '', '', '', '', '', applyGst ? `GST ${gstPercent}% Extra` : 'GST Not Applied', '']);
  gstRow.getCell(8).font = { bold: true, color: { argb: 'FFC1121F' } };
  gstRow.getCell(8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB8D4E8' } };

  ws.addRow([]);
  ws.addRow(['Notes:', 'Payment:', 'For Orange Interior']);
  const maxLen = Math.max((boq.notes || []).length, (boq.paymentTerms || []).length);
  for (let i = 0; i < maxLen; i++) {
    const row = ws.addRow([
      boq.notes?.[i] ? `${i + 1}. ${boq.notes[i]}` : '',
      boq.paymentTerms?.[i] ? `${i + 1}. ${boq.paymentTerms[i]}` : '',
      i === maxLen - 1 ? 'Proprietor' : '',
    ]);
    if (i === 3 && boq.notes?.[i]) {
      row.getCell(1).font = { color: { argb: 'FFC1121F' }, bold: true };
      row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFADBD8' } };
    }
  }

  ws.columns = [
    { width: 8 },
    { width: 48 },
    { width: 22 },
    { width: 8 },
    { width: 8 },
    { width: 10 },
    { width: 18 },
    { width: 14 },
    { width: 12 },
  ];

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${boq.billNo || 'boq'}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
}
