import { createElement } from "react";
import { withLink } from "@/lib/campaign/plan";
import type { TrackedLink } from "@/lib/campaign/types";
import { shortLink, slugify } from "@/lib/links/utm";
import type { Campaign } from "../journey/useCampaign";

/** Renders the campaign plan and pitches to a vector PDF in the browser and downloads it. */
export async function exportPlanPdf(campaign: Campaign, links: TrackedLink[], origin: string) {
  const [{ pdf }, { PlanPdf, registerFonts }] = await Promise.all([import("@react-pdf/renderer"), import("./PlanPdf")]);
  registerFonts(origin);

  const pitches = campaign.matches.map((m) => {
    const pitch = campaign.pitches[m.opportunity.id];
    const link = links.find((l) => l.opportunityId === m.opportunity.id);
    return {
      name: m.opportunity.name,
      detail: m.opportunity.detail,
      pitch: { subject: pitch.subject, body: withLink(pitch.body, link && shortLink(link.code, origin)) },
    };
  });

  const element = createElement(PlanPdf, {
    brand: campaign.profile.name,
    domain: campaign.profile.domain,
    plan: campaign.plan,
    pitches,
    isDemo: campaign.isDemo,
  });
  const blob = await pdf(element as Parameters<typeof pdf>[0]).toBlob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${slugify(campaign.plan.name)}-plan.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
