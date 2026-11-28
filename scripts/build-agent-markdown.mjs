// Builds the markdown alternates agents receive for Accept: text/markdown.
// Copy comes from the same i18n JSON, Astro legal pages, and visible strings
// in the components. Nothing here is paraphrased into a new claim.
//
// astro.config.mjs calls this on every Astro build, because Vercel may run
// `astro build` directly and skip package.json scripts.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const HTML_PATHS = [
  '/de',
  '/en',
  '/de/impressum',
  '/en/impressum',
  '/de/privacy',
  '/en/privacy',
  '/de/terms',
  '/en/terms',
  '/de/data-deletion',
  '/en/data-deletion',
];

const LEGAL_FILES = {
  '/de/impressum': 'src/pages/de/impressum.astro',
  '/en/impressum': 'src/pages/en/impressum.astro',
  '/de/privacy': 'src/pages/de/privacy.astro',
  '/en/privacy': 'src/pages/en/privacy.astro',
  '/de/terms': 'src/pages/de/terms.astro',
  '/en/terms': 'src/pages/en/terms.astro',
  '/de/data-deletion': 'src/pages/de/data-deletion.astro',
  '/en/data-deletion': 'src/pages/en/data-deletion.astro',
};

const STATUS_LABELS = {
  de: { done: 'Fertig', 'in-progress': 'In Arbeit', planned: 'Geplant' },
  en: { done: 'Done', 'in-progress': 'In progress', planned: 'Planned' },
};

const STATS = {
  de: [
    [1, 'Thema als Quelle'],
    [6, 'Content-Formate'],
    [7, 'Plattformen angebunden'],
    [24, 'Stunden am Tag in Betrieb'],
  ],
  en: [
    [1, 'Topic as the source'],
    [6, 'Content formats'],
    [7, 'Platforms connected'],
    [24, 'Hours a day in operation'],
  ],
};

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function write(rel, contents) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

function decode(value) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function squash(value) {
  return value.replace(/[ \t]+/g, ' ').trim();
}

function stripTags(value) {
  return value.replace(/<[^>]+>/g, '');
}

function inline(html) {
  let s = html.replace(/<br\s*\/?>\s*/gi, '\n');
  s = s.replace(/<a\s+[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, text) => {
    const label = squash(stripTags(decode(text)));
    return `[${label}](${decode(href).trim()})`;
  });
  s = s.replace(/<strong>([\s\S]*?)<\/strong>/gi, (_, text) => `**${squash(stripTags(decode(text)))}**`);
  s = stripTags(s);
  s = decode(s);
  return s
    .split('\n')
    .map((line) => squash(line))
    .join('\n')
    .trim();
}

