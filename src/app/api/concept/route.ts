import { NextRequest, NextResponse } from "next/server";
import { generateConcept, type Niche } from "@/lib/concept";

const NICHES: Niche[] = ["travel", "wellness", "fashion", "maker", "beauty", "other"];

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body" }, { status: 400 });
  }

  const { productName, productDescription, niche, skinStrengths, futureSelf } = (body ?? {}) as Record<
    string,
    unknown
  >;

  if (typeof productName !== "string" || !productName.trim()) {
    return NextResponse.json({ error: "productName is required" }, { status: 400 });
  }
  if (typeof productDescription !== "string" || !productDescription.trim()) {
    return NextResponse.json({ error: "productDescription is required" }, { status: 400 });
  }
  if (typeof niche !== "string" || !NICHES.includes(niche as Niche)) {
    return NextResponse.json(
      { error: `niche must be one of: ${NICHES.join(", ")}` },
      { status: 400 }
    );
  }

  const skinStrengthLabels = Array.isArray(skinStrengths)
    ? skinStrengths
        .map((s) => (typeof s === "string" ? s : (s as { label?: unknown })?.label))
        .filter((l): l is string => typeof l === "string" && l.trim().length > 0)
    : undefined;

  try {
    const concept = await generateConcept(
      productName,
      productDescription,
      niche as Niche,
      skinStrengthLabels,
      futureSelf === true
    );
    return NextResponse.json(concept);
  } catch (err) {
    console.error("Concept agent error:", err);
    return NextResponse.json({ error: "Failed to generate concept" }, { status: 502 });
  }
}
