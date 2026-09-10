import type { SalaryBreakdown as SalaryBreakdownType } from "@/lib/sources/salary";

export default function SalaryBreakdown({
  salary,
  inferredRoles,
}: {
  salary: SalaryBreakdownType;
  inferredRoles: string[];
}) {
  return (
    <div className="stack">
      {!salary.allVerified && (
        <p className="small">
          <span className="badge-unverified">unverified</span>{" "}
          <span className="muted">
            One or more figures below haven&apos;t been confirmed against a live fetch of the official source in
            this environment — treat as placeholder until <code>npm run refresh:salary</code> has run somewhere
            with network access. See <code>lib/sources/salary.ts</code>.
          </span>
        </p>
      )}
      {inferredRoles.length > 0 && (
        <p className="small muted">
          Role add-ons below were inferred from this MP&apos;s current Wikidata positions — a keyword heuristic,
          not a verified structured lookup.
        </p>
      )}
      <div>
        {salary.lines.map((line) => (
          <div className="salary-line" key={line.key}>
            <span>
              {line.label} {!line.verified && <span className="badge-unverified">unverified</span>}
            </span>
            <span>${line.amountCad.toLocaleString("en-CA")}</span>
          </div>
        ))}
        <div className="salary-total">
          <span>Total</span>
          <span>${salary.totalCad.toLocaleString("en-CA")} CAD/year</span>
        </div>
      </div>
    </div>
  );
}
