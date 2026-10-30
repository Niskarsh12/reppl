import type { ReactNode } from "react";

/** The title row every app stage opens with. The h1 takes focus when the stage changes. */
export function PageHeader({
  title,
  subline,
  actions,
  aside,
}: {
  title: ReactNode;
  subline?: ReactNode;
  actions?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5 pb-8 md:flex-row md:items-end md:justify-between md:gap-10">
      <div className="min-w-0 max-w-[44rem]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 id="stage-title" tabIndex={-1} className="type-title focus:outline-none">
            {title}
          </h1>
          {aside}
        </div>
        {subline && <div className="mt-2 text-base leading-relaxed text-ink-soft">{subline}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 md:justify-end">{actions}</div>}
    </div>
  );
}

export function Shell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className={`mx-auto px-5 pb-36 pt-24 sm:px-8 lg:px-10 lg:pt-28 ${wide ? "max-w-[1240px]" : "max-w-[1120px]"}`}>
      {children}
    </div>
  );
}
