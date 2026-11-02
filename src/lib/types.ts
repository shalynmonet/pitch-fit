export type Niche = "travel" | "wellness" | "fashion" | "maker" | "beauty" | "other";

export type GarmentCategory =
  | "full_body"
  | "lower_body"
  | "upper_body"
  | "shoes"
  | "outer"
  | "auto";

export type JewelryType = "necklace" | "earring" | "bracelet" | "ring" | "watch";
export type ProductType = "clothing" | JewelryType;

export const JEWELRY_TYPES: JewelryType[] = ["necklace", "earring", "bracelet", "ring", "watch"];

export function isJewelryType(type: ProductType): type is JewelryType {
  return type !== "clothing";
}

// Jewelry/watch product types are temporarily hidden: the 2d-vto/necklace endpoint
// has twice returned task_status "success" with a corrupted result (a ghosted
// double-placed necklace, then a blank cutout with no necklace at all) using
// well-formed inputs that match the documented requirements, and the other 2d-vto
// types (earring/bracelet/ring/watch) were never independently tested. Only
// Clothes VTO is exposed until each type is verified reliable. See
// research/heart-necklace-*.json for the raw repro.
export const PRODUCT_TYPES: { value: ProductType; label: string }[] = [
  { value: "clothing", label: "Clothing" },
];

/**
 * What kind of photo of the wearer each product type needs, and how to describe it.
 * Clothing's wording follows YouCam's documented Clothes VTO v4 "Target user image"
 * spec (docs.perfectcorp.com/reference/ai_clothes): shoulders and face fully visible,
 * facing forward, person filling most of the frame. The docs themselves conflict on
 * chest-up vs. full-body framing, and a full-body photo has since worked live, so
 * this doesn't tell users to crop tighter than they need to.
 */
export const PRODUCT_TYPE_PHOTO: Record<ProductType, { noun: string; hint: string }> = {
  clothing: {
    noun: "photo",
    hint:
      "Shoulders and face fully visible, facing the camera, standing straight — upper body or full body both work. JPG or PNG, under 10MB.",
  },
  necklace: { noun: "selfie", hint: "Face and neck visible, facing forward" },
  earring: { noun: "selfie", hint: "Face and ears visible, facing forward" },
  bracelet: { noun: "wrist photo", hint: "Wrist clearly visible, no sleeve covering it" },
  ring: { noun: "hand photo", hint: "Back of hand visible, all 5 fingers shown, nothing blocking it" },
  watch: { noun: "wrist photo", hint: "Wrist clearly visible, no sleeve covering it" },
};

/**
 * A separate, tighter headshot used only for the Skin AI features (Skin Strengths /
 * Shade Match), which need a different framing than the body selfie above: YouCam's
 * AI Skin Analysis and Facial Color Tones Analyzer docs both require the face to be
 * over 60% of the image width (Skin Analysis targets 60-80%), front-facing, and
 * level (not tilted up or down) — a loose chest-up body shot usually fails this.
 */
export const FACE_PHOTO_REQUIREMENTS = {
  noun: "face photo",
  hint:
    "Tight headshot, face filling 60-80% of the frame width, facing the camera with your chin level (not tilted up or down). Bright, even lighting, glasses off if you can. JPG or PNG, under 10MB.",
};

/**
 * Clothing's wording follows the same Clothes VTO v4 docs: a front-facing shot of a
 * single garment, fully visible, not combined with another item in one photo.
 */
export const PRODUCT_TYPE_PRODUCT_PHOTO_HINT: Record<ProductType, string> = {
  clothing:
    "Front-facing, one garment only, fully visible and unobstructed (not combined with another item). JPG or PNG, under 10MB.",
  necklace: "Front-facing product shot on a plain background",
  earring: "Front-facing product shot on a plain background",
  bracelet: "Front-facing product shot on a plain background",
  ring: "Product shot at a three-quarter angle, on a plain background",
  watch: "Front-facing product shot on a plain background",
};

export interface Concept {
  hooks: string[];
  shotList: string[];
  pitchEmail: string;
}

export const NICHES: { value: Niche; label: string }[] = [
  { value: "travel", label: "Travel" },
  { value: "wellness", label: "Wellness" },
  { value: "fashion", label: "Fashion" },
  { value: "maker", label: "Maker" },
  { value: "beauty", label: "Beauty" },
  { value: "other", label: "Other" },
];

export const GARMENT_CATEGORIES: { value: GarmentCategory; label: string }[] = [
  { value: "upper_body", label: "Top / upper body" },
  { value: "lower_body", label: "Bottoms / lower body" },
  { value: "full_body", label: "Full outfit / dress" },
  { value: "outer", label: "Jacket / outerwear" },
  { value: "shoes", label: "Shoes" },
  { value: "auto", label: "Not sure (auto-detect)" },
];
