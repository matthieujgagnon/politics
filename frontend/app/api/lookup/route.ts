import type { NextRequest } from "next/server";
import { resolveMpSlugFromPostalCode, MpNotFoundError } from "@/lib/mp-profile";
import { normalizePostalCode } from "@/lib/postal-code";
import { SourceFetchError } from "@/lib/http";
import { RidingNotFoundError } from "@/lib/sources/represent";

function extractPostalCode(body: unknown): string | null {
  if (body && typeof body === "object" && "postalCode" in body) {
    const v = (body as Record<string, unknown>).postalCode;
    return typeof v === "string" ? v : null;
  }
  return null;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const raw = extractPostalCode(body);
  const normalized = raw ? normalizePostalCode(raw) : null;
  if (!normalized) {
    return Response.json({ error: "That doesn't look like a valid Canadian postal code." }, { status: 400 });
  }

  try {
    const { slug, ridingName } = await resolveMpSlugFromPostalCode(normalized);
    return Response.json({ slug, ridingName });
  } catch (err) {
    if (err instanceof RidingNotFoundError || err instanceof MpNotFoundError) {
      return Response.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof SourceFetchError) {
      return Response.json(
        { error: `Couldn't reach an external data source (${err.url}). Try again shortly.` },
        { status: 502 }
      );
    }
    console.error("Unexpected error in /api/lookup:", err);
    return Response.json({ error: "Something went wrong looking that up." }, { status: 500 });
  }
}
