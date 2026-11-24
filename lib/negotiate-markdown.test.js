import assert from 'node:assert/strict';
import test from 'node:test';
import { prefersMarkdown } from './negotiate-markdown.js';

const BROWSER =
  'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8';

test('markdown-only accept', () => {
  assert.equal(prefersMarkdown('text/markdown'), true);
  assert.equal(prefersMarkdown('text/markdown; charset=utf-8'), true);
  assert.equal(prefersMarkdown('TEXT/MARKDOWN'), true);
});

test('browsers stay on HTML', () => {
  assert.equal(prefersMarkdown(BROWSER), false);
  assert.equal(prefersMarkdown('text/html'), false);
  assert.equal(prefersMarkdown('*/*'), false);
  assert.equal(prefersMarkdown(null), false);
  assert.equal(prefersMarkdown(''), false);
});

test('q-values', () => {
  assert.equal(prefersMarkdown('text/markdown, text/html;q=0.9, */*;q=0.8'), true);
  assert.equal(prefersMarkdown('text/html, text/markdown;q=0.1'), false);
  assert.equal(prefersMarkdown('text/markdown;q=0, text/html'), false);
  assert.equal(prefersMarkdown('text/html;q=1, text/markdown;q=1'), true);
});
