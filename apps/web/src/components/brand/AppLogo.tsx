import type { ImgHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { APP_LOGO_SRC, APP_MARK_SRC, APP_NAME } from '@/lib/brand'

type Variant = 'full' | 'mark'

export function AppLogo({
  variant = 'full',
  className,
  ...props
}: {
  variant?: Variant
  className?: string
} & ImgHTMLAttributes<HTMLImageElement>) {
  if (variant === 'mark') {
    return (
      <img
        src={APP_MARK_SRC}
        alt=""
        aria-hidden
        className={cn('h-8 w-8 rounded object-cover', className)}
        {...props}
      />
    )
  }

  return (
    <img
      src={APP_LOGO_SRC}
      alt={APP_NAME}
      className={cn('h-10 w-auto max-w-[240px] object-contain', className)}
      {...props}
    />
  )
}
