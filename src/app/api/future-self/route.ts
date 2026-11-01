import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { runAgingSimulation, YouCamError } from "@/lib/youcam";
import { pickDefaultAges } from "@/lib/futureSelf";

export const maxDuration = 60;

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

async function toDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new YouCamError(`Failed to download aging result frame (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  const mime = res.headers.get("content-type") ?? "image/jpeg";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const selfieFile = form.get("selfie");
  if (!(selfieFile instanceof File)) {
    return NextResponse.json({ error: "A 'selfie' image file is required" }, { status: 400 });
  }
  if (selfieFile.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image must be under 10MB" }, { status: 400 });
  }
  if (!selfieFile.type.startsWith("image/")) {
    return NextResponse.json({ error: "File must be an image" }, { status: 400 });
  }

  let jpgBytes: Buffer;
  try {
    jpgBytes = await sharp(Buffer.from(await selfieFile.arrayBuffer()))
      .rotate()
      .jpeg({ quality: 92 })
      .toBuffer();
  } catch (err) {
    console.error("Future Self JPG conversion error:", err);
    return NextResponse.json(
      { error: "Couldn't process that photo. Try a different image." },
      { status: 400 }
    );
  }

  try {
    const aging = await runAgingSimulation({
      bytes: jpgBytes,
      fileName: "selfie.jpg",
      contentType: "image/jpeg",
    });

    // Fetch every frame server-side immediately: the YouCam result URLs expire in ~2
    // hours, so the client only ever sees data: URLs it can keep and swap between.
    const frames = await Promise.all(
      aging.frames.map(async (f) => ({ age: f.age, dataUrl: await toDataUrl(f.url) }))
    );

    const defaultAges = pickDefaultAges(
      frames.map((f) => f.age),
      aging.estimatedAge,
      aging.ageMax
    );

    return NextResponse.json({
      estimatedAge: aging.estimatedAge,
      ageMin: aging.ageMin,
      ageMax: aging.ageMax,
      frames,
      defaultAges,
    });
  } catch (err) {
    if (err instanceof YouCamError) {
      const status = err.code === "timeout" ? 504 : 502;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    console.error("Unexpected Future Self error:", err);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}
