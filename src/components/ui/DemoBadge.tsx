/** Marks content that is illustrative rather than real. Use wherever demo data appears. */
export function DemoBadge({ label = "Illustrative data" }: { label?: string }) {
  return (
    <span title="Catalogue partners, audience figures and costs are illustrative. Live Qloo entities are identified separately." className="pill pill-lavender">
      {label}
    </span>
  );
}

/** Credits Qloo where its recommendations are shown. */
export function QlooBadge() {
  return (
    <span title="Cultural signals and identified entities come from Qloo. Sponsorship availability and commercial facts are not verified." className="pill pill-moss">
      <span className="size-1.5 rounded-full bg-forest" aria-hidden />
      Powered by Qloo
    </span>
  );
}
