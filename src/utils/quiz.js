import { addDaysToKey, formatQuizDate } from './formatDate'

function shuffle(array) {
  const copy = [...array]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function snippetOf(text, length = 140) {
  const clean = (text || '').trim().replace(/\s+/g, ' ')
  if (clean.length <= length) return clean
  return `${clean.slice(0, length).trimEnd()}…`
}

/**
 * Build a "which day was this?" quiz. The prompt is a snippet of the entry;
 * the options are dates, one of which is the correct one.
 * Distractors come from the user's other entries, padded with synthetic dates
 * when there aren't enough.
 */
export function buildDateQuiz(dateKey, text, otherEntryKeys = []) {
  const prompt = snippetOf(text)

  const others = shuffle(otherEntryKeys.filter((k) => k !== dateKey))
  const distractors = []
  let fallback = 1
  while (distractors.length < 2) {
    if (others.length) {
      distractors.push(others.shift())
    } else {
      distractors.push(addDaysToKey(dateKey, -fallback))
      fallback += 1
    }
  }

  const options = shuffle([dateKey, ...distractors])
  return {
    prompt,
    correct: dateKey,
    options: options.map((key) => ({ key, label: formatQuizDate(key) })),
  }
}