function htmlBlock(html) {
  const re = /<(h2|p|ul)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  const parts = [];
  let match;
  while ((match = re.exec(html))) {
    const tag = match[1].toLowerCase();
    const inner = match[2];
    if (tag === 'h2') parts.push(`## ${inline(inner)}`);
    else if (tag === 'p') parts.push(inline(inner));
    else {
      const items = [...inner.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((item) => `- ${inline(item[1])}`);
      if (!items.length) throw new Error('Legal list had no items');
      parts.push(items.join('\n'));
    }
  }
  if (!parts.length) throw new Error('Legal HTML produced no blocks');
  return parts.join('\n\n');
}

function extractLegal(source, file) {
  const h1 = source.match(/<h1>([\s\S]*?)<\/h1>/);
  const date = source.match(/<p class="legal-date">([\s\S]*?)<\/p>/);
  const body = source.match(/<div class="legal-body">([\s\S]*?)<\/div>/);
  if (!h1 || !body) throw new Error(`Could not read legal page ${file}`);
  return {
    h1: inline(h1[1]),
    date: date ? inline(date[1]) : '',
    body: htmlBlock(body[1]),
  };
}

function frontmatter({ title, description }) {
  return ['---', `title: ${JSON.stringify(title)}`, `description: ${JSON.stringify(description)}`, 'image: "https://prizma.to/og-image.png"', '---', ''].join('\n');
}

function extractShowcaseCalls(source) {
  const re = /L\(\s*'((?:\\'|[^'])*)'\s*,\s*'((?:\\'|[^'])*)'\s*,\s*'((?:\\'|[^'])*)'\s*\)/g;
  const calls = [];
  let match;
  while ((match = re.exec(source))) {
    calls.push({
      de: match[1].replace(/\\'/g, "'"),
      en: match[2].replace(/\\'/g, "'"),
    });
  }
  if (calls.length !== 22) {
    throw new Error(`Showcase.astro L() count is ${calls.length}, expected 22. Update the markdown grouper.`);
  }
  if (calls[0].de !== 'Online-Handel' || !calls[4].de.includes('19.000') || !calls[4].de.includes('274')) {
    throw new Error('Showcase.astro case copy moved. Update the markdown grouper.');
  }
  if (calls[20].de !== 'Karussell' || calls[21].de !== 'Ton an') {
    throw new Error('Showcase.astro trailing UI strings moved. Update the markdown grouper.');
  }
  return calls;
}

function showcaseSection(calls, lang) {
  const pick = (index) => calls[index][lang];
  const blocks = [];

  function addCase(start, hasPractice) {
    const tab = pick(start);
    const name = pick(start + 1);
    const place = pick(start + 2);
    let cursor = start + 3;
    let practice = null;
    if (hasPractice) {
      practice = { title: pick(cursor), text: pick(cursor + 1) };
      cursor += 2;
    }
    const captions = [pick(cursor), pick(cursor + 1), pick(cursor + 2)];
    blocks.push(`### ${tab} — ${name} (${place})`);
    if (practice) blocks.push('', `**${practice.title}**`, '', practice.text);
    for (const caption of captions) blocks.push('', `- ${caption}`);
    blocks.push('');
  }

  addCase(0, true);
  addCase(8, false);
  addCase(14, false);
  return blocks.join('\n').trim();
}

function bulletList(items) {
  return items.map((item) => `- ${item}`).join('\n');
}

function renderHome(t, lang, { title, description, canonical, showcase, roadmapSource }) {
  const h1 = t.hero.h1 || t.hero.slogan;
  const lines = [frontmatter({ title, description }), `# ${h1}`];
  if (t.hero.h1) lines.push('', t.hero.slogan);
  lines.push(
    '',
    t.hero.subtitle,
    '',
    `[${t.hero.cta_primary}](tel:+4952196377655)`,
    '',
    `[${t.hero.cta_secondary}](${canonical}#contact)`,
    '',
    t.hero.phone_hint,
    '',
    `## ${t.visual_demo.heading}`,
    '',
    `## ${t.modules.heading}`,
    '',
    t.modules.subheading,
    '',
  );
  for (const item of t.modules.items) {
    lines.push(`### ${item.name}`, '', item.desc, '');
  }

  lines.push(`## ${t.why.heading}`, '', t.why.text, '');
  for (const stat of t.why.stats) lines.push(`- ${stat.value} — ${stat.label}`);
  lines.push('');
  for (const [value, label] of STATS[lang]) lines.push(`- ${value} — ${label}`);

  lines.push('', `## ${t.how.heading}`, '');
  t.how.steps.forEach((step, index) => {
    lines.push(`### ${index + 1}. ${step.title}`, '', step.desc, '');
  });

  lines.push(`## ${t.showcase.heading}`, '', t.showcase.subtitle, '', showcaseSection(showcase, lang), '');

  lines.push(`## ${t.for_whom.heading}`, '');
  for (const item of t.for_whom.items) lines.push(`### ${item.title}`, '', item.desc, '');

  lines.push(`## ${t.pricing.heading}`, '', t.pricing.lead, '');
  for (const item of t.pricing.items) lines.push(`### ${item.label}: ${item.amount}`, '', item.desc, '');
  lines.push(t.pricing.note, '');

  const pill = roadmapSource.match(/Roadmap 2026.2027/);
  if (!pill) throw new Error('Roadmap pill text missing');
  lines.push(`## ${t.roadmap.heading}`, '', pill[0], '', t.roadmap.subtitle, '');
  for (const phase of t.roadmap.phases) {
    const status = STATUS_LABELS[lang][phase.status];
    if (!status) throw new Error(`Unknown roadmap status ${phase.status}`);
    lines.push(`### ${phase.date} — ${status}: ${phase.title}`, '');
    for (const item of phase.items) lines.push(`- **${item.label}.** ${item.desc}`);
    lines.push('');
  }
  lines.push(`### ${t.roadmap.cta_title}`, '', t.roadmap.cta_desc, '', t.roadmap.cta_btn, '');

  lines.push(`## ${t.trust.heading}`, '', t.trust.lead, '');
  for (const item of t.trust.items) lines.push(`### ${item.title}`, '', item.desc, '');

  if (t.faq?.items?.length && lang === 'de') {
    lines.push(`## ${t.faq.heading}`, '');
    for (const item of t.faq.items) lines.push(`### ${item.q}`, '', item.a, '');
  }

  lines.push(`## ${t.sofie.name} (${t.sofie.role})`, '', t.sofie.text, '');
  lines.push(`## ${t.cta.heading}`, '', t.cta.subtitle, '');
  lines.push(`### ${t.cta.contacts.heading}`, '');
  lines.push(`- ${t.cta.contacts.phone}: [+49 521 96377655](tel:+4952196377655)`);
  lines.push(`- ${t.cta.contacts.email}: [contact@digitalkin.co](mailto:contact@digitalkin.co)`);
  lines.push(`- ${t.cta.contacts.location}: ${t.cta.contacts.location_value}`);
  lines.push(`- ${t.cta.contacts.languages}: ${t.cta.contacts.languages_value}`);
  lines.push('', t.cta.privacy, '');

  const prefix = `/${lang}`;
  const privacy = lang === 'de' ? 'Datenschutz' : 'Privacy Policy';
  const terms = lang === 'de' ? 'Nutzungsbedingungen' : 'Terms of Use';
  const product = lang === 'de' ? 'Ein Produkt von [Digitalkin AI](https://digitalkin.co)' : 'A product by [Digitalkin AI](https://digitalkin.co)';
  lines.push(
    '## ' + (lang === 'de' ? 'Seiten' : 'Pages'),
    '',
    bulletList([
      `[${privacy}](${prefix}/privacy)`,
      `[${terms}](${prefix}/terms)`,
      `[Impressum](${prefix}/impressum)`,
      product,
    ]),
    '',
    t.footer.copyright,
    '',
  );

  if (lang === 'de') lines.push(jsonLdBlock(t), '');

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

function jsonLdBlock(t) {
  const countries = [
    { '@type': 'Country', name: 'Germany' },
    { '@type': 'Country', name: 'Austria' },
    { '@type': 'Country', name: 'Switzerland' },
  ];
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': 'https://prizma.to/#organization',
        name: 'PRIZMA',
        url: 'https://prizma.to',
        logo: 'https://prizma.to/favicon.png',
        email: 'contact@digitalkin.co',
        telephone: '+49-521-96377655',
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Bielefeld',
          addressCountry: 'DE',
        },
        areaServed: countries,
        contactPoint: {
          '@type': 'ContactPoint',
          telephone: '+49-521-96377655',
          email: 'contact@digitalkin.co',
          contactType: 'customer service',
          areaServed: countries,
          availableLanguage: ['German', 'English', 'Russian'],
        },
      },
      {
        '@type': 'Service',
        '@id': 'https://prizma.to/#service',
        name: 'Content-Produktion als Service',
        serviceType: 'Content-Produktion und Veröffentlichung in sozialen Netzwerken',
        description:
          'PRIZMA erstellt aus Produktdaten Beiträge, Reels, Karussells, Stories, Blog-Artikel und KI-Avatar-Videos und veröffentlicht sie nach Plan auf den vereinbarten Kanälen. Einrichtung und Betrieb sind enthalten. Der Umfang pro Monat ist fest vereinbart.',
        url: 'https://prizma.to/de',
        provider: { '@id': 'https://prizma.to/#organization' },
        areaServed: countries,
        availableLanguage: ['de', 'en', 'ru'],
        offers: [
          {
            '@type': 'Offer',
            name: 'Einrichtung',
            description:
              'ab 900 € einmalig. Analyse der Tonalität, Anbindung der Kanäle und erste Inhalte zur Abstimmung. Zzgl. gesetzlicher Umsatzsteuer.',
            priceCurrency: 'EUR',
            priceSpecification: {
              '@type': 'PriceSpecification',
              minPrice: 900,
              priceCurrency: 'EUR',
              valueAddedTaxIncluded: false,
            },
          },
          {
            '@type': 'Offer',
            name: 'Betrieb',
            description:
              'ab 490 € pro Monat. Erstellung und Veröffentlichung sind enthalten, freigegeben nach Ihren Regeln. Der Preis hängt von Menge, Formaten, Kanälen und Sprachen ab. Zzgl. gesetzlicher Umsatzsteuer.',
            priceCurrency: 'EUR',
            priceSpecification: {
              '@type': 'UnitPriceSpecification',
              minPrice: 490,
              priceCurrency: 'EUR',
              unitCode: 'MON',
              valueAddedTaxIncluded: false,
            },
          },
        ],
      },
      {
        '@type': 'FAQPage',
        '@id': 'https://prizma.to/de#faq',
        url: 'https://prizma.to/de',
        inLanguage: 'de',
        mainEntity: t.faq.items.map((item) => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a },
        })),
      },
    ],
  };
  return ['```json', JSON.stringify(graph, null, 2), '```'].join('\n');
}

