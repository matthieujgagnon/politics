import { getDb } from "@/lib/db";

// Base sessional indemnity + per-office add-ons, per the Parliament of
// Canada Act: additional salaries apply to the PM, Cabinet Ministers, the
// Speaker and other Chair occupants, recognized-party leaders, House
// Leaders, Whips, Parliamentary Secretaries, and committee Chairs/
// Vice-Chairs. Amounts are indexed every April 1.
//
// IMPORTANT: only `base` below has an amount from a search result, and
// even that came from a secondary source (a social media post citing
// lop.parl.ca), not a direct read of lop.parl.ca/ourcommons.ca itself -
// network access to verify it directly was blocked in the sandbox this
// was built in. It's seeded with `verified: false` and the app must not
// present it as confirmed. Every add-on role below has NO real figure
// seeded (amount 0, verified false) rather than a fabricated
// plausible-sounding number - `npm run refresh:salary` is where real
// figures should come from once this runs somewhere with network access.
const ROLE_DEFAULTS: { key: string; label: string; amountCad: number; verified: boolean; sourceUrl: string | null }[] = [
  {
    key: "base",
    label: "Base sessional indemnity",
    amountCad: 217_700,
    verified: false,
    sourceUrl: "https://lop.parl.ca/sites/ParlInfo/default/en_CA/People/Salaries",
  },
  { key: "cabinet_minister", label: "Cabinet Minister add-on", amountCad: 0, verified: false, sourceUrl: null },
  { key: "prime_minister", label: "Prime Minister add-on", amountCad: 0, verified: false, sourceUrl: null },
  { key: "speaker", label: "Speaker add-on", amountCad: 0, verified: false, sourceUrl: null },
  { key: "deputy_speaker", label: "Deputy Speaker / Chair add-on", amountCad: 0, verified: false, sourceUrl: null },
  { key: "opposition_leader", label: "Leader of the Opposition add-on", amountCad: 0, verified: false, sourceUrl: null },
  { key: "party_leader", label: "Recognized party leader add-on", amountCad: 0, verified: false, sourceUrl: null },
  { key: "house_leader", label: "House Leader add-on", amountCad: 0, verified: false, sourceUrl: null },
  { key: "whip", label: "Whip add-on", amountCad: 0, verified: false, sourceUrl: null },
  { key: "parliamentary_secretary", label: "Parliamentary Secretary add-on", amountCad: 0, verified: false, sourceUrl: null },
  { key: "committee_chair", label: "Standing Committee Chair add-on", amountCad: 0, verified: false, sourceUrl: null },
  { key: "committee_vice_chair", label: "Standing Committee Vice-Chair add-on", amountCad: 0, verified: false, sourceUrl: null },
];

// Keyword -> role_key, used to turn a Wikidata "currently held position"
// label into a salary role. Deliberately conservative (substring match on
// English labels only) - a missed match falls back to base-only pay
// rather than a wrong guess.
const ROLE_KEYWORDS: [RegExp, string][] = [
  [/prime minister/i, "prime_minister"],
  [/^minister of|^minister for|cabinet minister/i, "cabinet_minister"],
  [/speaker of the house/i, "speaker"],
  [/deputy speaker/i, "deputy_speaker"],
  [/leader of the opposition/i, "opposition_leader"],
  [/^leader of the .*party/i, "party_leader"],
  [/house leader/i, "house_leader"],
  [/whip/i, "whip"],
  [/parliamentary secretary/i, "parliamentary_secretary"],
  [/vice-chair.*committee|vice chair.*committee/i, "committee_vice_chair"],
  [/chair.*committee/i, "committee_chair"],
];

export interface SalaryRate {
  key: string;
  label: string;
  amountCad: number;
  verified: boolean;
  effectiveDate: string | null;
  sourceUrl: string | null;
}

function seedIfEmpty() {
  const db = getDb();
  const { count } = db.prepare("SELECT COUNT(*) as count FROM salary_rates").get() as { count: number };
  if (count > 0) return;

  const insert = db.prepare(
    `INSERT INTO salary_rates (role_key, label, amount_cad, effective_date, verified, source_url, updated_at)
     VALUES (@role_key, @label, @amount_cad, @effective_date, @verified, @source_url, @updated_at)`
  );
  const now = new Date().toISOString();
  const insertMany = db.transaction((rows: typeof ROLE_DEFAULTS) => {
    for (const r of rows) {
      insert.run({
        role_key: r.key,
        label: r.label,
        amount_cad: r.amountCad,
        effective_date: null,
        verified: r.verified ? 1 : 0,
        source_url: r.sourceUrl,
        updated_at: now,
      });
    }
  });
  insertMany(ROLE_DEFAULTS);
}

export function getSalaryRates(): SalaryRate[] {
  seedIfEmpty();
  const db = getDb();
  const rows = db
    .prepare("SELECT role_key, label, amount_cad, effective_date, verified, source_url FROM salary_rates")
    .all() as {
    role_key: string;
    label: string;
    amount_cad: number;
    effective_date: string | null;
    verified: number;
    source_url: string | null;
  }[];
  return rows.map((r) => ({
    key: r.role_key,
    label: r.label,
    amountCad: r.amount_cad,
    verified: r.verified === 1,
    effectiveDate: r.effective_date,
    sourceUrl: r.source_url,
  }));
}

/** Best-effort: turns Wikidata "currently held position" labels into salary role keys. */
export function inferRoleKeysFromPositionLabels(labels: string[]): string[] {
  const matched = new Set<string>();
  for (const label of labels) {
    for (const [pattern, key] of ROLE_KEYWORDS) {
      if (pattern.test(label)) matched.add(key);
    }
  }
  return Array.from(matched);
}

export interface SalaryBreakdown {
  lines: SalaryRate[];
  totalCad: number;
  allVerified: boolean;
}

export function computeMpSalary(roleKeys: string[]): SalaryBreakdown {
  const rates = getSalaryRates();
  const byKey = new Map(rates.map((r) => [r.key, r]));
  const base = byKey.get("base");
  const lines = [base, ...roleKeys.map((k) => byKey.get(k))].filter((r): r is SalaryRate => !!r);
  const totalCad = lines.reduce((sum, r) => sum + r.amountCad, 0);
  const allVerified = lines.every((r) => r.verified);
  return { lines, totalCad, allVerified };
}
