import { ineligibleReason, opportunityCost } from "./optimizer";
import type { AudienceProfile, CampaignIdea, Match, OpportunityKind } from "../discovery/types";
import { ONLINE_ONLY, money, possessive } from "./catalog";
import type { CampaignSetup, GoalId } from "./types";

export const MAX_IDEAS = 3;

interface Context {
  brand: string;
  setup: CampaignSetup;
  matches: Match[];
  used: Set<string>;
}

interface Written {
  title: string;
  /** The concept, written for the brand. */
  pitch: string;
  /** What we'd ask each anchor, in the same order, written to that partner. */
  asks: string[];
}

interface Template {
  format: string;
  /** Only one idea per family, so two ideas never lean on the same channel. */
  family: string;
  goals: GoalId[];
  /** Returns the matches the idea is built on, or null when they aren't available. */
  pick(ctx: Context): Match[] | null;
  write(ctx: Context, anchors: Match[]): Written;
}

const FIT_SCORE = { strong: 2, good: 1, stretch: 0 } as const;

function best(ctx: Context, kind: OpportunityKind, skip: Match[] = []): Match | null {
  const pool = ctx.matches.filter((m) => m.opportunity.kind === kind && !ctx.used.has(m.opportunity.id) && !skip.includes(m));
  return (
    [...pool].sort((a, b) => {
      const score = (m: Match) =>
        (m.conversation === "mutual" ? 5 : 0) + (m.withinBudget ? 3 : 0) + FIT_SCORE[m.fit] + (m.opportunity.affinity ?? 0);
      return score(b) - score(a);
    })[0] ?? null
  );
}

const local = (ctx: Context) => ctx.setup.location !== ONLINE_ONLY;
const lower = (s: string) => (/^[A-Z]{2}/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));

