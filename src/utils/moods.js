export const MOODS = [
  { key: 'great', emoji: '😄', label: 'Great' },
  { key: 'good', emoji: '🙂', label: 'Good' },
  { key: 'okay', emoji: '😐', label: 'Okay' },
  { key: 'low', emoji: '😔', label: 'Low' },
  { key: 'rough', emoji: '😣', label: 'Rough' },
]

export function moodByKey(key) {
  return MOODS.find((m) => m.key === key)
}