import { extractJob } from "./lib/extract.mjs";
import { scoreJob } from "./lib/score.mjs";
import { tailor } from "./lib/tailor.mjs";
import { classifyCompany, rankValue } from "./lib/companies.mjs";
import { tailorResume, renderResumeHtml } from "./lib/resume-builder.mjs";

const CFG_KEY = "ji.config";
const JOBS_KEY = "ji.jobs";

const $ = (id) => document.getElementById(id);
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

let cfg = load(CFG_KEY, null);
let jobs = load(JOBS_KEY, []);
let selected = null;

/* Pasted text has no topcard HTML, so recover the company from the header
   line LinkedIn puts under the title: "Company - Location" or "Company . Location". */
function guessCompany(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 6)) {
    if (line.length > 120) continue;
    const m = line.split(/\s+[-\u00b7\u2013\u2022|]\s+/)[0].trim();
    if (m.length >= 2 && m.length <= 70 && !/^about the job/i.test(m) &&
        !/\b(responsibilit|experience|requirement|qualification)/i.test(m)) {
      if (m !== lines[0]) return m;
    }
  }
  return "";
}

/* ---------- analysis: identical pipeline to server.mjs analyzeRaw ---------- */
function analyzeText(text, sourceUrl) {
  const raw = { source: "paste", url: sourceUrl || "(pasted)", html: text };
  const job = extractJob(raw, Object.keys(cfg.profile.skills || {}));
  if (!job.company) job.company = guessCompany(text);
  const scored = scoreJob(job, cfg.profile);
  const tailored = tailor(job, scored, cfg.profile, cfg.evidence);
  const cls = classifyCompany(job.company);
  return {
    id: job.jobId || job.url || String(Date.now()),
    addedAt: Date.now(),
    job, scored,
    title: job.title, company: job.company, location: job.location,
    yearsRequired: job.yearsRequired, applicants: job.applicants,
    score: scored.score, verdict: scored.verdict,
    mustPct: scored.mustPct, nicePct: scored.nicePct,
    flags: scored.flags, yearsNote: scored.yearsNote,
    strengths: scored.strengths,
    gaps: (scored.gaps || []).filter(g => g.level <= 2),
    knownGapsHit: scored.knownGapsHit,
    companyTier: cls.tier, companyLabel: cls.label,
    rank: rankValue(scored, job.company),
    summary: tailored.summary, bullets: tailored.bullets || [],
    outreach: tailored.outreach, atsKeywords: tailored.atsKeywords,
    sourceUrl: sourceUrl || "",
  };
}

/* ---------- rendering ---------- */
function verdictClass(v) {
  if (/^APPLY/i.test(v)) return "v-apply";
  if (/WORTH/i.test(v)) return "v-look";
  if (/STRETCH/i.test(v)) return "v-stretch";
  return "v-skip";
}

function renderList() {
  const list = $("list");
  if (!jobs.length) {
    list.innerHTML = '<p class="empty">No jobs yet. Paste a job description above.</p>';
    return;
  }
  const sorted = [...jobs].sort((a, b) => (b.rank - a.rank) || (b.score - a.score));
  list.innerHTML = sorted.map(j => `
    <div class="row ${selected === j.id ? "sel" : ""}" data-id="${j.id}">
      <div class="row-main">
        <div class="row-title">${esc(j.title || "(untitled)")}</div>
        <div class="row-sub">${esc(j.company || "?")} - ${esc(j.location || "?")}</div>
        <div class="tags">
          <span class="tier t${j.companyTier}">${esc(j.companyLabel || "")}</span>
          ${(j.flags || []).map(f => `<span class="flag">${esc(typeof f === "string" ? f : f.label || f.type)}</span>`).join("")}
        </div>
      </div>
      <div class="row-score">
        <div class="pct">${j.score}%</div>
        <div class="verdict ${verdictClass(j.verdict)}">${esc(j.verdict)}</div>
      </div>
    </div>`).join("");
  [...list.querySelectorAll(".row")].forEach(r =>
    r.onclick = () => { selected = r.dataset.id; renderList(); renderDetail(); });
}

