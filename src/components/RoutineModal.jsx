import { useState } from 'react'
import Modal from './Modal'
import { formatIntervalSummary, PRESET_COLORS, PRESET_ICONS } from '../utils/routines'

export default function RoutineModal({ open, onClose, routines = [], onAddRoutine, onDeleteRoutine, initialDate }) {
  const [title, setTitle] = useState('')
  const [gapDays, setGapDays] = useState(3)
  const [startDate, setStartDate] = useState(initialDate || new Date().toISOString().slice(0, 10))
  const [color, setColor] = useState(PRESET_COLORS[0].hex)
  const [icon, setIcon] = useState('🚿')
  const [adjustFromLast, setAdjustFromLast] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const repeatInterval = Math.max(1, Number(gapDays) + 1)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) return

    setIsSubmitting(true)
    try {
      await onAddRoutine({
        title,
        gapDays: Number(gapDays),
        startDate,
        color,
        icon,
        adjustFromLast,
      })
      setTitle('')
      setGapDays(3)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Routines & Spaced Intervals">
      <div className="space-y-6 text-sm text-ink max-h-[75vh] overflow-y-auto pr-1">
        {/* Creation Form */}
        <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-surface-2/60 p-4 space-y-4">
          <p className="font-medium text-ink text-sm">Create New Routine</p>

          <div>
            <label htmlFor="routine-title" className="block text-xs font-medium text-muted mb-1">
              Routine Name
            </label>
            <div className="flex gap-2">
              <div className="relative">
                <button
                  type="button"
                  className="h-10 w-11 grid place-items-center rounded-xl border border-border bg-surface text-lg hover:border-accent/40 transition"
                  title="Pick Emoji Icon"
                >
                  {icon || '✨'}
                </button>
              </div>
              <input
                id="routine-title"
                type="text"
                required
                placeholder="e.g. Wash Hair, Water Plants, Laundry"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="flex-1 rounded-xl border border-border bg-surface px-3.5 py-2 text-sm text-ink outline-none ring-accent/30 placeholder:text-faint focus:ring-2"
              />
            </div>
            {/* Quick emoji presets */}
            <div className="mt-2 flex flex-wrap gap-1.5 items-center">
              <span className="text-[11px] text-faint mr-1">Quick:</span>
              {PRESET_ICONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIcon(emoji)}
                  className={`h-7 w-7 rounded-lg text-sm transition hover:scale-110 ${
                    icon === emoji ? 'bg-accent/20 ring-1 ring-accent' : 'hover:bg-surface-2'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="routine-start" className="block text-xs font-medium text-muted mb-1">
                First Date
              </label>
              <input
                id="routine-start"
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs sm:text-sm text-ink outline-none ring-accent/30 focus:ring-2"
              />
            </div>

            <div>
              <label htmlFor="routine-gap" className="block text-xs font-medium text-muted mb-1">
                Gap Between (Days)
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="routine-gap"
                  type="number"
                  min="0"
                  max="180"
                  required
                  value={gapDays}
                  onChange={(e) => setGapDays(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs sm:text-sm text-ink outline-none ring-accent/30 focus:ring-2"
                />
              </div>
            </div>
          </div>

          {/* Schedule explanation banner */}
          <div className="rounded-xl border border-accent/20 bg-accent/5 p-3 text-xs space-y-1">
            <p className="font-semibold text-accent">
              Schedule: {formatIntervalSummary(gapDays)}
            </p>
            <p className="text-muted leading-relaxed">
              With a gap of <strong>{gapDays} days</strong>, this activity will appear every <strong>{repeatInterval} days</strong> on your calendar (e.g. Day 1, Day {1 + repeatInterval}, Day {1 + repeatInterval * 2}…).
            </p>
          </div>

          {/* Color theme */}
          <div>
            <span className="block text-xs font-medium text-muted mb-1.5">Color Tag</span>
            <div className="flex items-center gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setColor(c.hex)}
                  aria-label={c.name}
                  className={`h-6 w-6 rounded-full transition-transform ${
                    color === c.hex ? 'scale-125 ring-2 ring-ink ring-offset-2 ring-offset-surface' : 'hover:scale-110 opacity-80'
                  }`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          </div>

          {/* Smart adjust toggle */}
          <label className="flex items-start gap-2.5 text-xs text-muted cursor-pointer select-none">
            <input
              type="checkbox"
              checked={adjustFromLast}
              onChange={(e) => setAdjustFromLast(e.target.checked)}
              className="mt-0.5 rounded border-border text-accent focus:ring-accent"
            />
            <span>
              <strong className="text-ink">Smart rescheduling:</strong> If completed a day early or late, automatically recalculate future dates from that day.
            </span>
          </label>

          <button
            type="submit"
            disabled={isSubmitting || !title.trim()}
            className="w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-on-accent transition hover:opacity-90 disabled:opacity-50 shadow-sm"
          >
            {isSubmitting ? 'Adding…' : '+ Add Routine to Calendar'}
          </button>
        </form>

        {/* Existing Routines List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-faint">
              Active Routines ({routines.length})
            </h3>
          </div>

          {routines.length === 0 ? (
            <p className="text-center py-4 text-xs text-muted">
              No routines added yet. Create one above to track on your calendar!
            </p>
          ) : (
            <div className="space-y-2">
              {routines.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-surface p-3 transition hover:border-accent/30"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-base shadow-sm"
                      style={{ backgroundColor: `${r.color}20`, color: r.color }}
                    >
                      {r.icon || '✨'}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-ink truncate text-sm">{r.title}</p>
                      <p className="text-xs text-muted truncate">
                        {formatIntervalSummary(r.gapDays)} • Started {r.startDate}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: r.color }}
                      title={`Tag: ${r.color}`}
                    />
                    <button
                      type="button"
                      onClick={() => onDeleteRoutine(r.id)}
                      className="rounded-lg p-1.5 text-faint hover:bg-danger/10 hover:text-danger transition"
                      title="Delete routine"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18" />
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
