import { htmlToText, normalizeText } from "./normalize.mjs";

// Section headers that signal "these are the hard requirements" vs "bonus points".
const NICE_MARKERS = [
  "extra skills", "nice to have", "nice-to-have", "preferred qualification",
  "bonus", "set you apart", "desirable", "advantageous", "plus:", "good to have",
];
const MUST_MARKERS = [
  "what we", "looking for", "requirement", "qualification", "you will",
  "responsibilit", "must have", "must-have", "about you", "your profile",
  "skills", "experience", "role:", "in this role",
];
const STOP_MARKERS = [
  "we offer", "what we offer", "benefits", "hiring process", "about us",
  "about the company", "equal opportunity", "diversity", "perks",
  "referrals increase", "seniority level", "similar jobs", "people also viewed",
];

export function extractJob(raw, vocabulary) {
  const text = raw.html && /<[a-z]/i.test(raw.html) ? htmlToText(raw.html) : normalizeText(raw.html || "");

  const meta = raw.meta || {};
  const job = {
    url: raw.url,
    jobId: raw.jobId || null,
    source: raw.source,
    title: meta.title || firstMatch(text, /^#?\s*([A-Z][A-Za-z0-9 \/&,\-()]{4,80})$/m) || "",
    company: meta.company || "",
    location: meta.location || "",
    posted: meta.posted || "",
    applicants: null,
    seniority: "",
    employmentType: "",
    industry: "",
    yearsRequired: null,
    text,
  };

  // Company: the guest topcard renders it as a linked org name.
  if (!job.company) {
    const c = raw.html && raw.html.match(/topcard-org-name[^>]*>\s*([^<]{2,80}?)\s*</i);
    if (c) job.company = decodeBasic(c[1]);
  }
  if (!job.company) {
    const c = text.match(/^####\s+\[?([^\]\[\n]{2,80}?)\s*\]?\s*(?:\u00b7|\n|Bengaluru|Mumbai|Pune)/m);
    if (c) job.company = c[1].trim();
  }
  // Location: topcard usually reads "Company  City, State, Country  N weeks ago"
  if (!job.location) {
    const l = text.match(/([A-Z][A-Za-z\. ]+,\s*[A-Z][A-Za-z\. ]+,\s*[A-Z][A-Za-z\. ]+)/);
    if (l) job.location = l[1].trim();
  }

  // LinkedIn structured footer fields
  job.seniority = job.seniority || firstMatch(text, /Seniority level\s*\n?\s*([A-Za-z\- ]+)/i) || "";
  job.employmentType = job.employmentType || firstMatch(text, /Employment type\s*\n?\s*([A-Za-z\- ]+)/i) || "";
  job.industry = job.industry || firstMatch(text, /Industries\s*\n?\s*([A-Za-z&,\- ]+)/i) || "";
  const appl = text.match(/(Over\s+)?([\d,]+)\s+applicants/i);
  if (appl) job.applicants = parseInt(appl[2].replace(/,/g, ""), 10);
  if (/Over\s+[\d,]+\s+applicants/i.test(text)) job.applicantsPlus = true;

  // Years of experience: take the LOWEST floor mentioned (JDs often list several).
  const yearMatches = [...text.matchAll(/(\d{1,2})\s*\+?\s*(?:to\s*\d{1,2}\s*)?years?/gi)]
    .map(m => parseInt(m[1], 10))
    .filter(n => n >= 1 && n <= 25);
  if (yearMatches.length) job.yearsRequired = Math.min(...yearMatches);

  // Split into requirement lines, stopping at boilerplate (benefits, process, about-us).
  const lines = text.split("\n");
  const req = [];
  let capturing = false;
  for (const line of lines) {
    const low = line.toLowerCase();
    if (STOP_MARKERS.some(s => low.startsWith(s) || low === s)) { capturing = false; continue; }
    if (MUST_MARKERS.some(s => low.includes(s))) capturing = true;
    if (!line || line.length < 12) continue;
    if (capturing || /^-\s+/.test(line)) req.push(line.replace(/^-\s*/, ""));
  }
  job.requirementLines = dedupe(req).slice(0, 80);

  // Classify must-have vs nice-to-have by position relative to the "extra skills" marker.
  const lowText = text.toLowerCase();
  let niceIdx = -1;
  for (const m of NICE_MARKERS) {
    const i = lowText.indexOf(m);
    if (i > -1 && (niceIdx === -1 || i < niceIdx)) niceIdx = i;
  }
  job.niceSplitIndex = niceIdx;

  // Match vocabulary terms, recording whether each landed in the must or nice region.
  const found = new Map();
  for (const term of vocabulary) {
    const re = new RegExp(`(^|[^a-z0-9+#.])${escapeRe(term)}([^a-z0-9+#]|$)`, "i");
    const idx = lowText.search(re);
    if (idx > -1) {
      const isNice = niceIdx > -1 && idx > niceIdx;
      const prev = found.get(term);
      if (!prev || (prev.nice && !isNice)) found.set(term, { term, index: idx, nice: isNice });
    }
  }
  job.matchedTerms = [...found.values()].sort((a, b) => a.index - b.index);
  return job;
}

function decodeBasic(s) {
  return s.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
}
function firstMatch(text, re) {
  const m = text.match(re);
  return m ? m[1].trim() : "";
}
function dedupe(arr) {
  const seen = new Set();
  return arr.filter(x => { const k = x.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
}
function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

