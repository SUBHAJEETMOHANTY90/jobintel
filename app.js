import { extractJob } from "./lib/extract.mjs";
import { scoreJob } from "./lib/score.mjs";
import { tailor } from "./lib/tailor.mjs";
import { classifyCompany, rankValue } from "./lib/companies.mjs";
import { tailorResume, renderResumeHtml } from "./lib/resume-builder.mjs";

const CFG = "ji.config", JOBS = "ji.jobs";
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

let cfg = read(CFG, null);
let all = read(JOBS, []);
let sel = null;

const vclass = v => v === "APPLY" ? "APPLY" : v === "WORTH A LOOK" ? "LOOK" : v === "STRETCH" ? "STRETCH" : "SKIP";
const sc = s => s >= 75 ? "var(--ok)" : s >= 60 ? "var(--look)" : s >= 45 ? "var(--warn)" : "var(--bad)";

/* Pasted text has no LinkedIn topcard markup, so recover the company from the
   header line under the title: "Company - Location" or "Company . Location". */
function guessCompany(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 6)) {
    if (line.length > 120) continue;
    const m = line.split(/\s+[-\u00b7\u2013\u2022|]\s+/)[0].trim();
    if (m.length >= 2 && m.length <= 70 && !/^about the job/i.test(m) &&
        !/\b(responsibilit|experience|requirement|qualification)/i.test(m) && m !== lines[0]) return m;
  }
  return "";
}

