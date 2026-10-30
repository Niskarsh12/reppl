import type { BrandCategoryId, GoalId, ToneId } from "./types";

export const ONLINE_ONLY = "Online only";

export const GOALS: { id: GoalId; label: string; hint: string }[] = [
  { id: "awareness", label: "Reach new people", hint: "Get in front of audiences who haven't met you yet" },
  { id: "sales", label: "Drive sales", hint: "Send people straight to your product page" },
  { id: "launch", label: "Launch something new", hint: "Make a product or collection land" },
  { id: "community", label: "Build community", hint: "Show up where your people gather in person" },
  { id: "content", label: "Get content to reuse", hint: "Photos and video you can use on your own channels" },
];

export const MAX_GOALS = 2;

export const BUDGET_PRESETS = [2500, 10000, 25000];
export const MIN_BUDGET = 500;
export const MAX_BUDGET = 1_000_000;

export const CATEGORIES: { id: BrandCategoryId; label: string }[] = [
  { id: "food-drink", label: "Food & drink" },
  { id: "beauty-wellness", label: "Beauty & wellness" },
  { id: "fashion", label: "Fashion & accessories" },
  { id: "home-design", label: "Home & design" },
  { id: "tech-audio", label: "Tech & audio" },
  { id: "sport-outdoors", label: "Sport & outdoors" },
  { id: "family", label: "Kids & family" },
  { id: "finance", label: "Money & finance" },
  { id: "other", label: "Something else" },
];

export const TONES: { id: ToneId; label: string }[] = [
  { id: "warm", label: "Warm" },
  { id: "playful", label: "Playful" },
  { id: "refined", label: "Refined" },
  { id: "bold", label: "Bold" },
  { id: "technical", label: "Technical" },
  { id: "earnest", label: "Earnest" },
];

/** Interests that creators and events are tagged with. Brand text is scanned for these patterns. */
export const SCENES: { label: string; pattern: RegExp }[] = [
  { label: "Specialty coffee", pattern: /\b(coffee|espresso|roast(er|ery|ed)?|barista|pour.?over|matcha)\b/g },
  { label: "Natural wine", pattern: /\b(wine|wines|vineyard|sommelier|vermouth|cider)\b/g },
  { label: "Home cooking", pattern: /\b(recipe|recipes|kitchen|cook|cooking|bake|baking|chef|sauce|snack|snacks|pantry|spice)\b/g },
  { label: "Run clubs", pattern: /\b(run|running|runner|marathon|5k|10k|jog)\b/g },
  { label: "Yoga & breathwork", pattern: /\b(yoga|pilates|breath|breathwork|meditat\w*|mindful\w*|wellbeing|wellness)\b/g },
  { label: "Skincare rituals", pattern: /\b(skin|skincare|serum|cleanser|spf|moisturi[sz]er|cosmetic\w*|beauty)\b/g },
  { label: "Vintage & thrift", pattern: /\b(vintage|thrift|second.?hand|resale|pre.?loved|reworked)\b/g },
  { label: "Streetwear", pattern: /\b(streetwear|hoodie|hoodies|sneaker|sneakers|drop|drops|skate)\b/g },
  { label: "Slow fashion", pattern: /\b(linen|organic cotton|wool|knit\w*|tailor\w*|slow fashion|garment|garments)\b/g },
  { label: "Ceramics & craft", pattern: /\b(ceramic\w*|pottery|handmade|hand.?made|craft\w*|artisan\w*|maker|makers)\b/g },
  { label: "Interior design", pattern: /\b(interior\w*|furniture|lamp|lighting|decor|sofa|rug|rugs|homeware)\b/g },
  { label: "Vinyl & DJ culture", pattern: /\b(vinyl|dj|record|records|speaker|speakers|audio|headphone\w*|hi-?fi|music)\b/g },
  { label: "Indie gaming", pattern: /\b(game|games|gaming|gamer\w*|console|controller|esports)\b/g },
  { label: "Film photography", pattern: /\b(camera|cameras|film photo\w*|analog(ue)?|lens|lenses|photograph\w*)\b/g },
  { label: "Cycling", pattern: /\b(bike|bikes|bicycle|cycling|cyclist|e-?bike)\b/g },
  { label: "Outdoors & camping", pattern: /\b(outdoor\w*|camp|camping|hike|hiking|tent|trail|trails|mountain)\b/g },
  { label: "Plant care", pattern: /\b(plant|plants|garden\w*|botanic\w*|houseplant\w*|seed|seeds)\b/g },
  { label: "Zines & print", pattern: /\b(book|books|print|prints|zine|zines|magazine|stationery|notebook|paper)\b/g },
  { label: "Parenting", pattern: /\b(baby|babies|kid|kids|parent\w*|toddler\w*|family|families|child|children)\b/g },
  { label: "Personal finance", pattern: /\b(budget\w*|saving|savings|invest\w*|bank\w*|money|pension|credit)\b/g },
];

