import { notFound } from "next/navigation";
import Link from "next/link";
import { getMpProfile } from "@/lib/mp-profile";
import { SourceFetchError } from "@/lib/http";
import VotingRecordList from "@/components/VotingRecordList";
import SalaryBreakdown from "@/components/SalaryBreakdown";
import BioSocialLinks from "@/components/BioSocialLinks";

export default async function MpProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const profile = await getMpProfile(slug).catch((err: unknown) => {
    if (err instanceof SourceFetchError) {
      if (err.status === 404) notFound();
      return { fetchError: err } as const;
    }
    throw err;
  });

  if ("fetchError" in profile) {
    return (
      <>
        <header className="site-header">
          <Link href="/">Find Your MP</Link>
        </header>
        <main className="page">
          <div className="error-box">
            Couldn&apos;t reach an external data source ({profile.fetchError.url}) while loading this profile.
            Try again shortly.
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <header className="site-header">
        <Link href="/">Find Your MP</Link>
      </header>
      <main className="page stack">
        <div className="mp-header">
          {profile.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- external, unoptimized source photo
            <img className="mp-avatar" src={profile.photoUrl} alt="" />
          ) : (
            <div className="mp-avatar" aria-hidden />
          )}
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700 }}>{profile.name}</h1>
            <div>
              {profile.party && <span className="tag">{profile.party}</span>}
              {profile.ridingName && <span className="tag">{profile.ridingName}</span>}
            </div>
          </div>
        </div>

        <section className="card stack">
          <h2 style={{ fontSize: 18 }}>Voting record</h2>
          <VotingRecordList votes={profile.votes} available={profile.votesAvailable} />
        </section>

        <section className="card stack">
          <h2 style={{ fontSize: 18 }}>Salary</h2>
          <SalaryBreakdown salary={profile.salary} inferredRoles={profile.inferredRoles} />
        </section>

        <section className="card stack">
          <h2 style={{ fontSize: 18 }}>Background</h2>
          <BioSocialLinks profile={profile} />
        </section>
      </main>
    </>
  );
}
