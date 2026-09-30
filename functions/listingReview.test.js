'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { _listingReviewTestHelpers: review } = require('./listingReview');

test('Claude estimate parser enforces the requested 40% rejection cutoff', () => {
  const scores = review.parseAiGeneratedScores({ photos: [
    { photoIndex: 0, probability: 0.399, evidence: 'No clear generation artifacts.' },
    { photoIndex: 1, probability: 0.4, evidence: 'Inconsistent garment seams and repeated texture.' },
    { photoIndex: 2, probability: 0.401, evidence: 'Malformed logo details and inconsistent structure.' },
  ] }, [0, 1, 2]);
  assert.equal(review.rejectionAtThreshold(scores[0].probability), false);
  assert.equal(review.rejectionAtThreshold(scores[1].probability), true);
  assert.equal(review.rejectionAtThreshold(scores[2].probability), true);
});

test('Claude estimate parser fails closed for omitted, duplicated, unexpected, or out-of-range scores', () => {
  assert.throws(() => review.parseAiGeneratedScores({ photos: [{ photoIndex: 0, probability: 0.1, evidence: 'No strong visual cues.' }] }, [0, 1]), /every photo/);
  assert.throws(() => review.parseAiGeneratedScores({ photos: [
    { photoIndex: 0, probability: 0.1, evidence: 'No strong visual cues.' },
    { photoIndex: 0, probability: 0.2, evidence: 'Repeated image patterns and impossible object shapes.' },
  ] }, [0]), /invalid per-photo estimate/);
  assert.throws(() => review.parseAiGeneratedScores({ photos: [{ photoIndex: 2, probability: 0.1, evidence: 'No strong visual cues.' }] }, [0]), /invalid per-photo estimate/);
  assert.throws(() => review.parseAiGeneratedScores({ photos: [{ photoIndex: 0, probability: 40, evidence: 'Many generation artifacts observed.' }] }, [0]), /invalid per-photo estimate/);
  assert.throws(() => review.parseAiGeneratedScores({ photos: [{ photoIndex: 0, probability: 0.8, evidence: 'No cue.' }] }, [0]), /invalid per-photo estimate/);
});

test('image classification calls the existing Claude vision endpoint and returns a per-photo estimate', async () => {
  const originalFetch = global.fetch;
  const photo = await sharp({ create: { width: 80, height: 100, channels: 3, background: '#ddd' } }).png().toBuffer();
  let request;
  global.fetch = async (url, options) => {
    request = { url: String(url), options };
    return {
      ok: true,
      json: async () => ({ content: [{ text: JSON.stringify({ photos: [{ photoIndex: 2, probability: 0.42, evidence: 'Inconsistent garment structure and incoherent repeated texture.' }] }) }] }),
    };
  };
  try {
    const result = await review.classifyAiGeneratedImages([{ photoIndex: 2, bytes: photo }], 'test-anthropic-key');
    assert.equal(request.url, 'https://api.anthropic.com/v1/messages');
    assert.equal(request.options.headers['x-api-key'], 'test-anthropic-key');
    assert.equal(JSON.parse(request.options.body).model, 'claude-sonnet-4-6');
    assert.equal(result[0].photoIndex, 2);
    assert.equal(result[0].probability, 0.42);
    assert.match(result[0].evidence, /garment structure/);
  } finally {
    global.fetch = originalFetch;
  }
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
