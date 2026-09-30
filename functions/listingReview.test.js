'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { _listingReviewTestHelpers: review } = require('./listingReview');

test('AI confidence cutoff rejects exactly 40% and above, but not below', () => {
  assert.equal(review.aiConfidence({ report: { ai_generated: { ai: { confidence: 0.399 } } } }), 0.399);
  assert.equal(review.rejectionAtThreshold(0.399), false);
  assert.equal(review.rejectionAtThreshold(0.4), true);
  assert.equal(review.rejectionAtThreshold(0.401), true);
});

test('AI confidence parser fails closed if the provider omits its documented score', () => {
  assert.throws(() => review.aiConfidence({ report: { ai_generated: { verdict: 'ai' } } }), /confidence score/);
  assert.throws(() => review.aiConfidence({ report: { ai_generated: { ai: { confidence: 40 } } } }), /confidence score/);
});

test('the same photo re-encoded at lower JPEG quality remains a high-confidence duplicate', async () => {
  const original = await sharp({ create: { width: 320, height: 400, channels: 3, background: '#fafafa' } })
    .composite([{ input: { create: { width: 170, height: 240, channels: 3, background: '#111111' } }, left: 75, top: 75 }])
    .jpeg({ quality: 95 }).toBuffer();
  const reencoded = await sharp(original).resize(640, 800).jpeg({ quality: 68 }).toBuffer();
  const first = await review.fingerprintImage(original);
  const second = await review.fingerprintImage(reencoded);
  assert.notEqual(first.sha256, second.sha256);
  assert.equal(review.isHighConfidenceSameImage(first, second), true);
});

test('similar but materially different photo pixels are not enough to reject', async () => {
  const make = async (color, left) => sharp({ create: { width: 320, height: 400, channels: 3, background: '#fafafa' } })
    .composite([{ input: { create: { width: 90, height: 220, channels: 3, background: color } }, left, top: 80 }])
    .jpeg({ quality: 92 }).toBuffer();
  const first = await review.fingerprintImage(await make('#111111', 60));
  const different = await review.fingerprintImage(await make('#111111', 165));
  assert.equal(review.isHighConfidenceSameImage(first, different), false);
});
