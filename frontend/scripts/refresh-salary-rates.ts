// Refresh job for lib/sources/salary.ts's cached rates. Run with:
//   npm run refresh:salary
//
// This could not be developed against a live response (lop.parl.ca was
// blocked in the sandbox this was built in), so it's a best-effort text
// scrape: fetch the page, strip markup, look for each role's label near a
// dollar figure. If a role isn't found the existing cached row is left
// alone rather than overwritten with a guess - this script only ever
// raises confidence (marks a row verified with a real figure), never
// lowers it by writing a plausible-sounding number.
//
// Before trusting this in production: run it once with real network
// access, print `--debug` output, and confirm the regex below actually
// lines up with the live page's structure - it almost certainly needs
// adjustment.

import { getDb } from "../lib/db";

const SOURCE_URL = "https://lop.parl.ca/sites/ParlInfo/default/en_CA/People/Salaries";

const ROLE_LABEL_PATTERNS: { key: string; pattern: RegExp }[] = [
  { key: "base", pattern: /sessional indemnity/i },
  { key: "prime_minister", pattern: /prime minister/i },
  { key: "cabinet_minister", pattern: /^minister\b/i },
  { key: "speaker", pattern: /speaker of the house/i },
  { key: "deputy_speaker", pattern: /deputy speaker/i },
  { key: "opposition_leader", pattern: /leader of the opposition/i },
  { key: "house_leader", pattern: /house leader/i },
  { key: "whip", pattern: /^whip\b/i },
  { key: "parliamentary_secretary", pattern: /parliamentary secretary/i },
  { key: "committee_chair", pattern: /committee chair/i },
  { key: "committee_vice_chair", pattern: /committee vice-chair/i },
];

const DOLLAR_NEAR_LABEL = (label: RegExp) =>
  new RegExp(`${label.source}[^$\\n]{0,120}\\$([0-9][0-9,]*)`, "i");

async function fetchPageText(url: string): Promise<string> {
  // lop.parl.ca serves HTML, not JSON - fetchJson doesn't fit, so fetch
  // directly and strip tags well enough for a regex pass.
  const res = await fetch(url, { headers: { "User-Agent": "civic-record-mvp/0.1 refresh-job" } });
  if (!res.ok) throw new Error(`${url} responded ${res.status}`);
  const html = await res.text();
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
}

async function main() {
  const debug = process.argv.includes("--debug");
  const db = getDb();
  let text: string;
  try {
    text = await fetchPageText(SOURCE_URL);
  } catch (err) {
    console.error(`Could not fetch ${SOURCE_URL}: ${err instanceof Error ? err.message : err}`);
    console.error("Leaving cached salary_rates untouched.");
    process.exitCode = 1;
    return;
  }

  const now = new Date().toISOString();
  const update = db.prepare(
    `UPDATE salary_rates SET amount_cad = ?, verified = 1, source_url = ?, updated_at = ? WHERE role_key = ?`
  );

  let matched = 0;
  for (const { key, pattern } of ROLE_LABEL_PATTERNS) {
    const m = text.match(DOLLAR_NEAR_LABEL(pattern));
    if (!m) {
      if (debug) console.log(`[skip] no match for ${key}`);
      continue;
    }
    const amount = Number(m[1].replace(/,/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) continue;
    update.run(amount, SOURCE_URL, now, key);
    matched += 1;
    console.log(`[updated] ${key} = $${amount.toLocaleString("en-CA")} CAD (verified)`);
  }

  console.log(`Done: ${matched}/${ROLE_LABEL_PATTERNS.length} roles matched and marked verified.`);
  if (matched < ROLE_LABEL_PATTERNS.length) {
    console.log("Unmatched roles keep their previous (possibly unverified) cached value - the scrape pattern likely needs adjusting for the live page structure.");
  }
}

main();
