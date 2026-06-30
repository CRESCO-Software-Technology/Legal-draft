/**
 * Wordmark — the CRESCO Legal brand wordmark.
 *
 *   CRESCO   slate-600 / semibold — graphite pencil gray, the
 *                                  "work-in-progress" half
 *   Legal   emerald-700 / bold   — authoritative, the
 *                                  "signed and final" half
 *
 * The color split is the brand: drafts (gray, in-flux) become legally
 * binding (green, final). Same component used in the sidebar, login
 * page, invite page — anywhere the brand needs to render.
 *
 * `kind="full"` shows "CRESCO Legal"; `kind="mark"` shows just "CL"
 * for the collapsed sidebar.
 */
import { APP_NAME } from '@/lib/brand'
import { cn } from '@/lib/utils'

type Size = 'sm' | 'md' | 'lg' | 'xl' | '2xl'

const SIZE: Record<Size, string> = {
  sm:    'text-sm',
  md:    'text-base',
  lg:    'text-lg',
  xl:    'text-xl',
  '2xl': 'text-2xl',
}

export function Wordmark({
  size = 'md',
  kind = 'full',
  className,
}: {
  size?:      Size
  kind?:      'full' | 'mark'
  className?: string
}) {
  const cresco = kind === 'full' ? 'CRESCO' : 'C'
  const legal = kind === 'full' ? 'Legal' : 'L'
  return (
    <span
      className={cn('inline-flex tracking-tight select-none', SIZE[size], className)}
      aria-label={APP_NAME}
    >
      {/* Weight contrast (medium → bold) reinforces "tentative → committed".
          Slate-700 reads as ink-on-paper graphite; emerald-700 carries the
          authority. Together: "drafts become legally binding". */}
      <span className="font-medium text-slate-700">{cresco}</span>
      <span className="font-bold text-emerald-700">{legal}</span>
    </span>
  )
}
