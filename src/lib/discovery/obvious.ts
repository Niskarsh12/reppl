import type { BrandCategoryId } from "../campaign/types";

/**
 * The search a category directory would run before anyone looked at taste.
 * Tag queries are resolved against Qloo; the label is what we show the founder.
 */
export const OBVIOUS_SEARCH: Record<BrandCategoryId, { label: string; tags: string[] }> = {
  "food-drink": { label: "food and recipe podcasts", tags: ["cooking", "recipes"] },
  "beauty-wellness": { label: "beauty and wellness podcasts", tags: ["beauty", "skincare"] },
  fashion: { label: "fashion and sneaker podcasts", tags: ["fashion", "sneakers"] },
  "home-design": { label: "interior design podcasts", tags: ["interior design", "home decor"] },
  "tech-audio": { label: "tech and gadget podcasts", tags: ["technology", "gadgets"] },
  "sport-outdoors": { label: "running and fitness podcasts", tags: ["running", "fitness"] },
  family: { label: "parenting podcasts", tags: ["parenting", "family"] },
  finance: { label: "personal finance podcasts", tags: ["personal finance", "investing"] },
  other: { label: "lifestyle podcasts", tags: ["lifestyle"] },
};
