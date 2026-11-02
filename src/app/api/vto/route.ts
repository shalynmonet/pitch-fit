import { NextRequest, NextResponse } from "next/server";
import { runClothVto, runJewelryVto, YouCamError, type GarmentCategory, type JewelryType } from "@/lib/youcam";

export const maxDuration = 60;

const GARMENT_CATEGORIES: GarmentCategory[] = [
  "full_body",
  "lower_body",
  "upper_body",
  "shoes",
  "outer",
  "auto",
];

const JEWELRY_TYPES: JewelryType[] = ["necklace", "earring", "bracelet", "ring", "watch"];

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
  const productFile = form.get("product");
  const productType = (form.get("productType") ?? "clothing") as string;
  const garmentCategoryRaw = form.get("garmentCategory");

  if (!(selfieFile instanceof File) || !(productFile instanceof File)) {
    return NextResponse.json(
      { error: "Both a photo of the wearer and a product image are required" },
      { status: 400 }
    );
  }

  if (productType !== "clothing" && !JEWELRY_TYPES.includes(productType as JewelryType)) {
    return NextResponse.json(
      { error: `productType must be one of: clothing, ${JEWELRY_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  if (selfieFile.size > MAX_IMAGE_BYTES || productFile.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Images must be under 10MB" }, { status: 400 });
  }
  if (!selfieFile.type.startsWith("image/") || !productFile.type.startsWith("image/")) {
    return NextResponse.json({ error: "Both files must be images" }, { status: 400 });
  }

  try {
    const wearerPhoto = {
      bytes: await fileToBytes(selfieFile),
      fileName: selfieFile.name || "photo.jpg",
      contentType: selfieFile.type || "image/jpeg",
    };
    const product = {
      bytes: await fileToBytes(productFile),
      fileName: productFile.name || "product.jpg",
      contentType: productFile.type || "image/jpeg",
    };

    let resultDataUrl: string;
    if (productType === "clothing") {
      const garmentCategory = (garmentCategoryRaw ?? "auto") as string;
      if (!GARMENT_CATEGORIES.includes(garmentCategory as GarmentCategory)) {
        return NextResponse.json(
          { error: `garmentCategory must be one of: ${GARMENT_CATEGORIES.join(", ")}` },
          { status: 400 }
        );
      }
      resultDataUrl = await runClothVto(wearerPhoto, product, garmentCategory as GarmentCategory);
    } else {
      resultDataUrl = await runJewelryVto(productType as JewelryType, wearerPhoto, product);
    }

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
