'use strict';

const DAY = 24 * 60 * 60 * 1000;

function normalize(value, maxLength = 80) {
  return typeof value === 'string' ? value.trim().toLowerCase().slice(0, maxLength) : '';
}

function words(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && word.length <= 36)
    .slice(0, 24);
}

function priceBand(cents) {
  if (cents < 5000) return 'under-50';
  if (cents < 15000) return '50-150';
  if (cents < 30000) return '150-300';
  return 'over-300';
}

function scoreShopFeedback(piece, feedback, now = Date.now()) {
  const category = normalize(piece.category);
  const color = normalize(piece.color);
  const brand = normalize(piece.brandId || piece.brand);
  const material = normalize(piece.material);
  const band = priceBand(Number(piece.listPriceCents) || 0);
  const candidateTerms = new Set(words(`${piece.name} ${piece.notes} ${piece.category} ${piece.color} ${piece.brand} ${piece.material}`));
  let score = 0;
  for (const item of Object.values(feedback || {})) {
    if (!item || !Number.isFinite(Number(item.createdAt))) continue;
    const ageDays = Math.max(0, (now - Number(item.createdAt)) / DAY);
    const recency = Math.pow(0.5, ageDays / 90);
    const direction = item.choice === 'interested' ? 1 : -1;
    if (item.listingId === piece.id) score += direction * 10 * recency;
    if (item.category && item.category === category) score += direction * 4.2 * recency;
    if (item.brand && item.brand === brand) score += direction * 3.4 * recency;
    if (item.color && item.color === color) score += direction * 1.8 * recency;
    if (item.material && item.material === material) score += direction * 1.2 * recency;
    if (item.priceBand && item.priceBand === band) score += direction * 0.55 * recency;
    const terms = Array.isArray(item.terms) ? item.terms : [];
    const overlap = terms.reduce((count, term) => count + (candidateTerms.has(term) ? 1 : 0), 0);
    score += direction * Math.min(4, overlap) * 0.35 * recency;
  }
  return Math.max(-48, Math.min(48, score));
}

function filterNotInterestedListings(pieces, feedback) {
  const avoid = new Set(
    Object.values(feedback || {})
      .filter((item) => item && item.choice === 'not_interested')
      .map((item) => item.listingId),
  );
  const preferred = pieces.filter((piece) => !avoid.has(piece.id));
  return preferred.length ? preferred : pieces;
}

module.exports = { scoreShopFeedback, filterNotInterestedListings };
