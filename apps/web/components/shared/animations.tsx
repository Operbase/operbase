'use client'

import { cn } from '@/lib/utils'
import {
  useEffect,
  useRef,
  useState,
  type ElementType,
  type HTMLAttributes,
} from 'react'

interface AnimatedSectionProps extends HTMLAttributes<HTMLElement> {
  /**
   * HTML element to render as
   * @default 'div'
   */
  as?: ElementType
  /**
   * Animation variant
   * @default 'fade-up'
   */
  variant?: 'fade-up' | 'fade-in' | 'scale-in' | 'slide-in-right' | 'slide-in-left'
  /**
   * Delay in milliseconds before animation starts
   * @default 0
   */
  delay?: number
  /**
   * Whether to trigger animation only once
   * @default true
   */
  once?: boolean
  /**
   * Intersection threshold (0-1)
   * @default 0.05
   */
  threshold?: number
  /**
   * Root margin for intersection observer
   * @default '-24px'
   */
  rootMargin?: string
}

const variantClasses = {
  'fade-up': 'animate-fade-up',
  'fade-in': 'animate-fade-in',
  'scale-in': 'animate-scale-in',
  'slide-in-right': 'animate-slide-in-right',
  'slide-in-left': 'animate-slide-in-left',
}

// Keyframe animations defined in CSS
const animationStyles = `
@keyframes fade-up {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scale-in {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes slide-in-right {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes slide-in-left {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.animate-fade-up {
  animation: fade-up 0.55s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.animate-fade-in {
  animation: fade-in 0.4s ease-out forwards;
}

.animate-scale-in {
  animation: scale-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.animate-slide-in-right {
  animation: slide-in-right 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.animate-slide-in-left {
  animation: slide-in-left 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@media (prefers-reduced-motion: reduce) {
  .animate-fade-up,
  .animate-fade-in,
  .animate-scale-in,
  .animate-slide-in-right,
  .animate-slide-in-left {
    animation: none;
    opacity: 1;
    transform: none;
  }
}
`

export function AnimatedSection({
  as: Tag = 'div',
  variant = 'fade-up',
  delay = 0,
  once = true,
  threshold = 0.05,
  rootMargin = '-24px',
  className,
  style,
  children,
  ...rest
}: AnimatedSectionProps) {
  const ref = useRef<HTMLElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [hasAnimated, setHasAnimated] = useState(false)

  useEffect(() => {
    // Respect reduced motion preference
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setIsVisible(true)
      setHasAnimated(true)
      return
    }

    const el = ref.current
    if (!el) {
      setIsVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          if (once) {
            setHasAnimated(true)
            observer.disconnect()
          }
        } else if (!once) {
          setIsVisible(false)
        }
      },
      { threshold, rootMargin }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [once, threshold, rootMargin])

  // Reset animation when not in view (for non-once animations)
  useEffect(() => {
    if (!once && !isVisible && hasAnimated) {
      setHasAnimated(false)
    }
  }, [isVisible, once, hasAnimated])

  return (
    <>
      <style>{animationStyles}</style>
      <Tag
        ref={ref}
        className={cn(
          isVisible ? variantClasses[variant] : 'opacity-0',
          className
        )}
        style={
          isVisible && delay > 0
            ? { animationDelay: `${delay}ms`, ...style }
            : style
        }
        {...rest}
      >
        {children}
      </Tag>
    </>
  )
}

interface StaggerContainerProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Stagger delay between children in milliseconds
   * @default 100
   */
  staggerDelay?: number
  /**
   * Base delay before first child animates
   * @default 0
   */
  baseDelay?: number
  /**
   * Animation variant for children
   * @default 'fade-up'
   */
  variant?: 'fade-up' | 'fade-in' | 'scale-in'
}

export function StaggerContainer({
  children,
  staggerDelay = 100,
  baseDelay = 0,
  variant = 'fade-up',
  className,
  ...props
}: StaggerContainerProps) {
  return (
    <div className={className} {...props}>
      {Array.isArray(children)
        ? children.map((child, index) => (
            <AnimatedSection
              key={index}
              variant={variant}
              delay={baseDelay + index * staggerDelay}
            >
              {child}
            </AnimatedSection>
          ))
        : children}
    </div>
  )
}

interface AnimatedItemProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Item index for stagger calculation
   * @default 0
   */
  index?: number
  /**
   * Stagger delay between items
   * @default 100
   */
  staggerDelay?: number
  /**
   * Animation variant
   * @default 'fade-up'
   */
  variant?: 'fade-up' | 'fade-in' | 'scale-in'
}

export function AnimatedItem({
  children,
  index = 0,
  staggerDelay = 100,
  variant = 'fade-up',
  className,
  ...props
}: AnimatedItemProps) {
  return (
    <AnimatedSection
      variant={variant}
      delay={index * staggerDelay}
      className={className}
      {...props}
    >
      {children}
    </AnimatedSection>
  )
}