const TEMPLATES: Template[] = [
  {
    format: "Live night",
    family: "music",
    goals: ["community", "launch", "awareness", "content"],
    pick(ctx) {
      if (!local(ctx)) return null;
      const artist = best(ctx, "artist");
      const room = best(ctx, "venue") ?? best(ctx, "event");
      return artist && room ? [artist, room] : null;
    },
    write({ brand }, [artist, room]) {
      const a = artist.opportunity.name;
      const r = room.opportunity.name;
      return {
        title: `${a}, live at ${r}`,
        pitch: `An intimate ${a} set at ${r} for around a hundred of ${possessive(brand)} people. Product in every hand, and the night filmed for both of your channels.`,
        asks: [
          `We're planning an intimate night at ${r} for around a hundred of our customers, and we'd love you to play a short set. We'd film it for both our channels.`,
          `We'd love to host an intimate ${a} set at ${r} for around a hundred of our customers, with ${brand} in every guest's hands.`,
        ],
      };
    },
  },
  {
    format: "Music collab",
    family: "music",
    goals: ["content", "awareness", "launch"],
    pick(ctx) {
      const artist = best(ctx, "artist");
      return artist ? [artist] : null;
    },
    write({ brand }, [artist]) {
      const a = artist.opportunity.name;
      return {
        title: `${/^[AEIOU]/i.test(brand) ? "An" : "A"} ${brand} session with ${a}`,
        pitch: `Commission ${a} for a short live session or a co-curated playlist, released on both your channels with a link back to ${brand}.`,
        asks: ["We'd love to commission a short live session or a co-curated playlist with you, released on both our channels."],
      };
    },
  },
  {
    format: "Podcast run",
    family: "podcast",
    goals: ["sales", "awareness", "launch"],
    pick(ctx) {
      const show = best(ctx, "podcast");
      return show ? [show] : null;
    },
    write(_, [show]) {
      const p = show.opportunity.name;
      return {
        title: `Three episodes on ${p}`,
        pitch: `A host-read spot across three episodes of ${p}, with a listener offer that runs through your tracked link to measure clicks and review orders in your store analytics.`,
        asks: ["We'd like to run a host-read spot across three episodes, with a listener offer through a tracked link so we can both see what it drives."],
      };
    },
  },
  {
    format: "Brand collab",
    family: "brand",
    goals: ["launch", "sales", "awareness"],
    pick(ctx) {
      const partner = best(ctx, "brand");
      return partner ? [partner] : null;
    },
    write({ brand }, [partner]) {
      const b = partner.opportunity.name;
      return {
        title: `${brand} × ${b}`,
        pitch: `A limited co-branded bundle with ${b}, announced to both customer lists on the same day, with costs and content split down the middle.`,
        asks: ["We'd love to put together a limited co-branded bundle with you, announced to both our customer lists on the same day, with costs and content split down the middle."],
      };
    },
  },
  {
    format: "Pop-up",
    family: "in-person",
    goals: ["community", "sales", "launch"],
    pick(ctx) {
      if (!local(ctx)) return null;
      const venue = best(ctx, "venue");
      if (!venue) return null;
      const host = best(ctx, "creator");
      return host ? [venue, host] : [venue];
    },
    write({ brand }, [venue, host]) {
      const v = venue.opportunity.name;
      const h = host?.opportunity.name;
      return {
        title: `A weekend at ${v}`,
        pitch: `Take over ${v} for a weekend${h ? ` with ${h} hosting` : ""}: try-before-you-buy, a small edit of ${brand} to take home, and content captured on the day.`,
        asks: [
          `We'd love to take over ${v} for a weekend${h ? `, with ${h} hosting` : ""}: try-before-you-buy and a small edit of ${brand} for people to take home.`,
          ...(h ? [`We're planning a weekend pop-up at ${v} and would love you to host it and capture content on the day.`] : []),
        ],
      };
    },
  },
  {
    format: "Event presence",
    family: "in-person",
    goals: ["community", "awareness", "sales"],
    pick(ctx) {
      if (!local(ctx)) return null;
      const event = best(ctx, "event");
      if (!event) return null;
      const voice = best(ctx, "creator");
      return voice ? [event, voice] : [event];
    },
    write(_, [event, voice]) {
      const e = event.opportunity;
      const format = lower(e.formats[0]);
      const v = voice?.opportunity.name;
      return {
        title: `Show up at ${e.name}`,
        pitch: `${e.formats[0]} at ${e.name}${v ? `, with ${v} posting before and after so people know to look for you` : ""}.`,
        asks: [
          `We'd like to do ${format} at ${e.name}${v ? `, with ${v} posting before and after so people know to look for us` : ""}.`,
          ...(v ? [`We'll be at ${e.name} with ${format}, and we'd love you to post before and after so your followers know to come and find us.`] : []),
        ],
      };
    },
  },
  {
    format: "Creator series",
    family: "creator",
    goals: ["content", "awareness", "sales"],
    pick(ctx) {
      const first = best(ctx, "creator");
      if (!first) return null;
      const second = best(ctx, "creator", [first]) ?? best(ctx, "podcast");
      return second ? [first, second] : [first];
    },
    write({ brand }, anchors) {
      const names = anchors.map((m) => m.opportunity.name);
      const format = lower(anchors[0].opportunity.formats[0]);
      const ask = (i: number) => {
        const other = names[1 - i];
        const piece = lower(anchors[i].opportunity.formats[0]);
        return `We're planning a week of content${other && anchors.length > 1 ? ` with you and ${other}` : ""}: you'd make a ${piece} with ${brand} in it, and we'd like the rights to reuse it on our own channels.`;
      };
      return {
        title: anchors.length > 1 ? `A week with ${names[0]} and ${names[1]}` : `A ${format} with ${names[0]}`,
        pitch:
          anchors.length > 1
            ? `${names[0]} and ${names[1]} each make something with ${brand} in it, posted in the same week; audience overlap and incremental reach remain unknown.`
            : `${names[0]} makes a ${format} with ${brand} in it, with usage rights so you can reuse it on your own channels.`,
        asks: anchors.map((_, i) => ask(i)),
      };
    },
  },
];