export const SCENE_LABELS = SCENES.map((s) => s.label);

export const CATEGORY_SCENES: Record<BrandCategoryId, string[]> = {
  "food-drink": ["Home cooking", "Specialty coffee", "Natural wine"],
  "beauty-wellness": ["Skincare rituals", "Yoga & breathwork", "Slow fashion"],
  fashion: ["Slow fashion", "Vintage & thrift", "Streetwear"],
  "home-design": ["Interior design", "Ceramics & craft", "Plant care"],
  "tech-audio": ["Vinyl & DJ culture", "Indie gaming", "Film photography"],
  "sport-outdoors": ["Run clubs", "Cycling", "Outdoors & camping"],
  family: ["Parenting", "Home cooking", "Ceramics & craft"],
  finance: ["Personal finance", "Zines & print", "Specialty coffee"],
  other: ["Ceramics & craft", "Zines & print", "Specialty coffee"],
};

export const CATEGORY_AUDIENCE: Record<BrandCategoryId, string> = {
  "food-drink": "People who care where their food comes from and like to host",
  "beauty-wellness": "People with a daily self-care routine who read ingredient lists",
  fashion: "People who buy fewer, better things and dress with intent",
  "home-design": "People who treat their home as a project and follow makers",
  "tech-audio": "Enthusiasts who research before they buy and talk gear with friends",
  "sport-outdoors": "Active people who train with others and plan weekends outside",
  family: "Parents looking for things that make family life easier and nicer",
  finance: "People getting serious about money who prefer plain talk to jargon",
  other: "People who discover brands through the creators and events they love",
};

export const CATEGORY_PATTERNS: Record<Exclude<BrandCategoryId, "other">, RegExp> = {
  "food-drink": /\b(food|drink|drinks|coffee|tea|wine|beer|snack\w*|recipe\w*|kitchen|chocolate|bakery|restaurant|oat|juice)\b/g,
  "beauty-wellness": /\b(skin\w*|beauty|serum|wellness|supplement\w*|cosmetic\w*|fragrance|hair|spa|yoga|vitamin\w*)\b/g,
  fashion: /\b(fashion|clothing|apparel|wear|shoe|shoes|sneaker\w*|jewel\w*|bag|bags|denim|collection|garment\w*)\b/g,
  "home-design": /\b(home|furniture|interior\w*|decor|lamp|lighting|ceramic\w*|kitchenware|bedding|sofa|rug|rugs)\b/g,
  "tech-audio": /\b(tech|software|app|apps|device\w*|headphone\w*|speaker\w*|audio|camera\w*|gaming|electronic\w*)\b/g,
  "sport-outdoors": /\b(sport\w*|running|bike|bikes|cycling|outdoor\w*|fitness|gym|training|athlet\w*|hike|hiking)\b/g,
  family: /\b(baby|babies|kid|kids|parent\w*|toddler\w*|family|children|nursery)\b/g,
  finance: /\b(bank\w*|finance|money|invest\w*|saving\w*|card|cards|loan\w*|pension\w*|insurance)\b/g,
};

export const TONE_PATTERNS: Record<ToneId, RegExp> = {
  warm: /\b(love|together|community|friends|family|care|cozy|cosy|home|welcome)\b/g,
  playful: /\b(fun|joy|happy|yay|playful|silly|delicious|tasty|wow)\b|!/g,
  refined: /\b(crafted|considered|timeless|heritage|luxury|premium|elegant|refined|artisan\w*)\b/g,
  bold: /\b(bold|loud|unapologetic|power\w*|fearless|radical|never|ultimate)\b/g,
  technical: /\b(engineered|performance|technology|precision|spec\w*|data|tested|lab|patent\w*)\b/g,
  earnest: /\b(sustainab\w*|planet|ethical|organic|fair|recycled|carbon|regenerative|honest)\b/g,
};

export function goalLabel(id: GoalId) {
  return GOALS.find((g) => g.id === id)?.label ?? id;
}

export function categoryLabel(id: BrandCategoryId) {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

/** "Allbirds’" rather than "Allbirds’s". */
export function possessive(name: string) {
  return /s$/i.test(name) ? `${name}’` : `${name}’s`;
}

export function money(n: number) {
  return usd.format(n);
}

export function count(n: number) {
  return n >= 10_000 ? compact.format(n) : n.toLocaleString("en-US");
}
