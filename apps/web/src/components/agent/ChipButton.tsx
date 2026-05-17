// Stub — real ChipButton/ChipRow components were not committed in this
// snapshot. Renders nothing so the chat UI still works without action chips.

import type { ActionChip } from './action-chips'

interface ChipRowProps {
  chips:      ActionChip[]
  onSelect?:  (chip: ActionChip) => void
  disabled?:  boolean
  streaming?: boolean
}

export function ChipRow(_props: ChipRowProps) {
  return null
}

export function ChipButton(_props: { chip: ActionChip; onSelect?: (c: ActionChip) => void; disabled?: boolean }) {
  return null
}
