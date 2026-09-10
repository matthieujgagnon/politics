import type { VoteRecord } from "@/lib/sources/openparliament";

export default function VotingRecordList({
  votes,
  available,
}: {
  votes: VoteRecord[];
  available: boolean;
}) {
  if (!available) {
    return (
      <p className="muted small">
        Voting record isn&apos;t available right now — the Open Parliament votes lookup this relies on couldn&apos;t
        be reached or returned an unexpected response.{" "}
        <span className="badge-unverified">unavailable</span>
      </p>
    );
  }

  if (votes.length === 0) {
    return <p className="muted small">No recent votes on record.</p>;
  }

  return (
    <table className="votes">
      <thead>
        <tr>
          <th>Date</th>
          <th>Bill</th>
          <th>Position</th>
          <th>Source</th>
        </tr>
      </thead>
      <tbody>
        {votes.map((v, i) => (
          <tr key={`${v.billNumber ?? "vote"}-${i}`}>
            <td>{v.date ?? "—"}</td>
            <td>
              {v.billNumber ?? "—"}
              {v.description ? <div className="muted small">{v.description}</div> : null}
            </td>
            <td>{v.position ?? "—"}</td>
            <td>
              {v.sourceUrl ? (
                <a href={v.sourceUrl} target="_blank" rel="noreferrer">
                  Open Parliament
                </a>
              ) : (
                "—"
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
