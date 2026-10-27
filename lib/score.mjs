// Deterministic scoring. No AI here on purpose - the number must be reproducible
// and explainable. AI only ever writes prose, never the verdict.

const LEVEL_CREDIT = { 0: 0, 1: 0.2, 2: 0.5, 3: 0.85, 4: 1.0 };

export function scoreJob(job, profile) {
  const skills = profile.skills || {};
  const prefs = profile.preferences || {};

  const must = [], nice = [], gaps = [], strengths = [];
  let mustEarned = 0, mustTotal = 0, niceEarned = 0, niceTotal = 0;

  for (const { term, nice: isNice } of job.matchedTerms) {
    const level = skills[term];
    const have = level !== undefined ? level : 0;
    const credit = LEVEL_CREDIT[have] ?? 0;
    const row = { term, level: have, credit };

    if (isNice) {
      nice.push(row); niceTotal++; niceEarned += credit;
    } else {
      must.push(row); mustTotal++; mustEarned += credit;
    }
    if (have >= 3) strengths.push(row);
    else if (!isNice) gaps.push(row);
  }

  // Must-haves dominate; nice-to-haves are upside only.
  const mustPct = mustTotal ? (mustEarned / mustTotal) : 0;
  const nicePct = niceTotal ? (niceEarned / niceTotal) : 0;
  let score = mustTotal ? (mustPct * 0.85 + nicePct * 0.15) * 100 : nicePct * 100;

  // Experience floor
  const yearsNote = [];
  if (job.yearsRequired != null) {
    const have = profile.yearsExperience || 0;
    if (have >= job.yearsRequired) yearsNote.push(`Meets ${job.yearsRequired}+ yrs (you: ${have})`);
    else {
      const short = job.yearsRequired - have;
      yearsNote.push(`Short by ${short} yr(s): needs ${job.yearsRequired}, you have ${have}`);
      score -= Math.min(20, short * 6);
    }
  }

  // Deal-breakers: things that make the application a waste of effort regardless of fit.
  const flags = [];
  const loc = (job.location || "").toLowerCase();
  const prefLocs = (prefs.preferredLocations || []).map(s => s.toLowerCase());
  const exceptions = (prefs.relocationExceptions || []).map(s => s.toLowerCase());
  const isRemote = /remote|work from home|anywhere/i.test(job.text || "");

  if (loc && !isRemote) {
    const matchesPref = prefLocs.some(p => loc.includes(p.replace("hybrid-", "")));
    if (!matchesPref) {
      const allowed = exceptions.some(e => loc.includes(e));
      if (allowed) flags.push({ level: "warn", msg: `Location ${job.location} is a relocation exception - decide NOW, not at offer stage.` });
      else if (prefs.willingToRelocate === false) flags.push({ level: "block", msg: `Location ${job.location} is outside your preferred locations and you are not open to relocation.` });
    }
  }

  for (const kw of prefs.avoidKeywords || []) {
    if ((job.text || "").toLowerCase().includes(kw.toLowerCase())) flags.push({ level: "block", msg: `Contains avoid-keyword: "${kw}"` });
  }
  for (const c of prefs.avoidCompanies || []) {
    if ((job.company || "").toLowerCase().includes(c.toLowerCase())) flags.push({ level: "block", msg: `Company on your avoid list: ${c}` });
  }
  if (job.applicants != null) {
    if (job.applicants >= 200) flags.push({ level: "warn", msg: `${job.applicants}+ applicants - a cold apply is low-odds. Go direct to the company site and find the hiring manager.` });
    else if (job.applicants >= 100) flags.push({ level: "info", msg: `${job.applicants} applicants - competitive.` });
  }
  const ageDays = daysSince(job.posted);
  if (ageDays != null && ageDays > 21) flags.push({ level: "warn", msg: `Posted ~${ageDays} days ago - the req may be aging or already shortlisted.` });

  // Title alignment is a soft signal, not a gate.
  const titleLow = (job.title || "").toLowerCase();
  const targetHit = (prefs.targetTitles || []).some(t => titleLow.includes(t.toLowerCase()));
  if (targetHit) score += 3;

  score = Math.max(0, Math.min(100, Math.round(score)));

  const blocked = flags.some(f => f.level === "block");
  const verdict = blocked ? "SKIP"
    : score >= 75 ? "APPLY"
    : score >= 60 ? "WORTH A LOOK"
    : score >= 45 ? "STRETCH"
    : "SKIP";

  return {
    score, verdict, flags, yearsNote,
    must: must.sort((a, b) => a.credit - b.credit),
    nice, strengths, gaps,
    mustPct: Math.round(mustPct * 100),
    nicePct: Math.round(nicePct * 100),
    knownGapsHit: matchKnownGaps(job, profile),
  };
}

function matchKnownGaps(job, profile) {
  const hits = [];
  const low = (job.text || "").toLowerCase();
  for (const [gap, note] of Object.entries(profile.knownGaps || {})) {
    if (gap.startsWith("_")) continue;
    const key = gap.split("/")[0].trim();
    const re = new RegExp(`(^|[^a-z0-9+#.])${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9+#]|$)`, "i");
    if (re.test(low)) hits.push({ gap, note });
  }
  return hits;
}

function daysSince(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return Math.round((Date.now() - d.getTime()) / 86400000);
}

