'use client'

import { cn } from '@/lib/utils'
import { Container } from './container'

interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * Whether to add vertical padding
   * @default true
   */
  padded?: boolean
  /**
   * Background variant
   * @default 'default'
   */
  variant?: 'default' | 'cream' | 'warm' | 'muted' | 'dark'
  /**
   * Whether to add a top border
   * @default false
   */
  borderTop?: boolean
  /**
   * Whether to add a bottom border
   * @default false
   */
  borderBottom?: boolean
  /**
   * Container max width
   * @default '7xl'
   */
  containerMaxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '7xl' | 'full'
}

const variantClasses = {
  default: 'bg-transparent',
  cream: 'bg-[#f7f4ee]',
  warm: 'bg-[#f0ebe3]',
  muted: 'bg-[#fdfcfa]',
  dark: 'bg-stone-950 text-white',
}

export function Section({
  children,
  className,
  padded = true,
  variant = 'default',
  borderTop = false,
  borderBottom = false,
  containerMaxWidth = '7xl',
  ...props
}: SectionProps) {
  return (
    <section
      className={cn(
        variantClasses[variant],
        padded && 'py-14 sm:py-20 lg:py-24',
        borderTop && 'border-t border-amber-900/10',
        borderBottom && 'border-b border-amber-900/10',
        className
      )}
      {...props}
    >
      <Container maxWidth={containerMaxWidth}>{children}</Container>
    </section>
  )
}

export default Section