function renderLegal(source, file, t, urlPath) {
  const legal = extractLegal(source, file);
  const key = urlPath.slice(urlPath.lastIndexOf('/') + 1);
  const seo = t.seo_legal && t.seo_legal[key];
  if (!seo) throw new Error(`Missing seo_legal.${key} for ${urlPath}`);
  const lines = [
    frontmatter({ title: seo.title, description: seo.description }),
    `# ${legal.h1}`,
    '',
  ];
  if (legal.date) lines.push(legal.date, '');
  lines.push(legal.body, '');
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

function assertSources() {
  const stats = read('src/components/Stats.astro');
  for (const labels of Object.values(STATS)) {
    for (const [, label] of labels) {
      if (!stats.includes(label)) throw new Error(`Stats label missing from the page: ${label}`);
    }
  }
  const roadmap = read('src/components/Roadmap.astro');
  for (const labels of Object.values(STATUS_LABELS)) {
    for (const label of Object.values(labels)) {
      if (!roadmap.includes(label)) throw new Error(`Roadmap status missing from the page: ${label}`);
    }
  }
  const footer = read('src/components/Footer.astro');
  for (const phrase of ['Ein Produkt von ', 'A product by ', 'https://digitalkin.co']) {
    if (!footer.includes(phrase)) throw new Error(`Footer phrase missing: ${phrase}`);
  }
  const faq = read('src/components/Faq.astro');
  if (!faq.includes('Content-Produktion als Service')) {
    throw new Error('FAQ JSON-LD changed. Update the markdown JSON-LD block.');
  }
  const robots = read('public/robots.txt');
  if (!robots.includes('Content-Signal: search=yes, ai-input=yes, ai-train=yes')) {
    throw new Error('robots.txt is missing the Content-Signal line');
  }
  if (!robots.includes('Sitemap: https://prizma.to/sitemap.xml')) {
    throw new Error('robots.txt lost its Sitemap line');
  }
  const vercel = JSON.parse(read('vercel.json'));
  const rewriteSources = new Set((vercel.rewrites || []).map((rule) => rule.source));
  const headerSources = new Set((vercel.headers || []).map((rule) => rule.source));
  for (const page of HTML_PATHS) {
    for (const source of [page, `${page}/`]) {
      if (!rewriteSources.has(source)) throw new Error(`vercel.json rewrite missing for ${source}`);
      if (!headerSources.has(source)) throw new Error(`vercel.json Link header missing for ${source}`);
    }
    if (!headerSources.has(`${page}.md`)) throw new Error(`vercel.json markdown header missing for ${page}.md`);
  }
  const redirect = (vercel.redirects || []).find((rule) => rule.source === '/' && rule.destination === '/de' && rule.statusCode === 301);
  if (!redirect) throw new Error('The / → /de 301 is missing from vercel.json');
  const middleware = read('middleware.js');
  for (const page of HTML_PATHS) {
    if (!middleware.includes(`'${page}'`) || !middleware.includes(`'${page}/'`)) {
      throw new Error(`middleware matcher missing ${page}`);
    }
  }
}

function assertMarkdown(pages) {
  const de = pages['/de'].body;
  for (const phrase of [
    'Was ist PRIZMA?',
    'ab 900 € einmalig',
    'ab 490 € pro Monat',
    'Häufige Fragen',
    '274 veröffentlichte Inhalte',
    'contact@digitalkin.co',
    'Bielefeld, Deutschland',
    '+49 521 96377655',
    'Content-Produktion als Service',
  ]) {
    if (!de.includes(phrase)) throw new Error(`German markdown is missing a page fact: ${phrase}`);
  }
  if (de.includes('Bleicherfeldstraße')) {
    throw new Error('German homepage markdown includes the imprint street address, which is not on that page');
  }
  if (!pages['/en'].body.includes('from €490 per month') || !pages['/en'].body.includes('from €900 one-off')) {
    throw new Error('English markdown is missing the published prices');
  }
  if (pages['/en'].body.includes('## Häufige Fragen') || pages['/en'].body.includes('```json')) {
    throw new Error('English page markdown includes German FAQ or JSON-LD that the English page does not render');
  }
  if (!pages['/en'].body.startsWith('---\ntitle: "Done-for-you content from your product catalog | PRIZMA"')) {
    throw new Error('English homepage markdown is missing its international title');
  }
  if (pages['/en'].body.includes('Content production as a service for online retailers')) {
    throw new Error('English homepage markdown is still using the literal translation as its title');
  }
  const impressum = pages['/de/impressum'].body;
  for (const phrase of ['Igor Zelikovsky', 'Bleicherfeldstraße 31', '§ 5 DDG', '33689 Bielefeld']) {
    if (!impressum.includes(phrase)) throw new Error(`German imprint markdown is missing: ${phrase}`);
  }
  const privacy = pages['/de/privacy'].body;
  for (const phrase of ['DeepSeek', 'Art. 28 DSGVO', '[Datenlöschung](/de/data-deletion)']) {
    if (!privacy.includes(phrase)) throw new Error(`German privacy markdown is missing: ${phrase}`);
  }
  if (!pages['/en/privacy'].body.includes('[German version](/de/privacy)')) {
    throw new Error('English privacy markdown lost the link to the German version');
  }
}

export function generateAgentMarkdown() {
  const de = JSON.parse(read('src/i18n/de.json'));
  const en = JSON.parse(read('src/i18n/en.json'));
  const showcase = extractShowcaseCalls(read('src/components/Showcase.astro'));
  const roadmapSource = read('src/components/Roadmap.astro');

  const bodies = {
    '/de': renderHome(de, 'de', {
      title: de.seo_home.title,
      description: de.seo_home.description,
      canonical: 'https://prizma.to/de',
      showcase,
      roadmapSource,
    }),
    '/en': renderHome(en, 'en', {
      title: en.seo_home.title,
      description: en.seo_home.description,
      canonical: 'https://prizma.to/en',
      showcase,
      roadmapSource,
    }),
  };

  for (const [urlPath, file] of Object.entries(LEGAL_FILES)) {
    const lang = urlPath.startsWith('/de/') ? de : en;
    bodies[urlPath] = renderLegal(read(file), file, lang, urlPath);
  }

  const pages = {};
  for (const [urlPath, body] of Object.entries(bodies)) {
    if (!body.endsWith('\n')) throw new Error(`Markdown for ${urlPath} is missing a trailing newline`);
    pages[urlPath] = {
      body,
      tokens: Math.ceil(Buffer.byteLength(body, 'utf8') / 4),
    };
    write(`public${urlPath}.md`, body);
  }

  const module = `// Generated by scripts/build-agent-markdown.mjs. Do not edit by hand.\nexport const pages = ${JSON.stringify(pages, null, 2)};\n`;
  write('lib/agent-pages.js', module);

  assertSources();
  assertMarkdown(pages);
  return pages;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const pages = generateAgentMarkdown();
  const paths = Object.keys(pages);
  console.log(`Wrote ${paths.length} markdown alternates (${paths.join(', ')})`);
}
