import { feasibleSelection, opportunityCost } from "./optimizer";
import { KINDS, isInPerson, kindCount } from "../discovery/kinds";
import type { CampaignIdea, Match, Opportunity, OpportunityKind } from "../discovery/types";
import { slugify } from "../links/utm";
import { ONLINE_ONLY, goalLabel, money } from "./catalog";
import type { BrandProfile, CampaignSetup, GoalId, LinkStats, PitchDraft } from "./types";

/** Stands in for the tracked link in pitch drafts until links exist. */
export const LINK_TOKEN = "[tracked link]";

export interface PlanLine {
  id: string;
  name: string;
  kind: OpportunityKind;
  format: string;
  amount: number;
}

export interface CampaignPlan {
  decisionBrief?: { mode?: "standard" | "conditional"; selectedIds?: string[]; portfolio: import("./optimizer").PortfolioResult; names: Record<string, string> };
  name: string;
  slug: string;
  objective: string;
  total: number;
  lines: PlanLine[];
  reserve: number;
  /** Budget the selected partners' typical fees can't absorb. */
  unallocated: number;
  /** Sum of the selected partners' lowest typical fees. */
  floor: number;
  timeline: { when: string; what: string }[];
  measures: string[];
  idea: Pick<CampaignIdea, "title" | "pitch" | "format"> | null;
}



