// Stub — real action-chips parser was not committed in this snapshot.
// Returns the original prose with no chips so the UI degrades gracefully.

export interface ActionChip {
  id:    string
  label: string
  payload?: unknown
}

export interface ParsedChips {
  cleanProse: string
  chips:      ActionChip[]
}

export function parseActionChips(content: string): ParsedChips {
  return { cleanProse: content, chips: [] }
}
