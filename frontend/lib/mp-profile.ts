import { lookupRidingByPostalCode } from "@/lib/sources/represent";
import {
  getCurrentPoliticians,
  getPoliticianDetail,
  getPoliticianVotes,
  type VoteRecord,
} from "@/lib/sources/openparliament";
import { getMpWikidataProfile } from "@/lib/sources/wikidata";
import { computeMpSalary, inferRoleKeysFromPositionLabels, type SalaryBreakdown } from "@/lib/sources/salary";
import { findByRidingName } from "@/lib/riding-match";

export class MpNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MpNotFoundError";
  }
}

export interface RidingResolution {
  slug: string;
  ridingName: string;
}

/** Postal code -> federal riding (Represent) -> sitting MP (Open Parliament), matched by riding name. */
export async function resolveMpSlugFromPostalCode(postalCode: string): Promise<RidingResolution> {
  const riding = await lookupRidingByPostalCode(postalCode);
  const politicians = await getCurrentPoliticians();
  const match = findByRidingName(riding.ridingName, politicians);

  if (!match) {
    throw new MpNotFoundError(
      `Found riding "${riding.ridingName}" for this postal code, but couldn't match it to a current MP in ` +
        `Open Parliament's politician list. Riding names sometimes differ slightly between the two sources ` +
        `(accents, punctuation, redistribution) - see lib/riding-match.ts.`
    );
  }

  return { slug: match.slug, ridingName: riding.ridingName };
}

export interface MpProfile {
  slug: string;
  name: string;
  party: string | null;
  ridingName: string | null;
  photoUrl: string | null;
  votes: VoteRecord[];
  votesAvailable: boolean;
  careerBackground: string[];
  wikipediaUrl: string | null;
  wikipediaUrlFr: string | null;
  officialWebsite: string | null;
  social: {
    twitter: string | null;
    instagram: string | null;
    facebook: string | null;
    linkedin: string | null;
  };
  salary: SalaryBreakdown;
  inferredRoles: string[];
}

export async function getMpProfile(slug: string): Promise<MpProfile> {
  const detail = await getPoliticianDetail(slug);

  const [votesResult, wikidata] = await Promise.all([
    getPoliticianVotes(slug, detail.url),
    getMpWikidataProfile(slug, detail.name, detail.ridingName ?? ""),
  ]);

  const inferredRoles = inferRoleKeysFromPositionLabels(wikidata.currentPositionLabels);
  const salary = computeMpSalary(inferredRoles);

  return {
    slug: detail.slug,
    name: detail.name,
    party: detail.party,
    ridingName: detail.ridingName,
    photoUrl: detail.photoUrl,
    votes: votesResult.votes,
    votesAvailable: votesResult.available,
    careerBackground: wikidata.careerBackground,
    wikipediaUrl: wikidata.wikipediaUrl,
    wikipediaUrlFr: wikidata.wikipediaUrlFr,
    officialWebsite: wikidata.officialWebsite,
    social: wikidata.social,
    salary,
    inferredRoles,
  };
}
