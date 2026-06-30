import { Link } from 'react-router-dom'
import { AppLogo } from '@/components/brand/AppLogo'
import { APP_NAME } from '@/lib/brand'
import { cn } from '@/lib/utils'

export function Logo({
  className,
  variant = 'full',
}: {
  className?: string
  variant?: 'full' | 'mark'
}) {
  return (
    <Link
      to="/"
      className={cn('inline-flex items-center', className)}
      aria-label={`${APP_NAME} — home`}
    >
      <AppLogo variant={variant} className={variant === 'full' ? 'h-9 max-w-[200px]' : undefined} />
    </Link>
  )
}