/* Same pipeline as server.mjs analyzeRaw. */
function analyze(text, url) {
  const job = extractJob({ source: "paste", url: url || "(pasted)", html: text }, Object.keys(cfg.profile.skills || {}));
  if (!job.company) job.company = guessCompany(text);
  // If the header line repeated the title, we have no real company name.
  const norm = v => String(v || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (job.company && job.title && norm(job.company) === norm(job.title)) job.company = "";
  const scored = scoreJob(job, cfg.profile);
  const t = tailor(job, scored, cfg.profile, cfg.evidence);
  const cls = classifyCompany(job.company);
  return {
    key: job.jobId || url || "paste-" + Date.now(),
    jobId: job.jobId, url: url || "", _job: job, _scored: scored,
    title: job.title, company: job.company, location: job.location,
    seniority: job.seniority, yearsRequired: job.yearsRequired,
    applicants: job.applicants, applicantsPlus: job.applicantsPlus,
    score: scored.score, verdict: scored.verdict, mustPct: scored.mustPct,
    flags: scored.flags || [], strengths: scored.strengths || [],
    gaps: (scored.gaps || []).filter(g => g.level <= 2), knownGapsHit: scored.knownGapsHit || [],
    companyTier: cls.tier, companyLabel: cls.label, rank: rankValue(scored, job.company),
    summary: t.summary, bullets: t.bullets || [], atsKeywords: t.atsKeywords || [], outreach: t.outreach || "",
    appliedAt: null, dismissed: false,
  };
}

function visible() {
  return all.filter(j => {
    if ($("fHide").checked && j.verdict === "SKIP") return false;
    if ($("fApplied").checked && j.appliedAt) return false;
    if ($("fProduct").checked && j.companyTier > 2) return false;
    return !j.dismissed;
  }).sort((a, b) => b.rank - a.rank);
}

function renderRows() {
  const v = visible();
  $("empty").style.display = v.length ? "none" : "block";
  $("count").textContent = v.length + " shown / " + all.length + " tracked";
  $("stat").textContent = all.length ? all.length + " jobs on this device" : "";
  $("rows").innerHTML = v.map(j => `
    <tr class="job ${j.key === sel ? "sel" : ""}" onclick="select('${esc(j.key)}')">
      <td><div class="score" style="color:${sc(j.score)}">${j.score}%</div>
          <span class="v ${vclass(j.verdict)}">${j.verdict}</span></td>
      <td><div class="t">${esc(j.title || "(untitled)")}</div>
          <div class="c">${esc(j.company || "")}<span class="tier t${String(j.companyTier).replace(".", "")}">${esc(j.companyLabel || "")}</span></div>
          ${j.appliedAt ? '<div class="applied">APPLIED ' + esc(j.appliedAt) + "</div>" : ""}</td>
      <td class="c">${esc(j.location || "-")}<br>${j.applicants != null ? j.applicants + (j.applicantsPlus ? "+" : "") + " applicants" : ""}</td>
    </tr>`).join("");
}

function select(key) {
  sel = key; renderRows();
  const j = all.find(x => x.key === key); if (!j) return;
  $("detail").innerHTML = `
    <h2>${esc(j.title || "Job")} <span class="v ${vclass(j.verdict)}">${j.verdict} &middot; ${j.score}%</span></h2>
    <div class="meta">
      <div>Company</div><div>${esc(j.company || "-")} <span class="tier t${String(j.companyTier).replace(".", "")}">${esc(j.companyLabel || "")}</span></div>
      <div>Location</div><div>${esc(j.location || "-")}</div>
      ${j.seniority ? `<div>Seniority</div><div>${esc(j.seniority)}</div>` : ""}
      ${j.yearsRequired != null ? `<div>Experience</div><div>${j.yearsRequired}+ yrs</div>` : ""}
      <div>Must-haves</div><div>${j.mustPct}% covered</div>
      ${j.url ? `<div>Link</div><div><a href="${esc(j.url)}" target="_blank">Open posting</a></div>` : ""}
    </div>
    ${j.flags.length ? `<h2>Before you apply</h2>${j.flags.map(f => `<div class="flag ${esc(f.level || "info")}">${esc(f.msg || f)}</div>`).join("")}` : ""}
    ${(j.gaps.length || j.knownGapsHit.length) ? `<h2>Gaps to prepare for</h2>
      <div class="chips">${j.gaps.map(g => `<span class="chip gap">${esc(g.term)}</span>`).join("")}</div>
      ${j.knownGapsHit.map(k => `<div class="note"><b>${esc(k.gap)}</b> - ${esc(k.note)}</div>`).join("")}` : ""}
    <h2>You match on</h2>
    <div class="chips">${j.strengths.map(s => `<span class="chip">${esc(s.term)}</span>`).join("")}</div>
    <h2>Tailored summary</h2>
    <pre id="sum">${esc(j.summary)}</pre>
    <div class="act"><button class="ghost sm" onclick="cp('sum',this)">Copy summary</button></div>
    <h2>Bullets to lead with</h2>
    <ul>${j.bullets.map(b => `<li>${esc(b)}</li>`).join("")}</ul>
    <h2>ATS keywords</h2>
    <div class="chips">${j.atsKeywords.map(k => `<span class="chip">${esc(k)}</span>`).join("")}</div>
    <h2>Tailored resume</h2>
    <div class="note" style="margin-bottom:8px">Your real CV, reordered for this JD: matching skills and bullets move to the top and are bolded. Nothing is invented.</div>
    <div class="act">
      <button onclick="openResume('${esc(j.key)}')">Open tailored CV (then Save as PDF)</button>
    </div>
    <h2>Message to the recruiter</h2>
    <pre id="out">${esc(j.outreach)}</pre>
    <div class="act">
      <button onclick="cp('out',this)">Copy message</button>
      ${j.url ? `<button class="ghost" onclick="window.open('${esc(j.url)}','_blank')">Open &amp; apply</button>` : ""}
      <button class="ghost" onclick="mark('${esc(j.key)}')">${j.appliedAt ? "Applied" : "Mark applied"}</button>
      <button class="ghost" onclick="dismiss('${esc(j.key)}')">Not interested</button>
    </div>
    <div class="note">Replace [name] with the real recruiter. A named note beats a generic one.</div>`;
}

/* Browser print dialog replaces headless Chrome here. */
function openResume(key) {
  const j = all.find(x => x.key === key); if (!j) return;
  const t = tailorResume(j._job, j._scored, cfg.baseResume);
  let html = renderResumeHtml(t, {});
  const css = `<style>@page{size:A4;margin:14mm 12mm}@media print{.noprint{display:none!important}}
    .noprint{position:fixed;top:10px;right:10px;z-index:9999;font:13px system-ui;
      background:#171a23;color:#e6e8ee;border:1px solid #262b38;border-radius:8px;padding:12px;max-width:260px}
    .noprint button{font:14px system-ui;padding:9px 15px;border:0;border-radius:6px;
      background:#4f8cff;color:#fff;cursor:pointer;width:100%}
    .noprint .hint{margin-top:9px;color:#8b93a7;line-height:1.45}</style>`;
  const btn = '<div class="noprint">' +
    '<button onclick="window.print()">Save as PDF</button>' +
    '<div class="hint">In the print dialog open <b>More settings</b> and untick ' +
    '<b>Headers and footers</b>, or the date and URL appear on the page.</div></div>';
  html = html.includes("</head>") ? html.replace("</head>", css + "</head>") : css + html;
  html = html.includes("<body>") ? html.replace("<body>", "<body>" + btn) : btn + html;
  const w = window.open("", "_blank");
  w.document.write(html); w.document.close();
  const who = (cfg.baseResume && cfg.baseResume.name) || "CV";
  w.document.title = (who + "_" + (j.company || "") + "_" + (j.title || ""))
    .replace(/[^A-Za-z0-9]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").slice(0, 120);
}

function cp(id, btn) {
  navigator.clipboard.writeText($(id).innerText);
  const t = btn.textContent; btn.textContent = "Copied";
  setTimeout(() => btn.textContent = t, 1200);
}
function mark(key) {
  const j = all.find(x => x.key === key);
  j.appliedAt = new Date().toISOString().slice(0, 10);
  write(JOBS, all); renderRows(); select(key);
}
function dismiss(key) {
  const j = all.find(x => x.key === key);
  j.dismissed = true; write(JOBS, all); sel = null; renderRows();
  $("detail").innerHTML = '<div class="empty">Dismissed.</div>';
}

// Inline onclick handlers need these on window; modules are not global.
Object.assign(window, { select, cp, mark, dismiss, openResume });

function boot() {
  const ready = Boolean(cfg && cfg.profile && cfg.baseResume);
  $("setup").style.display = ready ? "none" : "block";
  $("app").style.display = ready ? "block" : "none";
  if (ready) { renderRows(); }
}

$("saveCfg").onclick = () => {
  try {
    const p = JSON.parse($("cfgInput").value);
    if (!p.profile || !p.baseResume) throw new Error("missing profile or baseResume");
    cfg = p; write(CFG, cfg); boot();
  } catch (e) { $("cfgErr").textContent = "Could not read that: " + e.message; }
};

$("go").onclick = () => {
  const text = $("jd").value.trim();
  if (text.length < 120) { alert("Paste the full job description."); return; }
  try {
    const r = analyze(text, $("url").value.trim());
    all = [r, ...all.filter(x => x.key !== r.key)];
    write(JOBS, all);
    $("jd").value = ""; $("url").value = "";
    select(r.key);
  } catch (e) { alert("Could not analyze that: " + e.message); console.error(e); }
};

["fHide", "fApplied", "fProduct"].forEach(id => $(id).onchange = renderRows);

$("wipe").onclick = () => {
  if (!confirm("Remove your profile and all saved jobs from this browser?")) return;
  localStorage.removeItem(CFG); localStorage.removeItem(JOBS);
  cfg = null; all = []; sel = null; boot();
};

boot();
