// Turns scraped HTML into clean plain text and repairs the bullet mangling
// that LinkedIn's rendered output produces (repeated "1." markers, collapsed newlines).

export function htmlToText(html) {
  if (!html) return "";
  let t = html;
  t = t.replace(/<script[\s\S]*?<\/script>/gi, " ");
  t = t.replace(/<style[\s\S]*?<\/style>/gi, " ");
  t = t.replace(/<br\s*\/?>/gi, "\n");
  t = t.replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n");
  t = t.replace(/<li[^>]*>/gi, "\n- ");
  t = t.replace(/<[^>]+>/g, " ");
  t = decodeEntities(t);
  return normalizeText(t);
}

export function decodeEntities(s) {
  const map = {
    "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'",
    "&apos;": "'", "&nbsp;": " ", "&rsquo;": "'", "&lsquo;": "'",
    "&rdquo;": '"', "&ldquo;": '"', "&ndash;": "-", "&mdash;": "-", "&bull;": "-",
  };
  return s
    .replace(/&[a-z]+;|&#\d+;/gi, m => {
      if (map[m]) return map[m];
      const num = m.match(/&#(\d+);/);
      if (num) { try { return String.fromCharCode(+num[1]); } catch { return " "; } }
      return " ";
    });
}

export function normalizeText(t) {
  return t
    // collapse the "1. 1. 1." artifact from rendered ordered lists
    .replace(/(?:^|\n)\s*\d+\.\s*(?=\d+\.)/g, "\n")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2022/g, "-")
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n").map(l => l.trim()).join("\n")
    .trim();
}
