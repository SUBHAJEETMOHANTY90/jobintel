// Tailors the resume to a job description by REORDERING and SELECTING only.
// It never writes a new claim. Every sentence in the output exists in base-resume.json.

function relevance(text, mustTerms, niceTerms) {
  const low = " " + text.toLowerCase() + " ";
  let score = 0;
  const hits = [];
  for (const t of mustTerms) {
    if (low.includes(" " + t) || low.includes(t + " ") || low.includes(t)) { score += 3; hits.push(t); }
  }
  for (const t of niceTerms) {
    if (low.includes(t)) { score += 1; hits.push(t); }
  }
  return { score, hits };
}

export function tailorResume(job, scored, base) {
  const must = job.matchedTerms.filter(t => !t.nice).map(t => t.term);
  const nice = job.matchedTerms.filter(t => t.nice).map(t => t.term);

  // 1. Skill groups: most relevant first, and highlight matched keywords inside each.
  const groups = base.skillGroups.map(g => {
    const r = relevance(g.items + " " + g.name, must, nice);
    const items = g.items.split(",").map(s => s.trim());
    const matched = items.filter(i => must.some(m => i.toLowerCase().includes(m)) || nice.some(m => i.toLowerCase().includes(m)));
    const rest = items.filter(i => !matched.includes(i));
    return { ...g, score: r.score, ordered: [...matched, ...rest].join(", "), matchedItems: matched };
  }).sort((a, b) => b.score - a.score);

  // 2. Experience: keep every role (gaps look bad), reorder bullets within each role.
  const experience = base.experience.map((role, idx) => {
    const ranked = role.bullets
      .map(b => ({ text: b, ...relevance(b, must, nice) }))
      .sort((a, b) => b.score - a.score);
    // Current role keeps more detail; older roles trim to the most relevant.
    const keep = idx === 0 ? ranked.length : idx === 1 ? Math.min(7, ranked.length) : Math.min(5, ranked.length);
    return { ...role, bullets: ranked.slice(0, keep) };
  });

  // 3. Projects: most relevant first.
  const projects = base.projects
    .map(p => ({ ...p, ...relevance(p.name + " " + p.text, must, nice) }))
    .sort((a, b) => b.score - a.score);

  // 4. Headline: use the JD's own title when it is a role you target, else keep yours.
  const targetTitle = job.title && /performance|sre|reliability|quality/i.test(job.title)
    ? job.title.replace(/\s*[-|].*$/, "").trim()
    : base.title;

  // 5. Summary: core + a sentence naming the overlap, assembled from facts already present.
  const topSkills = [...new Set([...must, ...nice])]
    .filter(t => !["ai", "devops", "sla", "nfr", "apm"].includes(t))
    .slice(0, 10);
  const focus = topSkills.length
    ? ` Particularly relevant to this role: ${topSkills.join(", ")}.`
    : "";
  const summary = base.summaryCore + focus + " " + base.summaryTools + " " + base.summaryClose;

  return {
    targetTitle, summary, groups, experience, projects,
    base, job, scored,
    matchedTerms: [...new Set([...must, ...nice])],
  };
}

export function renderResumeHtml(t, opts = {}) {
  const b = t.base;
  const esc = s => String(s == null ? "" : s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const hl = text => {
    let out = esc(text);
    for (const term of t.matchedTerms) {
      if (term.length < 3) continue;
      const re = new RegExp(`(^|[^a-z0-9<>/])(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(?![a-z0-9])`, "gi");
      out = out.replace(re, "$1<b>$2</b>");
    }
    return out;
  };

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${esc(b.name)} - ${esc(t.targetTitle)}</title>
<style>
@page { size: A4; margin: 13mm 14mm; }
*{box-sizing:border-box}
body{font:10.5pt/1.42 "Calibri","Segoe UI",Arial,sans-serif;color:#1a1a1a;margin:0}
h1{font-size:19pt;margin:0 0 2px;letter-spacing:.3px}
.role{font-size:10.5pt;color:#333;margin-bottom:3px}
.contact{font-size:9pt;color:#444;margin-bottom:10px}
h2{font-size:10.5pt;text-transform:uppercase;letter-spacing:.8px;border-bottom:1.3px solid #1f4e79;
   color:#1f4e79;margin:13px 0 6px;padding-bottom:2px}
p{margin:0 0 6px;text-align:justify}
.sk{margin-bottom:4px}.sk b.g{color:#1f4e79}
ul{margin:3px 0 7px;padding-left:16px}
li{margin-bottom:2.5px;text-align:justify}
.job{margin-bottom:9px}
.jh{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
.co{font-weight:700;font-size:11pt}
.pd{font-size:9pt;color:#555;white-space:nowrap}
.rl{font-style:italic;font-size:10pt;color:#333}
.cl{font-size:9.5pt;color:#444}
.pr{margin-bottom:7px}
.pn{font-weight:700}
.ed{display:flex;justify-content:space-between;gap:10px;margin-bottom:3px;font-size:10pt}
.bar{position:fixed;top:0;left:0;right:0;background:#1f4e79;color:#fff;padding:7px 14px;
     font:12px/1.4 Segoe UI,sans-serif;display:flex;justify-content:space-between;align-items:center;z-index:9}
.bar button{background:#fff;color:#1f4e79;border:0;padding:5px 13px;border-radius:5px;font-weight:700;cursor:pointer}
.pad{height:40px}
@media print{.bar,.pad{display:none}}
</style></head><body>
${opts.clean ? "" : `<div class="bar"><span>Tailored for <b>${esc(t.job.title || "this role")}</b>${t.job.company ? " at " + esc(t.job.company) : ""} &nbsp;|&nbsp; match ${t.scored.score}% &nbsp;|&nbsp; <b>bold</b> = keywords this JD asks for</span><button onclick="downloadPdf()">Download PDF</button></div><div class="pad"></div>`}

<h1>${esc(b.name)}</h1>
<div class="role">${esc(t.targetTitle)} | ${b.headlineTags.map(esc).join(" | ")}</div>
<div class="contact">${esc(b.contact.location)} &nbsp;|&nbsp; ${esc(b.contact.phone)} &nbsp;|&nbsp; ${esc(b.contact.email)} &nbsp;|&nbsp; ${esc(b.contact.linkedin)}</div>

<h2>Summary</h2>
<p>${hl(t.summary)}</p>

<h2>Core Skills</h2>
${t.groups.map(g => `<div class="sk"><b class="g">${esc(g.name)}:</b> ${hl(g.ordered)}</div>`).join("")}

<h2>Professional Experience</h2>
${t.experience.map(r => `
<div class="job">
  <div class="jh"><span class="co">${esc(r.company)}</span><span class="pd">${esc(r.period)}</span></div>
  <div class="rl">${esc(r.role)}${r.client ? ` &nbsp;|&nbsp; <span class="cl">Client: ${esc(r.client)}</span>` : ""}</div>
  <ul>${r.bullets.map(x => `<li>${hl(x.text)}</li>`).join("")}</ul>
</div>`).join("")}

<h2>Key Projects</h2>
${t.projects.map(p => `<div class="pr"><span class="pn">${hl(p.name)}</span><br>${hl(p.text)}</div>`).join("")}

<h2>Education</h2>
${b.education.map(e => `<div class="ed"><span>${esc(e.school)}</span><span class="pd">${esc(e.detail)}</span></div>`).join("")}
<script>function downloadPdf(){location.href=location.pathname.replace('/api/resume','/api/resume.pdf')+location.search;}</script>
</body></html>`;
}
