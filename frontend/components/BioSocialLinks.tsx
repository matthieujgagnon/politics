import type { MpProfile } from "@/lib/mp-profile";

export default function BioSocialLinks({ profile }: { profile: MpProfile }) {
  const { careerBackground, wikipediaUrl, wikipediaUrlFr, officialWebsite, social } = profile;
  const hasSocial = Boolean(
    officialWebsite || social.twitter || social.instagram || social.facebook || social.linkedin
  );

  return (
    <div className="stack">
      {careerBackground.length > 0 ? (
        <div>
          <strong className="small">Career background</strong>
          <ul style={{ paddingLeft: 20 }}>
            {careerBackground.map((c) => (
              <li key={c} className="small">
                {c}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="muted small">No career background found on Wikidata for this MP.</p>
      )}

      {(wikipediaUrl || wikipediaUrlFr) && (
        <div className="stack" style={{ gap: 4 }}>
          {wikipediaUrl && (
            <a href={wikipediaUrl} target="_blank" rel="noreferrer">
              Wikipedia
            </a>
          )}
          {wikipediaUrlFr && (
            <a href={wikipediaUrlFr} target="_blank" rel="noreferrer">
              Wikipédia (français)
            </a>
          )}
        </div>
      )}

      {hasSocial ? (
        <div className="social-links">
          {officialWebsite && (
            <a href={officialWebsite} target="_blank" rel="noreferrer">
              Official site
            </a>
          )}
          {social.twitter && (
            <a href={social.twitter} target="_blank" rel="noreferrer">
              X / Twitter
            </a>
          )}
          {social.facebook && (
            <a href={social.facebook} target="_blank" rel="noreferrer">
              Facebook
            </a>
          )}
          {social.instagram && (
            <a href={social.instagram} target="_blank" rel="noreferrer">
              Instagram
            </a>
          )}
          {social.linkedin && (
            <a href={social.linkedin} target="_blank" rel="noreferrer">
              LinkedIn
            </a>
          )}
        </div>
      ) : (
        <p className="muted small">No social links found on Wikidata for this MP.</p>
      )}
    </div>
  );
}
