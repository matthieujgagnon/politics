import Link from "next/link";

export default function MpNotFound() {
  return (
    <>
      <header className="site-header">
        <Link href="/">Find Your MP</Link>
      </header>
      <main className="page">
        <div className="stack">
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>No MP found</h1>
          <p className="muted">
            Open Parliament doesn&apos;t have a politician matching that slug. Try again from{" "}
            <Link href="/">the homepage</Link>.
          </p>
        </div>
      </main>
    </>
  );
}
