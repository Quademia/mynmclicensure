// lib/announcements/sanitise.ts
//
// The body-HTML helpers every legacy announcement surface carried
// inline, one copy: newlinesToParagraphs (admin save and preview),
// sanitiseHtml (the same allow-list on the admin page, the student page
// and the dashboard strip — links keep href and data-qa and open in a
// new tab; images keep src and alt; anything else becomes its text),
// and the plain-text reduction the admin saved as body_text. They use
// the browser's DOM, as legacy did, so they run in client components
// only. Server code never renders a body; the client sanitises at
// render, as legacy's pages did, so a stored body is never trusted.

const ALLOWED = ['p', 'br', 'strong', 'em', 'b', 'i', 'ul', 'ol', 'li', 'a', 'code', 'img'];

export function newlinesToParagraphs(text: string): string {
  return text
    .split(/\n\n+/)
    .map((block) => {
      const inner = block.trim().replace(/\n/g, '<br>');
      if (!inner) return '';
      if (inner.startsWith('<')) return inner;
      return `<p>${inner}</p>`;
    })
    .filter(Boolean)
    .join('\n');
}

export function sanitiseHtml(raw: string): string {
  if (!raw) return '';
  if (typeof document === 'undefined') return '';
  const div = document.createElement('div');
  div.innerHTML = raw;

  function clean(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) return;
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    if (!ALLOWED.includes(tag)) {
      el.replaceWith(document.createTextNode(el.textContent || ''));
      return;
    }
    if (tag === 'a') {
      const href = el.getAttribute('href') || '';
      const dataQa = el.getAttribute('data-qa') || '';
      Array.from(el.attributes).forEach((attr) => el.removeAttribute(attr.name));
      if (href) el.setAttribute('href', href);
      if (dataQa) el.setAttribute('data-qa', dataQa);
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener');
    }
    if (tag === 'img') {
      const src = el.getAttribute('src') || '';
      const alt = el.getAttribute('alt') || '';
      Array.from(el.attributes).forEach((attr) => el.removeAttribute(attr.name));
      if (src) el.setAttribute('src', src);
      if (alt) el.setAttribute('alt', alt);
      el.style.maxWidth = '100%';
    }
    Array.from(el.childNodes).forEach(clean);
  }

  Array.from(div.childNodes).forEach(clean);
  return div.innerHTML;
}

// legacy: `tempDiv.innerHTML = bodyHtml; bodyText = tempDiv.textContent`
export function htmlToText(html: string): string {
  if (typeof document === 'undefined') return html;
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || '';
}
