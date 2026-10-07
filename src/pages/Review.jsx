import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import PageHeader from '../components/PageHeader'
import ReviewSession from '../components/ReviewSession'
import Spinner from '../components/Spinner'
import { useEntries } from '../hooks/useEntries'
import { useReviews } from '../hooks/useReviews'
import { useToast } from '../context/ToastContext'
import { buildDueQueue, nextReviewSchedule } from '../utils/spacedRepetition'

export default function Review() {
  const { toast } = useToast()
  const { entries, loading: entriesLoading } = useEntries()
  const { reviews, loading: reviewsLoading, upsertReview } = useReviews()
  const [index, setIndex] = useState(0)
  const [completed, setCompleted] = useState(0)

  const queue = useMemo(
    () => buildDueQueue(entries, reviews),
    [entries, reviews],
  )

  if (entriesLoading || reviewsLoading) return <Spinner label="Preparing your memories…" />

  if (queue.length === 0) {
    return (
      <div className="animate-fade-up space-y-6">
        <PageHeader eyebrow="spaced repetition" title="Review" />
        <EmptyState emoji="🌤️" title="All caught up">
          <p>
            No memories are due right now. Keep writing daily and revisit here — past pages
            resurface just as you start to forget them.
          </p>
          <Link to="/journal" className="mt-4 inline-block text-sm text-accent underline">
            Write today’s page
          </Link>
        </EmptyState>
      </div>
    )
  }

  const item = queue[index]
  const entry = entries[item.dateKey]
  const otherKeys = Object.keys(entries)

  function handleGrade(grade) {
    const current = item.review
    const schedule = nextReviewSchedule(
      current
        ? { repetitions: current.repetitions, easeFactor: current.easeFactor }
        : undefined,
      grade,
    )
    upsertReview(item.dateKey, schedule)
    setCompleted((c) => c + 1)

    if (index + 1 < queue.length) {
      setIndex((i) => i + 1)
    } else {
      toast('Review complete — memories refreshed', 'success')
      setCompleted((c) => c + 1)
      setIndex(-1) // sentinel: show completion
    }
  }

  if (index === -1 || index >= queue.length) {
    return (
      <div className="animate-fade-up space-y-6">
        <EmptyState emoji="🧠" title="Review complete">
          <p>{completed} memories refreshed. Come back tomorrow for more.</p>
          <Link to="/" className="mt-4 inline-block text-sm text-accent underline">
            Back to today
          </Link>
        </EmptyState>
      </div>
    )
  }

  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader
        eyebrow="spaced repetition"
        title="Review"
        description={`${queue.length - index} of ${queue.length} memories left`}
      />
      <ReviewSession
        key={item.dateKey}
        dateKey={item.dateKey}
        entry={entry}
        otherKeys={otherKeys}
        index={index}
        total={queue.length}
        onGrade={handleGrade}
      />
    </div>
  )
}