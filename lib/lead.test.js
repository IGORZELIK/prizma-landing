import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { isBot, recordLead, sanitizeField } from './record-lead.js';
import leadHandler from '../api/lead.js';
import contactHandler from '../api/contact.js';

function leadLines(lines) {
  return lines
    .filter((line) => line.startsWith('{'))
    .map((line) => JSON.parse(line))
    .filter((row) => row.type === 'lead');
}

describe('lead counter', { concurrency: 1 }, () => {
  test('sanitize strips queries, fragments and caps length', () => {
    assert.equal(sanitizeField('/en?utm=1&email=ada@example.com#x'), '/en');
    assert.equal(
      sanitizeField('https://calendly.com/acme/intro?name=Ada&month=2026#book'),
      'https://calendly.com/acme/intro',
    );
    assert.equal(sanitizeField('mailto:contact@digitalkin.co?subject=Hello%20there'), 'mailto:contact@digitalkin.co');
    assert.equal(sanitizeField('tel:+4952196377655'), 'tel:+4952196377655');
    assert.equal(sanitizeField(''), '');
    assert.equal(sanitizeField(null), '');
    const long = `https://calendly.com/${'a'.repeat(300)}?secret=1`;
    assert.equal(sanitizeField(long).length, 200);
    assert.equal(sanitizeField(long).includes('secret'), false);
  });

  test('bot user agents are recognized', () => {
    assert.equal(isBot('Mozilla/5.0 (compatible; Googlebot/2.1)'), true);
    assert.equal(isBot('curl/8.5.0'), true);
    assert.equal(isBot('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0'), false);
    assert.equal(isBot(''), false);
  });

  test('recordLead logs one line and skips blob without a token', async () => {
    const lines = [];
    let puts = 0;
    await recordLead(
      { event: 'calendly', path: '/de?x=1', href: 'https://calendly.com/a/b?name=Ada', userAgent: 'Mozilla/5.0' },
      {
        env: {},
        log: (line) => lines.push(line),
        put: () => {
          puts += 1;
        },
      },
    );
    assert.equal(puts, 0);
    assert.equal(lines.length, 1);
    const row = JSON.parse(lines[0]);
    assert.deepEqual(Object.keys(row), ['type', 'site', 'event', 'path', 'href', 'ts']);
    assert.equal(row.type, 'lead');
    assert.equal(row.site, 'prizma.to');
    assert.equal(row.event, 'calendly');
    assert.equal(row.path, '/de');
    assert.equal(row.href, 'https://calendly.com/a/b');
    assert.equal(row.name, undefined);
    assert.equal(row.email, undefined);
    assert.match(row.ts, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  test('recordLead writes a private blob when the token exists', async () => {
    const calls = [];
    await recordLead(
      { event: 'form_submit', path: '/en', href: '', userAgent: 'Mozilla/5.0' },
      {
        env: { BLOB_READ_WRITE_TOKEN: 'blob-token' },
        log: () => {},
        random: () => 'abcd1234',
        put: async (pathname, body, options) => {
          calls.push({ pathname, body, options });
        },
      },
    );
    assert.equal(calls.length, 1);
    assert.match(
      calls[0].pathname,
      /^leads\/prizma\.to\/\d{4}-\d{2}-\d{2}\/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z-abcd1234\.json$/,
    );
    assert.equal(calls[0].options.access, 'private');
    assert.equal(calls[0].options.addRandomSuffix, false);
    assert.equal(calls[0].options.token, 'blob-token');
    assert.equal(calls[0].options.contentType, 'application/json');
    const stored = JSON.parse(calls[0].body);
    assert.deepEqual(Object.keys(stored).sort(), ['event', 'href', 'path', 'site', 'ts']);
    assert.equal(stored.event, 'form_submit');
    assert.equal(stored.href, '');
    assert.equal(stored.path, '/en');
  });

  test('recordLead drops bots, unknown events, and a failed blob write', async () => {
    const lines = [];
    await recordLead(
      { event: 'tel', path: '/de', href: 'tel:+4952196377655', userAgent: 'curl/8.5.0' },
      { env: { BLOB_READ_WRITE_TOKEN: 't' }, log: (line) => lines.push(line), put: () => {} },
    );
    await recordLead(
      { event: 'purchase', path: '/de', href: '/de', userAgent: 'Mozilla/5.0' },
      { env: {}, log: (line) => lines.push(line) },
    );
    await recordLead(
      { event: 'mailto', path: '/en/privacy', href: 'mailto:contact@digitalkin.co', userAgent: 'Mozilla/5.0' },
      {
        env: { BLOB_READ_WRITE_TOKEN: 't' },
        log: (line) => lines.push(line),
        put: async () => {
          throw new Error('blob down');
        },
      },
    );
    assert.equal(lines.length, 1);
    assert.equal(JSON.parse(lines[0]).event, 'mailto');
  });

  test('POST /api/lead is always 204 and stores no extra fields', async () => {
    const lines = [];
    const orig = console.log;
    console.log = (line) => lines.push(String(line));
    try {
      for (const req of [
        { method: 'GET', headers: {}, body: null },
        { method: 'POST', headers: { 'user-agent': 'curl/8.5.0' }, body: '{not json' },
        {
          method: 'POST',
          headers: { 'user-agent': 'Mozilla/5.0' },
          body: {
            event: 'tel',
            path: '/en?gclid=1',
            href: 'tel:+4952196377655?x=1',
            name: 'Ada Lovelace',
            email: 'ada@example.com',
          },
        },
      ]) {
        const res = { statusCode: 0, header: null, status(code) { this.statusCode = code; return this; }, setHeader(k, v) { this.header = `${k}:${v}`; return this; }, end() { this.ended = true; return this; } };
        await leadHandler(req, res);
        assert.equal(res.statusCode, 204);
        assert.equal(res.ended, true);
        assert.equal(res.header, null);
      }
    } finally {
      console.log = orig;
    }
    const leads = leadLines(lines);
    assert.equal(leads.length, 1);
    assert.equal(leads[0].event, 'tel');
    assert.equal(leads[0].path, '/en');
    assert.equal(leads[0].href, 'tel:+4952196377655');
    assert.equal(JSON.stringify(leads[0]).includes('Ada'), false);
    assert.equal(JSON.stringify(leads[0]).includes('ada@example.com'), false);
  });

  test('contact form still accepts a real send and logs a lead without name or email', async () => {
    const lines = [];
    const origLog = console.log;
    const origErr = console.error;
    const origFetch = globalThis.fetch;
    console.log = (...args) => lines.push(args.map(String).join(' '));
    console.error = () => {};
    process.env.TELEGRAM_BOT_TOKEN = 'test-token';
    process.env.TELEGRAM_CHAT_ID = '1';
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.TELEGRAM_TOPIC_ID;
    globalThis.fetch = async (url, init) => {
      assert.match(String(url), /^https:\/\/api\.telegram\.org\/bottest-token\/sendMessage$/);
      const sent = JSON.parse(init.body);
      assert.match(sent.text, /Ada Lovelace/);
      assert.match(sent.text, /ada@example.com/);
      return { ok: true, text: async () => '' };
    };
    try {
      const ok = mockRes();
      await contactHandler(
        {
          method: 'POST',
          headers: { 'user-agent': 'Mozilla/5.0', referer: 'https://prizma.to/en?utm=1&email=ada@example.com' },
          body: { name: 'Ada Lovelace', email: 'ada@example.com', company: 'Example', message: 'Hello', website: '' },
        },
        ok,
      );
      assert.equal(ok.statusCode, 200);
      assert.deepEqual(ok.body, { ok: true });

      const bad = mockRes();
      await contactHandler(
        { method: 'POST', headers: { 'user-agent': 'Mozilla/5.0' }, body: { name: '.', email: 'ada@example.com' } },
        bad,
      );
      assert.equal(bad.statusCode, 400);

      const honey = mockRes();
      await contactHandler(
        {
          method: 'POST',
          headers: { 'user-agent': 'Mozilla/5.0' },
          body: { name: 'Ada Lovelace', email: 'ada@example.com', website: 'https://spam.example' },
        },
        honey,
      );
      assert.equal(honey.statusCode, 200);

      globalThis.fetch = async () => ({ ok: false, status: 500, text: async () => 'nope' });
      const failed = mockRes();
      await contactHandler(
        {
          method: 'POST',
          headers: { 'user-agent': 'Mozilla/5.0', referer: 'https://prizma.to/de' },
          body: { name: 'Ada Lovelace', email: 'ada@example.com' },
        },
        failed,
      );
      assert.equal(failed.statusCode, 502);
    } finally {
      console.log = origLog;
      console.error = origErr;
      globalThis.fetch = origFetch;
      delete process.env.TELEGRAM_BOT_TOKEN;
      delete process.env.TELEGRAM_CHAT_ID;
    }

    const leads = leadLines(lines);
    assert.equal(leads.length, 1);
    assert.equal(leads[0].event, 'form_submit');
    assert.equal(leads[0].path, '/en');
    assert.equal(leads[0].href, '');
    assert.equal(JSON.stringify(leads[0]).includes('Ada'), false);
    assert.equal(JSON.stringify(leads[0]).includes('ada@example.com'), false);
    assert.equal(lines.some((line) => line.includes('[contact] sent: ada@example.com')), true);
  });
});

function mockRes() {
  return {
    statusCode: 0,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}