function joinList(items: string[]) {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

function why(anchors: Match[], audience: AudienceProfile, brand: string) {
  const shared = [...new Set(anchors.flatMap((m) => m.shared))].slice(0, 2).map((s) => s.toLowerCase());
  const scored = anchors.filter((m) => m.opportunity.affinity !== undefined).sort((a, b) => b.opportunity.affinity! - a.opportunity.affinity!)[0];
  const who = audience.entity ? `${possessive(brand)} audience` : "your audience";
  const parts: string[] = [];
  if (scored) parts.push(`Qloo scores ${scored.opportunity.name} with raw affinity ${scored.opportunity.affinity} for ${who}; this is not audience overlap.`);
  else if (anchors.some((m) => m.opportunity.source === "qloo")) parts.push(`Qloo ranks ${anchors[0].opportunity.name} among the closest matches to ${who}.`);
  if (shared.length) parts.push(`${anchors.length > 1 ? "Together they cover" : "It shares"} ${joinList(shared)}.`);
  if (anchors.some((m) => m.conversation === "mutual"))
    parts.push("Their audience points back at the same culture, so the pitch has a real conversation to start.");
  if (!parts.length) parts.push(`Built on the closest ${anchors.length > 1 ? "matches" : "match"} we found for ${brand}.`);
  return parts.join(" ");
}

function budgetLine(cost: CampaignIdea["cost"], budget: number) {
  if (cost.max <= budget) return `Even at the top of the range, it leaves ${money(budget - cost.max)} of your ${money(budget)}.`;
  if (cost.min <= budget) return `Fits your ${money(budget)} if fees land at the lower end.`;
  return `Costs more than your ${money(budget)}, so treat it as a stretch.`;
}

/** Up to three campaign concepts, each built on specific recommended partners. */
export function buildIdeas(brand: string, setup: CampaignSetup, audience: AudienceProfile, matches: Match[]): CampaignIdea[] {
  const eligible = matches.filter(m => !ineligibleReason(m, setup) && opportunityCost(m)! <= setup.budget);
  const ctx: Context = { brand, setup, matches: eligible, used: new Set() };
  const remaining = [...TEMPLATES];
  const ideas: CampaignIdea[] = [];

  while (ideas.length < MAX_IDEAS && remaining.length) {
    const options = remaining
      .map((template) => {
        const anchors = template.pick(ctx);
        if (!anchors) return null;
        const cost = {
          min: anchors.reduce((s, m) => s + m.opportunity.rate.min, 0),
          max: anchors.reduce((s, m) => s + m.opportunity.rate.max, 0),
        };
        if (cost.max > setup.budget) return null;
        const goalScore = setup.goals.reduce((s, g, i) => s + (template.goals.includes(g) ? (i === 0 ? 4 : 2) : 0), 0);
        const fitScore = anchors.reduce((s, m) => s + FIT_SCORE[m.fit] + (m.opportunity.affinity ?? 0) * 2, 0) / anchors.length;
        const mutual = anchors.filter((m) => m.conversation === "mutual").length;
        const budgetScore = cost.max <= setup.budget ? 6 : cost.min <= setup.budget ? -2 : -20;
        const score = goalScore + fitScore + budgetScore + mutual * 3 + (anchors.length > 1 ? 0.5 : 0);
        return { template, anchors, cost, score };
      })
      .filter((o): o is NonNullable<typeof o> => o !== null)
      .sort((a, b) => b.score - a.score);

    const top = options[0];
    if (!top) break;
    for (let i = remaining.length - 1; i >= 0; i--) if (remaining[i].family === top.template.family) remaining.splice(i, 1);
    top.anchors.forEach((m) => ctx.used.add(m.opportunity.id));
    const { title, pitch, asks } = top.template.write(ctx, top.anchors);
    ideas.push({
      id: `${top.template.format}-${top.anchors.map((m) => m.opportunity.id).join("-")}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-").slice(0, 120),
      format: top.template.format,
      title,
      pitch,
      asks: Object.fromEntries(top.anchors.map((m, i) => [m.opportunity.id, asks[i]])),
      why: `${why(top.anchors, audience, brand)} ${budgetLine(top.cost, setup.budget)}`,
      anchors: top.anchors.map((m) => m.opportunity.id),
      cost: top.cost,
      goals: setup.goals.filter((g) => top.template.goals.includes(g)),
    });
  }
  return ideas;
}
