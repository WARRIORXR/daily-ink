import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import PageHeader from '../components/PageHeader'
import ReviewSession from '../components/ReviewSession'
import Spinner from '../components/Spinner'
import { useEntries } from '../hooks/useEntries'
import { useReviews } from '../hooks/useReviews'
import { useToast } from '../context/ToastContext'
import {
  buildDueQueue,
  describeInterval,
  loadReviewCap,
  nextReviewSchedule,
  reviewedToday,
} from '../utils/spacedRepetition'

export default function Review() {
  const { toast } = useToast()
  const { entries, loading: entriesLoading } = useEntries()
  const { reviews, loading: reviewsLoading, upsertReview } = useReviews()
  const [session, setSession] = useState(null) // today's queue, fixed when the page opens
  const [index, setIndex] = useState(0)
  const [completed, setCompleted] = useState(0)
  const loading = entriesLoading || reviewsLoading

  const cap = loadReviewCap()
  const doneBefore = useMemo(() => (loading ? 0 : reviewedToday(reviews)), [loading, reviews])
  const due = useMemo(
    () => (loading ? [] : buildDueQueue(entries, reviews)),
    [loading, entries, reviews],
  )

  // Freeze the queue once data is in: grading moves an entry's due date, and a
  // live queue would shift under the current position and skip memories.
  if (!loading && !session) setSession(due.slice(0, Math.max(0, cap - doneBefore)))

  if (loading || !session) return <Spinner label="Preparing your memories…" />

  const finished = index >= session.length
  if (finished) {
    const capReached = doneBefore + completed >= cap
    const waiting = Math.max(0, due.length - (session.length - index))
    return (
      <div className="animate-fade-up space-y-6">
        <PageHeader eyebrow="spaced repetition" title="Review" />
        <EmptyState emoji={completed ? '🧠' : '🌤️'} title="All done for today">
          <p>
            {completed ? `${completed} ${completed === 1 ? 'memory' : 'memories'} refreshed. ` : ''}
            {capReached && waiting
              ? `You've reached today's limit of ${cap}. ${waiting} more will wait for tomorrow.`
              : 'Nothing else is due. Past pages come back just as you start to forget them.'}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-4 text-sm">
            <Link to="/journal" className="text-accent underline">
              Write today’s page
            </Link>
            <Link to="/settings" className="text-muted underline">
              Change the daily limit
            </Link>
          </div>
        </EmptyState>
      </div>
    )
  }

  const item = session[index]
  const entry = entries[item.dateKey]
  const otherKeys = Object.keys(entries)
  const current = item.review
    ? {
        repetitions: item.review.repetitions,
        easeFactor: item.review.easeFactor,
        intervalDays: item.review.intervalDays,
      }
    : undefined
  const previews = Object.fromEntries(
    [0, 1, 2, 3].map((grade) => [
      grade,
      describeInterval(nextReviewSchedule(current, grade).intervalDays),
    ]),
  )

  function handleGrade(grade) {
    upsertReview(item.dateKey, nextReviewSchedule(current, grade))
    setCompleted((c) => c + 1)
    setIndex((i) => i + 1)
    if (index + 1 >= session.length) toast('Review complete — memories refreshed', 'success')
  }

  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader
        eyebrow="spaced repetition"
        title="Review"
        description={`${session.length - index} of ${session.length} left today`}
      />
      <ReviewSession
        key={item.dateKey}
        dateKey={item.dateKey}
        entry={entry}
        otherKeys={otherKeys}
        index={index}
        total={session.length}
        onGrade={handleGrade}
        previews={previews}
      />
    </div>
  )
}
