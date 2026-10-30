export type GoalId = "awareness" | "sales" | "launch" | "community" | "content";

export interface CampaignSetup {
  url: string;
  /** Whole US dollars. */
  budget: number;
  goals: GoalId[];
  /** A city or region, or `ONLINE_ONLY`. */
  location: string;
}

export type BrandCategoryId =
  | "food-drink"
  | "beauty-wellness"
  | "fashion"
  | "home-design"
  | "tech-audio"
  | "sport-outdoors"
  | "family"
  | "finance"
  | "other";

export type ToneId = "warm" | "playful" | "refined" | "bold" | "technical" | "earnest";

export interface BrandProfile {
  /** Final URL after redirects. */
  url: string;
  domain: string;
  name: string;
  /** What the brand sells, in a sentence or two. */
  summary: string;
  category: BrandCategoryId;
  audience: string;
  tone: ToneId[];
  /** Audience interests that drive discovery. */
  signals: string[];
  origin: "page" | "manual";
  /** Which fields were lifted from the page itself rather than inferred. */
  fromPage: { name: boolean; summary: boolean };
}

export type ReadFailure = "invalid" | "unreachable" | "blocked" | "timeout" | "not-html" | "empty";

export interface PitchDraft {
  subject: string;
  body: string;
}

export interface TrackedLink {
  code: string;
  opportunityId: string;
  label: string;
  /** Destination with UTM parameters applied. */
  destination: string;
  createdAt: string;
}

export interface LinkStats extends TrackedLink {
  clicks: number;
  lastClickAt: string | null;
  /** Clicks per day for the last `DAYS` days, oldest first. */
  daily: number[];
}
