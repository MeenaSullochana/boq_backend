/** Formula sheet rules for BOQ quantity calculation. */

export const FORMULA_TYPES = {
  INHERIT: 'inherit',
  NONE: 'none',
  W_H: 'W_H',
  W_D: 'W_D',
  W_H_D: 'W_H_D',
};

const AREA_FORMULAS = new Set([FORMULA_TYPES.W_H, FORMULA_TYPES.W_D, FORMULA_TYPES.W_H_D]);

export function isAreaFormula(formulaType) {
  return AREA_FORMULAS.has(formulaType);
}

export function inferFormulaType(name = '') {
  const n = String(name).toLowerCase();
  if (!n) return FORMULA_TYPES.NONE;

  if (/volume|cubicle|tank\b|sump|rcc\s*column|concrete/.test(n)) {
    return FORMULA_TYPES.W_H_D;
  }

  if (/ceiling|flooring|floor\b|rcc|slab|lintel/.test(n)) {
    return FORMULA_TYPES.W_D;
  }

  if (
    /partition|paint|panell|aac|brick|wall\s*tile|cladding|water\s*proof|storage|roller\s*blind|blind/.test(
      n
    )
  ) {
    return FORMULA_TYPES.W_H;
  }

  if (/door|chair|table|workstation|access|ac\b|stabilizer|signage|lock|ladder/.test(n)) {
    return FORMULA_TYPES.NONE;
  }

  return FORMULA_TYPES.NONE;
}

function categoryFormula(category = null) {
  if (!category) return null;
  if (isAreaFormula(category.formulaType)) return category.formulaType;
  if (!category.formulaType || category.formulaType === 'auto') {
    return inferFormulaType(category.name);
  }
  if (category.name) {
    const inferred = inferFormulaType(category.name);
    if (inferred !== FORMULA_TYPES.NONE) return inferred;
  }
  return FORMULA_TYPES.NONE;
}

export function resolveFormulaType(item = {}, category = null, { preferItem = false, product = null } = {}) {
  if (preferItem && item.formulaType && item.formulaType !== FORMULA_TYPES.INHERIT) {
    return item.formulaType;
  }

  const productFormula = product?.formulaType ?? item.productFormulaType;
  if (productFormula === FORMULA_TYPES.NONE || isAreaFormula(productFormula)) {
    return productFormula;
  }

  const fromCat = categoryFormula(category);
  if (isAreaFormula(fromCat)) return fromCat;

  if (item.categoryLabel) {
    const inferred = inferFormulaType(item.categoryLabel);
    if (inferred !== FORMULA_TYPES.NONE) return inferred;
  }

  if (isAreaFormula(item.formulaType)) return item.formulaType;

  const unit = String(item.unit || product?.unit || '').toLowerCase();
  if (unit === 'sft' || unit === 'sqm') return FORMULA_TYPES.W_H;
  return FORMULA_TYPES.NONE;
}

export function resolveProductBoqInfo(product = {}, category = null) {
  const unit = product.unit || 'Nos';
  const formulaType = resolveFormulaType({ unit }, category || product.category, { product });
  return { unit, formulaType };
}

export function splitFeetInches(value) {
  if (value === '' || value == null) return null;
  const str = String(value).trim();
  if (!str) return null;

  const ftIn = str.match(/^(\d+)\s*'\s*(\d+)\s*"?$/);
  if (ftIn) {
    return { feet: Number(ftIn[1]), inches: Number(ftIn[2]) };
  }

  const m = str.match(/^(\d+)(?:\.(\d+))?$/);
  if (!m) return null;

  let feet = Number(m[1]);
  const inchPart = m[2] || '0';
  let inches = inchPart.length === 1 ? Number(inchPart) : Number(inchPart.slice(0, 2));
  if (!Number.isFinite(inches) || inches < 0) inches = 0;
  if (inches >= 12) {
    feet += Math.floor(inches / 12);
    inches %= 12;
  }
  if (!(feet > 0 || inches > 0)) return null;
  return { feet, inches };
}

export function parseFeetInchesInput(value) {
  const parts = splitFeetInches(value);
  if (!parts) return 0;
  return parts.feet + parts.inches / 12;
}

/**
 * Nos is always 1.
 * - none: Amount = Quantity × Rate
 * - W_H / W_D / W_H_D: Amount = Quantity × formula × Rate
 */
export function calcLineItem(item = {}) {
  const rate = Number(item.rate) || 0;
  const formulaType = item.formulaType || FORMULA_TYPES.NONE;

  const w = parseFeetInchesInput(item.width);
  const h = parseFeetInchesInput(item.height);
  const d = parseFeetInchesInput(item.depth);

  let formulaArea = 1;
  if (formulaType === FORMULA_TYPES.W_H) {
    formulaArea = w * h;
  } else if (formulaType === FORMULA_TYPES.W_D) {
    formulaArea = w * d;
  } else if (formulaType === FORMULA_TYPES.W_H_D) {
    formulaArea = w * h * d;
  }

  const rawQty = Number(item.quantity);
  let quantity;
  if (Number.isFinite(rawQty) && rawQty >= 0) {
    quantity = rawQty;
  } else if (isAreaFormula(formulaType)) {
    const legacyNos = Number(item.nos);
    quantity = Number.isFinite(legacyNos) && legacyNos > 0 ? legacyNos : 1;
  } else {
    const legacyQty = Number(item.qty);
    quantity = Number.isFinite(legacyQty) ? legacyQty : 1;
  }

  formulaArea = Math.round(formulaArea * 100) / 100;
  const qty = Math.round(quantity * formulaArea * 100) / 100;
  const amount = Math.round(qty * rate * 100) / 100;

  return {
    nos: 1,
    quantity,
    formulaArea,
    qty,
    rate,
    amount,
    formulaType,
    width: item.width === '' || item.width == null ? 0 : item.width,
    height: item.height === '' || item.height == null ? 0 : item.height,
    depth: item.depth === '' || item.depth == null ? 0 : item.depth,
  };
}
