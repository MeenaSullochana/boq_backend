/**
 * For PDF/Excel: if BOQ has no section headers, insert category banners
 * so work appears under its category like the sample sheet.
 */
export function withCategorySections(items = []) {
  if (!items.length) return items;
  if (items.some((i) => i.isSectionHeader)) return items;

  const out = [];
  let lastKey = null;
  items.forEach((item) => {
    const key = String(item.categoryId || item.categoryLabel || '_misc');
    const label = item.categoryLabel || 'Works';
    if (key !== lastKey) {
      out.push({
        isSectionHeader: true,
        specification: label,
        categoryLabel: label,
        categoryId: item.categoryId || '',
      });
      lastKey = key;
    }
    out.push(item);
  });
  return out;
}
