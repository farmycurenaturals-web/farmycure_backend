/**
 * Resolve where inventory lives for a line item and validate/deduct stock.
 * Cart stores variant as a human label (e.g. "Fresh - 1kg") or "default".
 */

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const productLabel = (product) =>
  String(product?.name || product?.title || 'Product').trim();

/** Variants shaped as [{ name, options: [{ quantity, price, stock }] }] */
const getStructuredVariants = (product) => {
  const v = product?.variants;
  if (!Array.isArray(v) || v.length === 0) return [];
  const hasOptions = v.some(
    (row) => row && Array.isArray(row.options) && row.options.length > 0
  );
  return hasOptions ? v : [];
};

const syncAggregateStock = (product) => {
  const structured = getStructuredVariants(product);
  if (structured.length === 0) return;
  const total = structured.reduce(
    (sum, v) =>
      sum + (v.options || []).reduce((s, o) => s + Number(o?.stock || 0), 0),
    0
  );
  product.stock = total;
};

const slotKey = (slot) => {
  if (slot.kind === 'root') return 'root';
  if (slot.kind === 'option') return `o:${slot.vi}:${slot.oi}`;
  return 'none';
};

/**
 * @returns {{ kind: 'option', vi: number, oi: number } | { kind: 'root' } | { kind: 'none' }}
 */
const resolveStockSlot = (product, variantString) => {
  const structured = getStructuredVariants(product);
  const key = norm(variantString);

  if (structured.length === 0) {
    return { kind: 'root' };
  }

  const matches = [];

  for (let vi = 0; vi < structured.length; vi++) {
    const row = structured[vi];
    const vName = String(row?.name || '').trim();
    const opts = Array.isArray(row?.options) ? row.options : [];
    for (let oi = 0; oi < opts.length; oi++) {
      const opt = opts[oi];
      const qLabel = String(opt?.quantity || '').trim();
      if (!qLabel) continue;
      const composite = norm(`${vName} - ${qLabel}`);
      if (key === composite) {
        matches.push({ vi, oi, rank: 1 });
        continue;
      }
      if (key === norm(qLabel)) {
        matches.push({ vi, oi, rank: 2 });
        continue;
      }
      if (key === norm(vName) && opts.length === 1) {
        matches.push({ vi, oi, rank: 3 });
      }
    }
  }

  const pickBest = (cands) => {
    if (cands.length === 0) return null;
    cands.sort((a, b) => a.rank - b.rank);
    const bestRank = cands[0].rank;
    const same = cands.filter((c) => c.rank === bestRank);
    if (same.length > 1 && bestRank === 2) {
      return 'ambiguous';
    }
    return { vi: same[0].vi, oi: same[0].oi };
  };

  let chosen = pickBest(matches);

  if (!chosen || chosen === 'ambiguous') {
    if (key === 'default' || key === '') {
      const allOptions = [];
      for (let vi = 0; vi < structured.length; vi++) {
        const opts = structured[vi]?.options || [];
        for (let oi = 0; oi < opts.length; oi++) {
          allOptions.push({ vi, oi });
        }
      }
      if (allOptions.length === 1) {
        chosen = { vi: allOptions[0].vi, oi: allOptions[0].oi };
      }
    }
  }

  if (!chosen || chosen === 'ambiguous') {
    return { kind: 'none' };
  }

  return { kind: 'option', vi: chosen.vi, oi: chosen.oi };
};

const getStockAtSlot = (product, slot) => {
  if (slot.kind === 'root') {
    return Number(product.stock || 0);
  }
  if (slot.kind === 'option') {
    const opt = product.variants[slot.vi]?.options?.[slot.oi];
    return Number(opt?.stock ?? 0);
  }
  return 0;
};

const setStockAtSlot = (product, slot, value) => {
  const next = Math.max(0, Math.floor(Number(value)));
  if (slot.kind === 'root') {
    product.stock = next;
    return;
  }
  if (slot.kind === 'option') {
    const row = product.variants[slot.vi];
    if (!row || !Array.isArray(row.options) || !row.options[slot.oi]) {
      throw new Error('Invalid variant slot');
    }
    row.options[slot.oi].stock = next;
    syncAggregateStock(product);
  }
};

/**
 * Apply a validated deduction (must not go negative).
 */
const applyDeduction = (product, slot, qty) => {
  const deduct = Math.floor(Number(qty));
  const available = getStockAtSlot(product, slot);
  const next = available - deduct;
  if (next < 0) {
    throw new Error('Stock would go negative');
  }
  setStockAtSlot(product, slot, next);
};

module.exports = {
  norm,
  getStructuredVariants,
  resolveStockSlot,
  getStockAtSlot,
  setStockAtSlot,
  applyDeduction,
  productLabel,
  slotKey
};
