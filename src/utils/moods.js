export const MOODS = [
  { key: 'great', emoji: '😄', label: 'Great', color: '#f59e0b' },
  { key: 'good', emoji: '🙂', label: 'Good', color: '#22c55e' },
  { key: 'okay', emoji: '😐', label: 'Okay', color: '#38bdf8' },
  { key: 'low', emoji: '😔', label: 'Low', color: '#818cf8' },
  { key: 'rough', emoji: '😣', label: 'Rough', color: '#f43f5e' },
]

export function moodByKey(key) {
  return MOODS.find((m) => m.key === key)
}
