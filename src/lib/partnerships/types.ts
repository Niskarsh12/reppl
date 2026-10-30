export interface EventBrief {
  name: string;
  location: string;
  description: string;
  scenes: string[];
  artists: string;
  objective: string;
  /** Organizer-confirmed experiences available for a partnership. */
  assets?: string[];
}

export interface PartnershipCandidate {
  id: string;
  name: string;
  description?: string;
  affinity?: number;
  tags: { id: string; name: string }[];
  type?: string;
}

export interface PartnershipResearch {
  generatedAt: string;
  seeds: { id: string; name: string; kind: "interest" | "artist" }[];
  unresolved: string[];
  candidates: PartnershipCandidate[];
  notes: string[];
  locationApplied: boolean;
}

export const EXAMPLE_BRIEF: EventBrief = {
  name: "After Hours",
  location: "London",
  description: "An independent culture festival bringing together record collectors, emerging DJs, print makers and the city's creative communities. Intimate listening sessions, a makers market and late-night sets.",
  scenes: ["Vinyl & DJ culture", "Streetwear", "Zines & print", "Specialty coffee"],
  artists: "",
  objective: "Build a partnership that adds something meaningful to the festival experience.",
  assets: ["listening-room", "creative-workshop", "hospitality"],
};

export const EMPTY_BRIEF: EventBrief = { name: "", location: "", description: "", scenes: [], artists: "", objective: "" };

export interface InvestigationBranch {
  id: "music" | "lifestyle" | "artists";
  label: string;
  status: "retrieved" | "empty" | "failed" | "skipped";
  endpoint: string;
  params: Record<string, string | number>;
  records: { id: string; name: string; affinity?: number }[];
  note: string;
}

export interface BrandInvestigation {
  candidateId: string;
  generatedAt: string;
  branches: InvestigationBranch[];
  connections: { input: string; name: string; id: string; matchedBy: "id" | "label"; source: string }[];
  verdict: "connections-found" | "needs-validation" | "limited-data";
  summary: string;
  limitations: string[];
}
