import { useState } from 'react'

/**
 * "Which day was this?" memory quiz. Options are date labels; the correct one
 * unlocks the memory.
 */
export default function MemoryQuiz({ prompt, options, correct, onCorrect, onReveal }) {
  const [picked, setPicked] = useState(null)
  const answered = picked !== null
  const correctOption = options.find((o) => o.key === correct)

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-accent">Memory check</p>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Before you peek, which day do you think this was from?
        </p>
        {prompt ? (
          <blockquote className="relative mt-3 rounded-xl border border-border bg-surface-2/40 px-5 py-4 pl-7 text-sm italic leading-relaxed text-ink">
            <span
              aria-hidden="true"
              className="absolute left-3 top-2 font-display text-2xl leading-none text-accent"
            >
              “
            </span>
            {prompt}
          </blockquote>
        ) : null}
      </div>

      <div role="group" aria-label="Pick the date" className="grid gap-2 sm:grid-cols-3">
        {options.map((option) => {
          const isCorrectOption = option.key === correct
          const isPicked = option.key === picked
          let style =
            'border-border bg-surface text-ink hover:-translate-y-0.5 hover:border-accent hover:shadow-card'
          if (answered && isCorrectOption) style = 'border-success bg-success/10 text-success'
          else if (answered && isPicked) style = 'border-danger bg-danger/10 text-danger'
          return (
            <button
              key={option.key}
              type="button"
              disabled={answered}
              onClick={() => setPicked(option.key)}
              className={`rounded-xl border px-3 py-2.5 text-sm shadow-sm transition duration-150 disabled:cursor-default disabled:hover:translate-y-0 disabled:hover:shadow-sm ${style}`}
            >
              {option.label}
            </button>
          )
        })}
      </div>

      {answered ? (
        <div className="animate-fade-in rounded-xl bg-surface-2/60 px-4 py-3 text-sm text-ink">
          <p>
            {picked === correct ? (
              <>
                <span aria-hidden="true">🎉</span> That’s right — {correctOption.label}. The memory
                is holding.
              </>
            ) : (
              <>
                Not quite — it was <strong>{correctOption.label}</strong>. Memory needs a nudge
                sometimes.
              </>
            )}
          </p>
          <button
            type="button"
            onClick={onCorrect}
            className="mt-3 rounded-full bg-accent px-4 py-2 text-sm text-on-accent shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
          >
            Reveal the entry
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onReveal}
          className="text-sm text-faint underline-offset-2 transition hover:text-muted hover:underline"
        >
          Just show me — skip the quiz
        </button>
      )}
    </div>
  )
}