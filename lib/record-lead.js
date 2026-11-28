// Cookieless lead log shared by /api/lead and the contact form.
// Stores event, path and href only. No name, email or other form fields.

import { randomBytes } from 'node:crypto';
import { put as blobPut } from '@vercel/blob';

const EVENTS = new Set(['calendly', 'tel', 'mailto', 'form_submit']);
const MAX_LEN = 200;

// Link-preview and crawler clients. A match is dropped, and the API still answers 204.
const BOT_UA =
  /bot|crawler|spider|slurp|mediapartners|facebookexternalhit|embedly|quora|pinterest|slackbot|whatsapp|telegrambot|discordbot|skypeuripreview|preview|lighthouse|headless|phantom|selenium|wget|curl\/|python-requests|go-http-client|axios\/|scrapy|ahrefs|semrush|mj12|dotbot|petalbot|bytespider|gptbot|claudebot|amazonbot|bingbot|googlebot|yandex|baidu|duckduck|applebot|ia_archiver/i;

export function isBot(userAgent) {
  if (!userAgent) return false;
  return BOT_UA.test(String(userAgent));
}

/** Drop the query string and fragment, then cap the length. */
export function sanitizeField(value) {
  if (value == null) return '';
  let raw = String(value).replace(/[\u0000-\u001F\u007F]/g, '').trim();
  if (!raw) return '';

  try {
    const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw);
    const url = new URL(raw, 'https://prizma.to');
    url.search = '';
    url.hash = '';
    if (!hasScheme && (raw.startsWith('/') || raw.startsWith('?'))) {
      raw = url.pathname;
    } else if (url.protocol === 'http:' || url.protocol === 'https:') {
      raw = `${url.origin}${url.pathname}`;
    } else {
      raw = url.toString();
    }
  } catch {
    raw = raw.split('?')[0].split('#')[0];
  }

  if (raw.length > MAX_LEN) raw = raw.slice(0, MAX_LEN);
  return raw;
}

/**
 * Log one lead. Writes a private blob only when BLOB_READ_WRITE_TOKEN is set.
 * Always prints a single JSON line. Never throws.
 */
export async function recordLead(input, deps = {}) {
  try {
    const env = deps.env || process.env;
    const log = deps.log || console.log;
    const put = deps.put || blobPut;
    const event = input && input.event;
    if (typeof event !== 'string' || !EVENTS.has(event)) return;
    if (isBot(input.userAgent)) return;

    const ts = new Date().toISOString();
    const record = {
      site: 'prizma.to',
      event,
      path: sanitizeField(input.path),
      href: sanitizeField(input.href),
      ts,
    };
    log(JSON.stringify({ type: 'lead', ...record }));

    const token = String(env.BLOB_READ_WRITE_TOKEN || '').trim();
    if (!token) return;

    const rand = (deps.random || (() => randomBytes(4).toString('hex')))();
    const day = ts.slice(0, 10);
    const pathname = `leads/prizma.to/${day}/${ts}-${rand}.json`;
    await put(pathname, JSON.stringify(record), {
      access: 'private',
      contentType: 'application/json',
      addRandomSuffix: false,
      token,
    });
  } catch (err) {
    console.error(`[lead] record failed: ${err}`);
  }
}
