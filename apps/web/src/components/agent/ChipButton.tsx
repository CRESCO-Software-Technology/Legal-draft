/**
 * ChipButton / ChipRow (A9 / P1 fix + U10)
 *
 * One-tap follow-up buttons rendered below a finalized assistant message.
 * Clicking a chip sends its label as the user's next message (the parent
 * passes `onSelect` wired to the send path).
 *
 * U10 — while the assistant is still streaming, render skeleton pills so
 * the row reserves space and the user anticipates the follow-ups.
 */
import { ArrowUpRight } from 'lucide-react'
import type { ActionChip } from './action-chips'

interface ChipRowProps {
  chips:      ActionChip[]
  onSelect?:  (chip: ActionChip) => void
  disabled?:  boolean
  streaming?: boolean
}

export function ChipRow({ chips, onSelect, disabled, streaming }: ChipRowProps) {
  if (streaming && chips.length === 0) {
    return (
      <div className="flex flex-wrap gap-1.5 mt-1" data-testid="chip-row-skeleton" aria-hidden>
        {[88, 124, 96].map((w, i) => (
          <span
            key={i}
            className="h-6 rounded-full bg-gray-100 animate-pulse"
            style={{ width: w }}
          />
        ))}
      </div>
    )
  }
  if (chips.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5 mt-1" data-testid="chip-row">
      {chips.map(chip => (
        <ChipButton key={chip.id} chip={chip} onSelect={onSelect} disabled={disabled} />
      ))}
    </div>
  )
}

export function ChipButton({ chip, onSelect, disabled }: {
  chip: ActionChip
  onSelect?: (c: ActionChip) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(chip)}
      disabled={disabled}
      data-testid={`chip-${chip.id}`}
      title={chip.label}
      className="inline-flex items-center gap-1 max-w-[280px] rounded-full border border-blue-200 bg-blue-50/60 px-2.5 py-1 text-[11.5px] text-blue-800 hover:bg-blue-100 hover:border-blue-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <span className="truncate">{chip.label}</span>
      <ArrowUpRight className="h-3 w-3 flex-shrink-0 text-blue-500" />
    </button>
  )
}
