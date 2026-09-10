import PostalCodeForm from "@/components/PostalCodeForm";

export default function Home() {
  return (
    <>
      <header className="site-header">Find Your MP</header>
      <main className="page stack">
        <div className="stack">
          <h1 style={{ fontSize: 26, fontWeight: 700 }}>Who represents you in Parliament?</h1>
          <p className="muted">
            Enter your postal code to find your federal riding and sitting MP — voting record, pay, and
            background, each traceable to where it came from.
          </p>
        </div>
        <PostalCodeForm />
        <p className="small muted">
          Looks up your riding via the{" "}
          <a href="https://represent.opennorth.ca/" target="_blank" rel="noreferrer">
            Represent API
          </a>{" "}
          and your MP via{" "}
          <a href="https://openparliament.ca/" target="_blank" rel="noreferrer">
            Open Parliament
          </a>
          . Nothing you enter is stored beyond a cache of the riding lookup itself.
        </p>
      </main>
    </>
  );
}
