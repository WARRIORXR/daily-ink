import { quizOptions, snippet } from '../core'
import { formatQuizDate } from './formatDate'

/**
 * Build a "which day was this?" quiz. The prompt is a snippet of the entry;
 * the options are three dates, one of them correct. Option picking and
 * shuffling run in Rust; the seed comes from here.
 */
export function buildDateQuiz(dateKey, text, otherEntryKeys = []) {
  const seed = Math.floor(Math.random() * 0xffffffff) >>> 0
  const options = quizOptions(dateKey, [...otherEntryKeys], seed)
  return {
    prompt: snippet(text || '', 140),
    correct: dateKey,
    options: options.map((key) => ({ key, label: formatQuizDate(key) })),
  }
}
