/**
 * Shared page masthead. Keeps every page's eyebrow, title, description and
 * actions aligned to the same rhythm.
 */
export default function PageHeader({ eyebrow, title, description, actions, children }) {
  return (
    <header className="animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="font-hand text-2xl leading-none text-accent">{eyebrow}</p>
          ) : null}
          <h1 className="mt-1 font-display text-3xl leading-tight tracking-tight text-ink sm:text-4xl">
            {title}
          </h1>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {description ? (
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
          {description}
        </p>
      ) : null}
      <div aria-hidden="true" className="hairline mt-4 w-24" />
      {children ? <div className="mt-4">{children}</div> : null}
    </header>
  )
}
