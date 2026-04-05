'use client'

import { cn } from '@/lib/utils'

interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Maximum width of the container
   * @default '7xl'
   */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '7xl' | 'full'
  /**
   * Whether to add horizontal padding
   * @default true
   */
  padding?: boolean
  /**
   * Center the container horizontally
   * @default true
   */
  centered?: boolean
}

const maxWidthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '7xl': 'max-w-7xl',
  full: 'max-w-none',
}

export function Container({
  children,
  className,
  maxWidth = '7xl',
  padding = true,
  centered = true,
  ...props
}: ContainerProps) {
  return (
    <div
      className={cn(
        'w-full',
        maxWidthClasses[maxWidth],
        padding && 'px-4 sm:px-6 lg:px-8',
        centered && 'mx-auto',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export default Container
