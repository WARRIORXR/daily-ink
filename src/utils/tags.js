// Tags are #words written anywhere in a page, so they need no extra column and
// stay encrypted along with the text. "#Work" and "#work" are the same tag.
const TAG_RE = /(?:^|[^\p{L}\p{N}_&/#])#([\p{L}\p{N}_-]{1,40})/gu

export function extractTags(text) {
  const tags = new Set()
  for (const match of (text ?? '').matchAll(TAG_RE)) {
    const tag = match[1].replace(/^-+|-+$/g, '').toLowerCase()
    if (tag && !/^\d+$/.test(tag)) tags.add(tag)
  }
  return [...tags]
}

/** Every tag in use, most used first, as [tag, count] pairs. */
export function countTags(tagLists) {
  const counts = new Map()
  for (const list of tagLists) for (const tag of list) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

const fold = (s) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')

/** True when every word of the query appears somewhere in the text, ignoring case and accents. */
export function matchesQuery(text, query) {
  const terms = fold(query).split(/\s+/).filter(Boolean)
  if (!terms.length) return true
  const haystack = fold(text)
  return terms.every((term) => haystack.includes(term))
}
