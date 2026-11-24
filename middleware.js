// Vercel Routing Middleware. Astro static files are served before vercel.json
// rewrites, so a header `has` rewrite cannot replace /de/index.html. This
// runs first: Accept: text/markdown gets the built markdown, every other
// request continues to the static HTML. The / → /de 301 is not matched here.

import { next } from '@vercel/functions';
import { pages } from './lib/agent-pages.js';
import { prefersMarkdown } from './lib/negotiate-markdown.js';

const SECURITY_HEADERS = [
  ['X-Content-Type-Options', 'nosniff'],
  ['X-Frame-Options', 'DENY'],
  ['X-XSS-Protection', '1; mode=block'],
  ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  ['Permissions-Policy', 'camera=(), microphone=(), geolocation=()'],
  ['Strict-Transport-Security', 'max-age=31536000; includeSubDomains'],
];

function normalize(pathname) {
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1);
  return pathname;
}

export default function middleware(request) {
  const method = request.method.toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') return next();

  const path = normalize(new URL(request.url).pathname);
  const page = pages[path];
  if (!page || !prefersMarkdown(request.headers.get('accept'))) return next();

  const headers = new Headers();
  for (const [key, value] of SECURITY_HEADERS) headers.set(key, value);
  headers.set('Content-Type', 'text/markdown; charset=utf-8');
  headers.set('Vary', 'Accept');
  headers.set('x-markdown-tokens', String(page.tokens));
  headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
  headers.set(
    'Link',
    `<${path}>; rel="canonical", </llms.txt>; rel="describedby"; type="text/plain", </sitemap.xml>; rel="sitemap"`,
  );

  return new Response(method === 'HEAD' ? null : page.body, { status: 200, headers });
}

export const config = {
  runtime: 'nodejs',
  matcher: [
    '/de',
    '/de/',
    '/en',
    '/en/',
    '/de/impressum',
    '/de/impressum/',
    '/en/impressum',
    '/en/impressum/',
    '/de/privacy',
    '/de/privacy/',
    '/en/privacy',
    '/en/privacy/',
    '/de/terms',
    '/de/terms/',
    '/en/terms',
    '/en/terms/',
    '/de/data-deletion',
    '/de/data-deletion/',
    '/en/data-deletion',
    '/en/data-deletion/',
  ],
};
