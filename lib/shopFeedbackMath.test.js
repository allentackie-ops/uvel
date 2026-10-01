'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreShopFeedback, filterNotInterestedListings } = require('./shopFeedbackMath');

const now = 1_800_000_000_000;
const signal = (listingId, choice, fields = {}) => ({
  listingId,
  choice,
  createdAt: now,
  category: 'jacket',
  color: 'navy',
  brand: 'atelier one',
  material: 'wool',
  priceBand: '150-300',
  terms: ['tailored', 'jacket'],
  ...fields,
});
const listing = (overrides = {}) => ({
  id: 'listing-2', name: 'Tailored wool jacket', notes: '', category: 'Jacket', color: 'Navy',
  brand: 'Atelier One', brandId: '', material: 'Wool', listPriceCents: 20000, ...overrides,
});

test('not-interested removes that exact listing while other candidates remain', () => {
  const a = listing({ id: 'disliked' });
  const b = listing({ id: 'other', brand: 'Another label' });
  const result = filterNotInterestedListings([a, b], { disliked: signal('disliked', 'not_interested') });
  assert.deepEqual(result.map((item) => item.id), ['other']);
});

test('keeps a fallback catalog if every current listing has been marked not interested', () => {
  const items = [listing({ id: 'one' }), listing({ id: 'two' })];
  const feedback = {
    one: signal('one', 'not_interested'),
    two: signal('two', 'not_interested'),
  };
  assert.deepEqual(filterNotInterestedListings(items, feedback), items);
});

test('interested feedback boosts similar listings above unrelated listings', () => {
  const similar = listing({ id: 'similar' });
  const unrelated = listing({ id: 'unrelated', category: 'Dress', color: 'Red', brand: 'Other', material: 'Silk', listPriceCents: 8000 });
  const feedback = { liked: signal('liked', 'interested') };
  assert.ok(scoreShopFeedback(similar, feedback, now) > scoreShopFeedback(unrelated, feedback, now));
});

test('not-interested feedback downranks similar listings', () => {
  const similar = listing({ id: 'similar' });
  const unrelated = listing({ id: 'unrelated', category: 'Dress', color: 'Red', brand: 'Other', material: 'Silk', listPriceCents: 8000 });
  const feedback = { disliked: signal('disliked', 'not_interested') };
  assert.ok(scoreShopFeedback(similar, feedback, now) < scoreShopFeedback(unrelated, feedback, now));
});

test('similarity influence decays by half after ninety days', () => {
  const candidate = listing({ id: 'candidate' });
  const recent = { source: signal('source', 'interested') };
  const old = { source: signal('source', 'interested', { createdAt: now - 90 * 24 * 60 * 60 * 1000 }) };
  assert.ok(Math.abs(scoreShopFeedback(candidate, old, now) - scoreShopFeedback(candidate, recent, now) / 2) < 0.001);
});
