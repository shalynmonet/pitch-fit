import { NextRequest, NextResponse } from "next/server";
import { runClothVto, YouCamError, type GarmentCategory } from "@/lib/youcam";

export const maxDuration = 60;

const GARMENT_CATEGORIES: GarmentCategory[] = [
  "full_body",
  "lower_body",
  "upper_body",
  "shoes",
  "outer",
  "auto",
];

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

async function fileToBytes(file: File) {
  return Buffer.from(await file.arrayBuffer());
}

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const selfieFile = form.get("selfie");
  const garmentFile = form.get("garment");
  const garmentCategoryRaw = form.get("garmentCategory");

  if (!(selfieFile instanceof File) || !(garmentFile instanceof File)) {
    return NextResponse.json(
      { error: "Both 'selfie' and 'garment' image files are required" },
      { status: 400 }
    );
  }

  const garmentCategory = (garmentCategoryRaw ?? "auto") as string;
  if (!GARMENT_CATEGORIES.includes(garmentCategory as GarmentCategory)) {
    return NextResponse.json(
      { error: `garmentCategory must be one of: ${GARMENT_CATEGORIES.join(", ")}` },
      { status: 400 }
    );
  }

  if (selfieFile.size > MAX_IMAGE_BYTES || garmentFile.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Images must be under 10MB" }, { status: 400 });
  }
  if (!selfieFile.type.startsWith("image/") || !garmentFile.type.startsWith("image/")) {
    return NextResponse.json({ error: "Both files must be images" }, { status: 400 });
  }

  try {
    const resultDataUrl = await runClothVto(
      {
        bytes: await fileToBytes(selfieFile),
        fileName: selfieFile.name || "selfie.jpg",
        contentType: selfieFile.type || "image/jpeg",
      },
      {
        bytes: await fileToBytes(garmentFile),
        fileName: garmentFile.name || "garment.jpg",
        contentType: garmentFile.type || "image/jpeg",
      },
      garmentCategory as GarmentCategory
    );

    return NextResponse.json({ resultDataUrl });
  } catch (err) {
    if (err instanceof YouCamError) {
      const status = err.code === "timeout" ? 504 : 502;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    console.error("Unexpected VTO error:", err);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}
