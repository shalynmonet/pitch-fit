export type Niche = "travel" | "wellness" | "fashion" | "maker" | "beauty" | "other";

export type GarmentCategory =
  | "full_body"
  | "lower_body"
  | "upper_body"
  | "shoes"
  | "outer"
  | "auto";

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
