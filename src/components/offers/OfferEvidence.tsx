import { money } from "@/lib/campaign/catalog";
import type { SponsorshipOffer } from "@/lib/offers/types";
export function OfferEvidence({ offer, warnings }: { offer: SponsorshipOffer; warnings: string[] }) {
  return <div className="mt-3 grid gap-3 text-sm leading-relaxed">
    <dl className="grid gap-3 sm:grid-cols-2">
      <div><dt className="font-medium">Price evidence</dt><dd className="break-words text-ink-soft">{offer.price.amount === null ? "Unknown amount" : `${money(offer.price.amount)} + ${money(offer.price.extras)} extras`} · {offer.price.basis}<br />{offer.price.source || "No source"}<br />Checked {offer.price.checkedAt || "date missing"}{offer.price.validUntil ? ` · valid until ${offer.price.validUntil}` : ""}<br />Extras {offer.price.extrasConfirmed ? "checked for this scope" : "unconfirmed"}</dd></div>
      <div><dt className="font-medium">Availability evidence</dt><dd className="break-words text-ink-soft">{offer.availability.status}<br />{offer.availability.source || "No source"}<br />Checked {offer.availability.checkedAt || "date missing"}{offer.availability.validUntil ? ` · valid until ${offer.availability.validUntil}` : ""}</dd></div>
      <div><dt className="font-medium">Audience evidence</dt><dd className="break-words text-ink-soft">{offer.audience.size === null ? "Audience size unknown" : `${offer.audience.size.toLocaleString()} ${offer.audience.unit}`} · {offer.audience.basis}<br />{offer.audience.source || "No source"}<br />Checked {offer.audience.checkedAt || "date missing"}<br />{offer.audience.description}</dd></div>
      <div><dt className="font-medium">Scope and timing</dt><dd className="break-words text-ink-soft">{offer.deliverables.join("; ")}<br />{offer.delivery === "online" ? `Online${offer.market ? ` · ${offer.market}` : ""}` : offer.market}<br />{offer.startDate || "Start unconfirmed"} – {offer.endDate || "End unconfirmed"}</dd></div>
    </dl>
    <ul className="grid gap-1 text-ink-faint">{warnings.map(w => <li key={w}>{w}</li>)}</ul>
  </div>;
}
