import PDFDocument from 'pdfkit';
import { resolveUploadPath } from './imagePath.js';
import { withCategorySections } from './boqSections.js';

const formatINR = (n) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function buildBoqPdf(boq, res) {
  const doc = new PDFDocument({ margin: 28, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${boq.billNo || 'boq'}.pdf"`);
  doc.pipe(res);

  const left = 28;
  const pageWidth = doc.page.width - 56;
  const billDate = boq.billDate ? new Date(boq.billDate) : new Date();
  const dateStr = `${String(billDate.getDate()).padStart(2, '0')}.${String(billDate.getMonth() + 1).padStart(2, '0')}.${billDate.getFullYear()}`;

  // Header
  doc.fillColor('#E85D04').fontSize(20).font('Helvetica-Bold').text('ORANGE', left, 28, { continued: true });
  doc.fillColor('#333').text(' INTERIOR');

  doc.font('Helvetica').fontSize(8).fillColor('#333');
  const rightBlock = [
    'Orange Interior',
    'Guindy, Chennai.',
    'sales@orangeinterior.in',
    '91-9003208146 / 91-984048513',
    'GST No: 33DHUPS1600A1ZN',
    `Date: ${dateStr}`,
  ];
  rightBlock.forEach((line, i) => {
    doc.text(line, left, 28 + i * 11, { width: pageWidth, align: 'right' });
  });

  let y = 100;
  doc.font('Helvetica').fontSize(10).fillColor('#111');
  doc.text(`Client Name: ${boq.clientName || ''}`, left, y);
  y += 14;
  doc.text(`Location: ${boq.location || ''}`, left, y);
  y += 14;
  doc.text(`Kind Attn: ${boq.kindAttn ? `(${boq.kindAttn})` : '()'}`, left, y);
  y += 18;

  const cols = [
    { label: 'Sl.no', w: 28 },
    { label: 'Specification of work', w: 188 },
    { label: 'Brand', w: 78 },
    { label: 'Unit', w: 30 },
    { label: 'Nos', w: 28 },
    { label: 'Qty', w: 36 },
    { label: 'Rate', w: 52 },
    { label: 'Total amount', w: 58 },
    { label: 'Remarks', w: 40 },
  ];

  const drawTitleAndHeader = (yy) => {
    doc.rect(left, yy, pageWidth, 18).fillAndStroke('#B8D4E8', '#666');
    doc.fillColor('#111').font('Helvetica-Bold').fontSize(9)
      .text(boq.title || 'INTERIOR WORKS COSTING', left, yy + 4, { width: pageWidth, align: 'center' });
    yy += 18;
    doc.rect(left, yy, pageWidth, 16).fillAndStroke('#CFE2F3', '#666');
    let x = left;
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#111');
    cols.forEach((c) => {
      doc.text(c.label, x + 1, yy + 4, { width: c.w - 2, align: 'center' });
      x += c.w;
    });
    return yy + 16;
  };

  y = drawTitleAndHeader(y);
  let sectionSl = 0;
  const items = withCategorySections(boq.items || []);

  const ensureSpace = (need) => {
    if (y + need > doc.page.height - 40) {
      doc.addPage();
      y = drawTitleAndHeader(28);
    }
  };

  items.forEach((item) => {
    if (item.isSectionHeader) {
      ensureSpace(18);
      sectionSl = 0;
      doc.rect(left, y, pageWidth, 16).fillAndStroke('#9DC3E6', '#666');
      doc.fillColor('#111').font('Helvetica-Bold').fontSize(8)
        .text(item.specification || item.categoryLabel || '', left + 4, y + 4, { width: pageWidth - 8 });
      y += 16;
      return;
    }

    sectionSl += 1;
    const imgPath = resolveUploadPath(item.image);
    const spec = item.specification || '';
    doc.font('Helvetica').fontSize(7);
    const specH = doc.heightOfString(spec, { width: cols[1].w - (imgPath ? 34 : 6) });
    const rowH = Math.max(imgPath ? 36 : 16, specH + 8);
    ensureSpace(rowH);

    doc.strokeColor('#666').lineWidth(0.4).rect(left, y, pageWidth, rowH).stroke();
    let x = left;
    const cells = [
      String(sectionSl),
      spec,
      item.brand || '',
      item.unit || '',
      String(item.nos ?? ''),
      String(item.qty ?? ''),
      formatINR(item.rate),
      formatINR(item.amount),
      item.remarks || '',
    ];

    cells.forEach((v, i) => {
      if (i === 1) {
        if (imgPath) {
          try {
            doc.image(imgPath, x + 2, y + 3, { fit: [28, rowH - 6] });
          } catch { /* ignore */ }
          doc.fillColor('#111').text(v, x + 32, y + 3, { width: cols[i].w - 34 });
        } else {
          doc.fillColor('#111').text(v, x + 2, y + 3, { width: cols[i].w - 4 });
        }
      } else {
        const align = i === 0 || i === 3 || i === 4 ? 'center' : i >= 5 && i <= 7 ? 'right' : 'left';
        doc.fillColor('#111').text(String(v), x + 2, y + 3, { width: cols[i].w - 4, align });
      }
      x += cols[i].w;
    });
    y += rowH;
  });

  const applyGst = boq.applyGst === true || boq.gstExtra === true;
  const gstPercent = Number(boq.gstPercent) || 18;
  const base = Number(boq.totalWithoutGst) || 0;
  const gstAmount = applyGst ? Number(boq.gstAmount) || (base * gstPercent) / 100 : 0;
  const grandTotal = applyGst ? Number(boq.grandTotal) || base + gstAmount : base;

  const drawTotalRow = (label, value, fill = null, bold = true) => {
    ensureSpace(18);
    if (fill) doc.rect(left, y, pageWidth, 16).fillAndStroke(fill, '#666');
    else doc.strokeColor('#666').rect(left, y, pageWidth, 16).stroke();
    doc.fillColor('#111').font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8);
    const labelW = cols.slice(0, 7).reduce((s, c) => s + c.w, 0);
    doc.text(label, left + 2, y + 4, { width: labelW - 4, align: 'right' });
    doc.text(value, left + labelW + 2, y + 4, { width: cols[7].w - 4, align: 'right' });
    y += 16;
  };

  drawTotalRow('TOTAL', formatINR(boq.subtotal));
  drawTotalRow('DISCOUNT', boq.discount ? formatINR(boq.discount) : '');
  drawTotalRow('TOTAL ( WITHOUT GST )', formatINR(base), '#B8D4E8');
  if (applyGst) {
    drawTotalRow(`GST ${gstPercent}%`, formatINR(gstAmount));
    drawTotalRow('GRAND TOTAL', formatINR(grandTotal), '#B8D4E8');
  }

  ensureSpace(22);
  doc.rect(left, y, pageWidth, 18).fillAndStroke('#B8D4E8', '#666');
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#C1121F')
    .text(applyGst ? `GST ${gstPercent}% Extra` : 'GST Not Applied', left, y + 4, {
      width: pageWidth - 8,
      align: 'right',
    });
  y += 26;

  const colW = pageWidth / 3;
  const textW = colW - 10;
  doc.font('Helvetica').fontSize(7);
  const measure = (lines = []) =>
    lines.reduce((sum, n, i) => sum + doc.heightOfString(`${i + 1}. ${n}`, { width: textW }) + 6, 0);
  ensureSpace(30 + Math.max(measure(boq.notes || []), measure(boq.paymentTerms || []), 90));

  doc.font('Helvetica-Bold').fontSize(9).fillColor('#111');
  doc.text('Notes:', left, y);
  doc.text('Payment:', left + colW, y);
  doc.text('For Orange Interior', left + colW * 2 + 50, y, { width: colW - 50, align: 'right' });

  const startY = y + 14;
  doc.font('Helvetica').fontSize(7);

  let noteY = startY;
  (boq.notes || []).forEach((n, i) => {
    const line = `${i + 1}. ${n}`;
    const h = doc.heightOfString(line, { width: textW });
    if (i === 3) {
      doc.rect(left, noteY - 1, textW + 4, h + 2).fill('#FADBD8');
    }
    doc.fillColor(i === 3 ? '#C1121F' : '#333').text(line, left + 2, noteY, { width: textW });
    noteY += h + 6;
  });

  let payY = startY;
  (boq.paymentTerms || []).forEach((n, i) => {
    const line = `${i + 1}. ${n}`;
    const h = doc.heightOfString(line, { width: textW });
    doc.fillColor('#333').text(line, left + colW, payY, { width: textW });
    payY += h + 6;
  });

  doc.fillColor('#111').font('Helvetica').fontSize(9)
    .text('Proprietor', left + colW * 2 + 50, startY + 70, { width: colW - 50, align: 'right' });

  doc.end();
}
