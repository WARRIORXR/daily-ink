import { useState } from 'react'

export default function TaskList({ tasks = [], onSave }) {
  const [draft, setDraft] = useState('')

  function addTask(event) {
    event.preventDefault()
    const title = draft.trim()
    if (!title) return
    // Client-generated ids keep toggles/deletes unambiguous in every mode;
    // in server mode the id is reused on insert.
    onSave([...tasks, { id: crypto.randomUUID(), title, done: false }])
    setDraft('')
  }

  // Index-based so toggles/deletes stay correct even for legacy tasks
  // that predate client-generated ids.
  function toggleTask(index) {
    onSave(tasks.map((task, i) => (i === index ? { ...task, done: !task.done } : task)))
  }

  function removeTask(index) {
    onSave(tasks.filter((_task, i) => i !== index))
  }

  function clearCompleted() {
    onSave(tasks.filter((task) => !task.done))
  }

  const doneCount = tasks.filter((t) => t.done).length

  return (
    <section aria-label="Tasks" className="space-y-3 rounded-2xl border border-border bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-ink">Tasks</h2>
        {doneCount > 0 && (
          <button
            type="button"
            onClick={clearCompleted}
            className="text-sm text-muted underline-offset-2 hover:text-ink hover:underline"
          >
            Clear completed
          </button>
        )}
      </div>

      <form onSubmit={addTask} className="flex gap-2">
        <label htmlFor={`task-input-${tasks.length}`} className="sr-only">
          New task
        </label>
        <input
          id={`task-input-${tasks.length}`}
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Add a task for today…"
          className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-ink outline-none ring-accent/30 placeholder:text-faint focus:ring-4"
        />
        <button
          type="submit"
          className="rounded-xl bg-surface-2 px-4 py-2.5 text-sm text-ink transition hover:bg-border"
        >
          Add
        </button>
      </form>

      {tasks.length === 0 ? (
        <p className="text-sm text-faint">No tasks — enjoy the open space.</p>
      ) : (
        <ul className="space-y-1.5">
          {tasks.map((task, index) => (
            <li key={task.id ?? `${task.title}-${index}`} className="group flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-surface-2/60">
              <input
                type="checkbox"
                id={`task-${task.id ?? task.title}-${index}`}
                checked={task.done}
                onChange={() => toggleTask(index)}
                className="h-4 w-4 shrink-0 accent-[var(--accent)]"
              />
              <label
                htmlFor={`task-${task.id ?? task.title}-${index}`}
                className={`min-w-0 flex-1 text-sm ${task.done ? 'text-faint line-through' : 'text-ink'}`}
              >
                {task.title}
              </label>
              <button
                type="button"
                onClick={() => removeTask(index)}
                aria-label={`Delete task: ${task.title}`}
                className="rounded-full p-1 text-faint opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100 hover:text-danger"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}