// Content negotiation for Accept: text/markdown.
// A type with q=0 is not acceptable. When both HTML and Markdown are
// acceptable, Markdown wins only if its q is at least as high as HTML's.

export function prefersMarkdown(accept) {
  if (!accept || typeof accept !== 'string') return false;

  const types = [];
  for (const part of accept.split(',')) {
    const bits = part
      .trim()
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!bits.length) continue;

    const type = bits[0].toLowerCase();
    let q = 1;
    for (const bit of bits.slice(1)) {
      const match = /^q\s*=\s*([0-9]*\.?[0-9]+)$/i.exec(bit);
      if (match) q = Number(match[1]);
    }
    if (!Number.isFinite(q) || q <= 0) continue;
    types.push({ type, q });
  }

  const markdown = types.find((t) => t.type === 'text/markdown');
  if (!markdown) return false;

  const htmlQ = types
    .filter((t) => t.type === 'text/html' || t.type === 'application/xhtml+xml')
    .reduce((max, t) => Math.max(max, t.q), 0);

  return markdown.q >= htmlQ;
}
