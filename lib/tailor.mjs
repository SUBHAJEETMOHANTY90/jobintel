// Selects which REAL achievements to lead with. It never writes new claims -
// it only ranks and surfaces bullets that already exist in evidence.json.

export function tailor(job, scored, profile, evidence) {
  const jdTerms = new Set(job.matchedTerms.map(t => t.term));
  const mustTerms = new Set(job.matchedTerms.filter(t => !t.nice).map(t => t.term));

  const ranked = evidence.bullets.map(b => {
    let hits = 0, mustHits = 0;
    for (const tag of b.tags) {
      if (jdTerms.has(tag)) { hits++; if (mustTerms.has(tag)) mustHits++; }
    }
    return { ...b, hits, mustHits, relevance: mustHits * 2 + hits };
  })
  .filter(b => b.relevance > 0)
  .sort((a, b) => b.relevance - a.relevance);

  const top = ranked.slice(0, 6);

  // ATS keywords: required terms the JD leans on that your CV should literally contain.
  const atsMissing = job.matchedTerms
    .filter(t => !t.nice)
    .filter(t => {
      const lvl = profile.skills[t.term];
      return lvl !== undefined && lvl >= 3; // only mirror what you can defend in an interview
    })
    .map(t => t.term)
    .slice(0, 20);

  const summary = buildSummary(job, profile, top);
  const outreach = buildOutreach(job, profile, top, scored);

  return { bullets: top, atsKeywords: atsMissing, summary, outreach, allRanked: ranked };
}

function buildSummary(job, profile, top) {
  const role = job.title || "this role";
  const lead = profile.headlinePitch;
  const extra = top.slice(0, 2).map(b => b.short).join(" ");
  return `${lead}\n\nMost relevant to ${role}: ${extra}`;
}

function buildOutreach(job, profile, top, scored) {
  const company = job.company || "your team";
  const role = job.title || "the role";
  const best = top[0] ? top[0].short : "";
  const second = top[1] ? top[1].short : "";
  return [
    `Hi [name],`,
    ``,
    `I saw the ${role} opening at ${company} and it lines up closely with what I do day to day.`,
    ``,
    `I'm a performance engineer with ${profile.yearsExperience} years across banking and retail, currently owning performance for H&M's core platforms. Two things that seem directly relevant: ${lower(best)}${second ? ` And ${lower(second)}` : ""}`,
    ``,
    `I've also published a write-up of the reusable performance framework and AI-assisted analysis engine I built: ${profile.portfolio}`,
    ``,
    `Would you be open to a short conversation?`,
    ``,
    `Best regards,`,
    `${profile.name}`,
    `${profile.linkedin}`,
  ].join("\n");
}

function lower(s) { return s ? s.charAt(0).toLowerCase() + s.slice(1) : ""; }

