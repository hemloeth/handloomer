// Minimal allowlist sanitizer for rich blog HTML (no extra dependency).
// Allows formatting produced by the tiptap StarterKit editor; strips
// scripts, event handlers, javascript: URLs and unsafe embeds/styles.
const ALLOWED_TAGS = new Set([
  "p", "h1", "h2", "h3", "h4", "strong", "b", "em", "i", "u", "s",
  "ul", "ol", "li", "blockquote", "br", "a",
]);
const HREF_RE = /^(https?:\/\/|mailto:|#|\/)/i;
export function sanitizeBlogHtml(html: string | null | undefined): string {
  if (!html || typeof html !== "string") return "";
  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const walk = (node: Element) => {
      for (const child of Array.from(node.querySelectorAll("*"))) {
        const tag = child.tagName.toLowerCase();
        if (!ALLOWED_TAGS.has(tag)) {
          // For dangerous containers drop with their content; else unwrap.
          if (child.querySelector("script, iframe, object, embed, form")) {
            child.remove();
            continue;
          }
          if (["script", "style", "iframe", "object", "embed", "form", "button", "input", "svg", "math", "link", "meta", "base"].includes(tag)) {
            child.remove();
            continue;
          }
          const parent = child.parentNode;
          if (parent) {
            for (const c of Array.from(child.childNodes)) parent.insertBefore(c, child);
            child.remove();
          }
          continue;
        }
        for (const attr of Array.from(child.attributes)) {
          const name = attr.name.toLowerCase();
          if (name.startsWith("on") || name === "style" || name === "srcdoc" || name === "formaction") {
            child.removeAttribute(attr.name);
          } else if (name === "href" && !HREF_RE.test(attr.value.trim())) {
            child.removeAttribute(attr.name);
          } else if (name !== "href" && name !== "target" && name !== "rel") {
            // Drop class/id/data-* to keep styles inert.
            child.removeAttribute(attr.name);
          }
        }
        if (tag === "a") {
          child.setAttribute("target", "_blank");
          child.setAttribute("rel", "noopener noreferrer");
        }
      }
    };
    walk(doc.body);
    return doc.body.innerHTML;
  }
  // Fallback (SSR without DOMParser): strip dangerous blocks + handlers.
  return html
    .replace(/<\s*(script|style|iframe|object|embed|form)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(href|src)\s*=\s*(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*')/gi, "")
    .replace(/<a\b([^>]*)>/gi, (m, attrs) => `<a${attrs} target="_blank" rel="noopener noreferrer">`);
}
