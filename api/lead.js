// Anonymous lead counter. POST {event, path, href}. Always 204, no cookies.
// Events: calendly | tel | mailto | form_submit.

import { recordLead } from '../lib/record-lead.js';

function readJson(body) {
  if (body == null) return null;
  if (Buffer.isBuffer(body)) {
    try {
      return JSON.parse(body.toString('utf8'));
    } catch {
      return null;
    }
  }
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  }
  if (typeof body === 'object') return body;
  return null;
}

export default async function handler(req, res) {
  try {
    if (req.method === 'POST') {
      const body = readJson(req.body);
      if (body) {
        await recordLead({
          event: body.event,
          path: body.path,
          href: body.href,
          userAgent: req.headers?.['user-agent'] || '',
        });
      }
    }
  } catch (err) {
    console.error(`[lead] ${err}`);
  }
  res.status(204).end();
}