function renderDetail() {
  const j = jobs.find(x => x.id === selected);
  const d = $("detail");
  if (!j) { d.innerHTML = '<p class="empty">Select a job to see the breakdown.</p>'; return; }
  d.innerHTML = `
    <h2>${esc(j.title || "")}</h2>
    <p class="muted">${esc(j.company || "")} - ${esc(j.location || "")} ${j.yearsRequired ? "- " + j.yearsRequired + "+ yrs" : ""}</p>
    <div class="scorebar"><div style="width:${j.score}%"></div></div>
    <p><b>${j.score}%</b> ${esc(j.verdict)} <span class="muted">(must ${j.mustPct}% / nice ${j.nicePct}%)</span></p>
    ${j.yearsNote ? `<p class="warn">${esc(j.yearsNote)}</p>` : ""}
    ${j.knownGapsHit?.length ? `<p class="warn">Known gaps hit: ${j.knownGapsHit.map(esc).join(", ")}</p>` : ""}
    <h3>Strengths</h3><ul>${(j.strengths || []).map(s => `<li>${esc(s.term || s)}</li>`).join("") || "<li class=muted>-</li>"}</ul>
    <h3>Gaps</h3><ul>${(j.gaps || []).map(g => `<li>${esc(g.term || g)}</li>`).join("") || "<li class=muted>none</li>"}</ul>
    <h3>Bullets to lead with</h3>
    <ul>${(j.bullets || []).map(b => `<li>${esc(b)}</li>`).join("") || "<li class=muted>-</li>"}</ul>
    <h3>Recruiter message</h3>
    <textarea id="msg" rows="8">${esc(j.outreach || "")}</textarea>
    <div class="btns">
      <button id="copyMsg">Copy message</button>
      <button id="cvBtn" class="primary">Open tailored CV</button>
      <button id="delBtn" class="danger">Remove</button>
    </div>`;
  $("copyMsg").onclick = () => { navigator.clipboard.writeText($("msg").value); toast("Copied"); };
  $("cvBtn").onclick = () => openResume(j);
  $("delBtn").onclick = () => { jobs = jobs.filter(x => x.id !== j.id); save(JOBS_KEY, jobs); selected = null; renderList(); renderDetail(); };
}

/* ---------- tailored CV -> browser print dialog ---------- */
function openResume(j) {
  const t = tailorResume(j.job, j.scored, cfg.baseResume);
  let html = renderResumeHtml(t, {});
  const printCss = `
    <style>
      @page { size: A4; margin: 14mm 12mm; }
      @media print { .noprint { display: none !important; } }
      .noprint { position: fixed; top: 10px; right: 10px; z-index: 9999;
        font: 14px system-ui; padding: 10px 16px; border: 0; border-radius: 6px;
        background: #2563eb; color: #fff; cursor: pointer; }
    </style>`;
  const btn = '<button class="noprint" onclick="window.print()">Save as PDF</button>';
  html = html.includes("</head>") ? html.replace("</head>", printCss + "</head>") : printCss + html;
  html = html.includes("<body>") ? html.replace("<body>", "<body>" + btn) : btn + html;
  const w = window.open("", "_blank");
  w.document.write(html);
  w.document.close();
  w.document.title = safeName(j);
}

function safeName(j) {
  return ("Subhajeet_Mohanty_" + (j.company || "") + "_" + (j.title || ""))
    .replace(/[^A-Za-z0-9]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").slice(0, 120);
}

/* ---------- helpers ---------- */
function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
function toast(m) {
  const t = $("toast"); t.textContent = m; t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 1600);
}
function showApp() {
  const ready = Boolean(cfg && cfg.profile && cfg.baseResume);
  $("setup").style.display = ready ? "none" : "block";
  $("app").style.display = ready ? "block" : "none";
  if (ready) { renderList(); renderDetail(); }
}

/* ---------- wiring ---------- */
$("saveCfg").onclick = () => {
  try {
    const parsed = JSON.parse($("cfgInput").value);
    if (!parsed.profile || !parsed.baseResume) throw new Error("Missing profile or baseResume");
    cfg = parsed; save(CFG_KEY, cfg); showApp(); toast("Profile loaded");
  } catch (e) { $("cfgErr").textContent = "Could not read that: " + e.message; }
};

$("analyzeBtn").onclick = () => {
  const text = $("jdInput").value.trim();
  if (text.length < 120) { toast("Paste the full job description"); return; }
  try {
    const r = analyzeText(text, $("jdUrl").value.trim());
    jobs = [r, ...jobs.filter(x => x.id !== r.id)];
    save(JOBS_KEY, jobs);
    selected = r.id;
    $("jdInput").value = ""; $("jdUrl").value = "";
    renderList(); renderDetail();
    toast(r.score + "% - " + r.verdict);
  } catch (e) { toast("Failed: " + e.message); console.error(e); }
};

$("resetBtn").onclick = () => {
  if (!confirm("Remove your profile and all saved jobs from this browser?")) return;
  localStorage.removeItem(CFG_KEY); localStorage.removeItem(JOBS_KEY);
  cfg = null; jobs = []; selected = null; showApp();
};

showApp();
