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

export const PRODUCT_TYPES: { value: ProductType; label: string }[] = [
  { value: "clothing", label: "Clothing" },
  { value: "necklace", label: "Necklace" },
  { value: "earring", label: "Earrings" },
  { value: "bracelet", label: "Bracelet" },
  { value: "ring", label: "Ring" },
  { value: "watch", label: "Watch" },
];

/** What kind of photo of the wearer each product type needs, and how to describe it. */
export const PRODUCT_TYPE_PHOTO: Record<ProductType, { noun: string; hint: string }> = {
  clothing: { noun: "selfie", hint: "Shoulders + face visible, facing forward" },
  necklace: { noun: "selfie", hint: "Face and neck visible, facing forward" },
  earring: { noun: "selfie", hint: "Face and ears visible, facing forward" },
  bracelet: { noun: "wrist photo", hint: "Wrist clearly visible, no sleeve covering it" },
  ring: { noun: "hand photo", hint: "Back of hand visible, all 5 fingers shown, nothing blocking it" },
  watch: { noun: "wrist photo", hint: "Wrist clearly visible, no sleeve covering it" },
};

export const PRODUCT_TYPE_PRODUCT_PHOTO_HINT: Record<ProductType, string> = {
  clothing: "Front-facing, one item, no mockup text",
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
