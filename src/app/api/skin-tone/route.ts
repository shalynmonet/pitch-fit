import { NextRequest, NextResponse } from "next/server";
import { runSkinToneAnalysis, YouCamError } from "@/lib/youcam";
import { deriveShadeMatch } from "@/lib/shade";

export const maxDuration = 60;

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

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

  try {
    const result = await runSkinToneAnalysis({
      bytes: Buffer.from(await selfieFile.arrayBuffer()),
      fileName: selfieFile.name || "selfie.jpg",
      contentType: selfieFile.type || "image/jpeg",
    });

    const shadeMatch = deriveShadeMatch(result.skinColorHex);

    return NextResponse.json({
      skinColorHex: result.skinColorHex,
      eyeColorName: result.eyeColorName,
      hairColorName: result.hairColorName,
      shadeMatch,
    });
  } catch (err) {
    if (err instanceof YouCamError) {
      const status = err.code === "timeout" ? 504 : 502;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    console.error("Unexpected skin tone analysis error:", err);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}