export function campaignName(profile: BrandProfile, startedAt: string) {
  const month = new Date(startedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  return `${profile.name} ${month}`;
}

function joinList(items: string[]) {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

function partnerCount(matches: Match[]) {
  return joinList(
    KINDS.map((kind) => [kind, matches.filter((m) => m.opportunity.kind === kind).length] as const)
      .filter(([, n]) => n > 0)
      .map(([kind, n]) => kindCount(kind, n)),
  );
}

/** Complete upper estimates only; zero marks an excluded opportunity. */
export function splitBudget(total: number, matches: Match[]) {
  const budget = Number.isSafeInteger(total) && total >= 0 ? total : 0;
  let remaining = budget;
  const amounts = matches.map(m => {
    const cost = opportunityCost(m);
    if (cost === null || cost > remaining) return 0;
    remaining -= cost;
    return cost;
  });
  const reserve = Math.min(remaining, Math.floor(budget * 0.1));
  return { amounts, reserve, unallocated: remaining - reserve };
}

export function buildPlan(
  profile: BrandProfile,
  setup: CampaignSetup,
  matches: Match[],
  startedAt: string,
  idea: CampaignIdea | null = null,
): CampaignPlan {
  matches = feasibleSelection(matches, setup);
  const { amounts, reserve, unallocated } = splitBudget(setup.budget, matches);
  const name = campaignName(profile, startedAt);
  const slug = slugify(name);
  const where = setup.location === ONLINE_ONLY ? "online" : `around ${setup.location}`;
  const goals = setup.goals.map((g, i) => (i === 0 ? goalLabel(g) : goalLabel(g).toLowerCase()));

  const measures = ["Clicks on each tracked link, counted in Reppl"];
  if (setup.goals.includes("sales") || setup.goals.includes("launch"))
    measures.push(`Orders from utm_campaign=${slug} in your store analytics`);
  if (setup.goals.includes("awareness")) measures.push("Reach and new followers reported by each partner");
  if (setup.goals.includes("community") && matches.some((m) => isInPerson(m.opportunity.kind)))
    measures.push("Sign-ups and conversations at each event or pop-up");
  else if (setup.goals.includes("community")) measures.push("New followers and replies from each partner's audience");
  if (setup.goals.includes("content")) measures.push("Pieces of content you have the rights to reuse");

  return {
    name,
    slug,
    objective: `${joinList(goals)} with ${partnerCount(matches)} ${where}.`,
    total: setup.budget,
    lines: matches.map((m, i) => ({
      id: m.opportunity.id,
      name: m.opportunity.name,
      kind: m.opportunity.kind,
      format: m.opportunity.source === "offer" ? m.opportunity.formats.join("; ") : m.opportunity.formats[0],
      amount: amounts[i],
    })),
    reserve,
    unallocated,
    floor: matches.reduce((sum, m) => sum + m.opportunity.rate.min, 0),
    timeline: matches.some(m => m.opportunity.commercial) ? [
      { when: "Before booking", what: "Reconfirm the selected packages, availability, complete costs, delivery dates and usage rights." },
      ...matches.map(m => ({ when: "Delivery", what: `${m.opportunity.name}: ${m.opportunity.commercial?.offer.startDate || "start unconfirmed"} to ${m.opportunity.commercial?.offer.endDate || "end unconfirmed"}. ${m.opportunity.formats.join("; ")}.` })),
      { when: "After delivery", what: "Record sourced actual spend, delivery and results. Compare tracked clicks separately from partner reports and store orders." },
    ] : [
      { when: "Week 1", what: "Send pitches with each partner's tracked link" },
      { when: "Week 2", what: "Agree fees, dates and what each partner delivers" },
      { when: "Weeks 3–6", what: matches.some((m) => isInPerson(m.opportunity.kind)) ? "Content goes live and events take place" : "Content goes live" },
      { when: "Week 7", what: "Review clicks and decide who to work with again" },
    ],
    measures,
    idea: idea ? { title: idea.title, pitch: idea.pitch, format: idea.format } : null,
  };
}

const AUDIENCE: Record<OpportunityKind, string> = {
  artist: "fans",
  creator: "followers",
  podcast: "listeners",
  venue: "guests",
  brand: "customers",
  event: "guests",
};

const ASK: Record<GoalId, (brand: string, kind: OpportunityKind) => string> = {
  awareness: (brand, kind) => `introduce ${brand} to your ${AUDIENCE[kind]}`,
  sales: (brand, kind) => `get ${brand} into your ${AUDIENCE[kind]}' hands`,
  launch: (_, kind) => `make our next launch land with your ${AUDIENCE[kind]}`,
  community: () => "become a regular part of what you're building",
  content: () => "make something together that we can both share",
};

function addressee(o: Opportunity) {
  return o.kind === "creator" ? o.name.split(" ")[0] : `${o.name} team`;
}

/** Lower-cases a leading capital unless it starts an acronym like "DJ". */
const lowerFirst = (s: string) => (/^[A-Z]{2}/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));

/** Why this partner, in the partner's terms. Qloo tags are only quoted when they're shared interests. */
function fitLine(brand: string, match: Match) {
  const o = match.opportunity;
  const topics = (match.shared.length ? match.shared : o.source === "sample" ? o.tags.slice(0, 2) : []).map((s) => s.toLowerCase());
  const about = topics.length ? joinList(topics) : "";
  const evidence = o.source === "qloo" ? " Qloo suggests a cultural association; audience overlap remains unverified." : "";
  return `We're exploring a partnership${about ? ` around ${about}` : ""} for ${brand}. Your ${o.formats[0] ?? "sponsorship format"} could be a starting point; we'd like to confirm audience fit and availability with you.${evidence}`;
}

function subjectFor(brand: string, o: Opportunity) {
  if (o.commercial) return `${brand} × ${o.name}: ${o.commercial.offer.title}`;
  const format = lowerFirst(o.formats[0]);
  switch (o.kind) {
    case "creator":
      return `${brand} × ${o.name.split(" ")[0]}: a ${format} idea`;
    case "artist":
    case "podcast":
      return `${brand} × ${o.name}: a ${format} idea`;
    case "brand":
      return `${brand} × ${o.name}: a collab idea`;
    default:
      return `${brand} would love to partner with ${o.name}`;
  }
}

function firstSentence(text: string) {
  const trimmed = text.replace(/\s*…$/, "").trim();
  const end = trimmed.search(/[.!?](\s|$)/);
  return end === -1 ? trimmed : trimmed.slice(0, end);
}

export function draftPitch(profile: BrandProfile, setup: CampaignSetup, match: Match, amount: number, idea: CampaignIdea | null = null): PitchDraft {
  const o = match.opportunity;
  const playful = profile.tone.includes("playful");
  const refined = profile.tone.includes("refined");
  const summary = profile.summary ? firstSentence(profile.summary) : "";
  const intro = summary ? ` In a line: “${summary}.”` : "";
  const where = isInPerson(o.kind) && o.city ? ` We'd love to do this in ${o.city}.` : "";
  const to = addressee(o);
  const greeting = playful ? `Hi ${to}!` : refined ? `Hello ${to},` : `Hi ${to},`;
  const signoff = playful ? "Speak soon," : refined ? "With thanks," : "Thanks,";
  const ask = idea?.asks[o.id];
  const offer = o.commercial?.offer;
  const plan = offer ? `We are considering your “${offer.title}” package: ${offer.deliverables.join("; ")}. ${offer.startDate || offer.endDate ? `Delivery window: ${offer.startDate || "start to agree"} to ${offer.endDate || "end to agree"}.` : "Delivery dates still need to be agreed."} Our recorded total is ${money(amount)}, including declared extras. Please confirm availability, the full cost for this scope and usage rights before we commit.` : ask
    ? `${ask} We've set aside around ${money(amount)} for your part and are happy to shape the details with you.`
      : `We'd like to ${ASK[setup.goals[0]](profile.name, o.kind)}, perhaps with a ${lowerFirst(o.formats[0])}.${where} We've set aside around ${money(amount)} for this and are happy to shape the details with you.`;

  return {
    subject: subjectFor(profile.name, o),
    body: [
      greeting,
      `I'm writing from ${profile.name}.${intro}`,
      fitLine(profile.name, match),
      plan,
      `Here's where people can find us: ${LINK_TOKEN}`,
      "Would you be open to a quick call next week?",
      `${signoff}\nThe ${profile.name} team`,
    ].join("\n\n"),
  };
}

export function withLink(text: string, link?: string) {
  return link ? text.replaceAll(LINK_TOKEN, link) : text;
}

export function followUpNote(profile: BrandProfile, o: Opportunity) {
  return `Hi ${addressee(o)}, just bringing this back to the top of your inbox. We'd still love to work with you on a ${lowerFirst(o.formats[0])}, and we're happy to adapt the idea or the budget. Could we find 15 minutes this week?\n\nThe ${profile.name} team`;
}

export interface Recommendation {
  id: string;
  title: string;
  detail: string;
  action?: { kind: "follow-up"; opportunityId: string } | { kind: "go"; stage: "links" | "plan" };
}

const DAY = 86_400_000;

/** Next steps derived only from the click data on screen and the plan the user built. */
export function recommend(stats: LinkStats[], plan: CampaignPlan, goals: GoalId[], now = Date.now()): Recommendation[] {
  const total = stats.reduce((sum, s) => sum + s.clicks, 0);
  const ageDays = (s: LinkStats) => Math.floor((now - new Date(s.createdAt).getTime()) / DAY);
  const quiet = stats.filter((s) => s.clicks === 0 && ageDays(s) >= 3);
  const unopened = stats.filter((s) => s.clicks === 0 && ageDays(s) < 3);
  const out: Recommendation[] = [];

  if (total === 0 && quiet.length === 0) {
    out.push({
      id: "send",
      title: "Send your pitches",
      detail: `None of your ${stats.length} links has been opened yet, which is expected until partners hear from you. Each pitch on the Links step already includes its tracked link.`,
      action: { kind: "go", stage: "links" },
    });
  } else if (unopened.length > 0) {
    const names = unopened.map((s) => s.label);
    out.push({
      id: "waiting",
      title: `Waiting on ${names.length === 1 ? names[0] : `${names.length} partners`}`,
      detail: `${joinList(names)} ${names.length === 1 ? "hasn't" : "haven't"} had a click yet. That's normal for a new link; if you haven't sent ${names.length === 1 ? "that pitch" : "those pitches"}, they're ready on the Links step.`,
      action: { kind: "go", stage: "links" },
    });
  }

  const leader = [...stats].sort((a, b) => b.clicks - a.clicks)[0];
  if (leader && total >= 10 && leader.clicks / total >= 0.5) {
    const share = Math.round((leader.clicks / total) * 100);
    out.push({
      id: "back-leader",
      title: `Do more with ${leader.label}`,
      detail: `Their link drove ${share}% of clicks (${leader.clicks} of ${total}). ${plan.reserve + plan.unallocated > 0 ? `The ${money(plan.reserve + plan.unallocated)} you haven't committed could fund a second post or edition.` : "Consider a second post or edition."}`,
      action: { kind: "go", stage: "plan" },
    });
  }

  for (const s of quiet.slice(0, 2)) {
    out.push({
      id: `follow-${s.opportunityId}`,
      title: `Follow up with ${s.label}`,
      detail: `No clicks in the ${ageDays(s)} days since their link was created. A short, specific nudge usually gets a reply.`,
      action: { kind: "follow-up", opportunityId: s.opportunityId },
    });
  }

  if (total > 0 && (goals.includes("sales") || goals.includes("launch"))) {
    out.push({
      id: "check-sales",
      title: "Check what those clicks bought",
      detail: `Reppl counts clicks; purchases happen on your site. Filter your store analytics by utm_campaign=${plan.slug} to see orders.`,
    });
  }

  return out.slice(0, 3);
}
