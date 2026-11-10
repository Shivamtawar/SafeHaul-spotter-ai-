import type { CSSProperties, ElementType, ReactNode } from 'react'
import { useReveal } from '../../shared/lib/useReveal'

interface RevealProps {
  children: ReactNode
  as?: ElementType
  className?: string
  /** Stagger in milliseconds, for items revealed together. */
  delay?: number
}

/** Fades and lifts its content in as it scrolls into view. */
export function Reveal({ children, as: Tag = 'div', className, delay = 0 }: RevealProps) {
  const ref = useReveal<HTMLElement>()
  const style = { '--delay': `${delay}ms` } as CSSProperties
  return (
    <Tag ref={ref} className={className} data-reveal style={style}>
      {children}
    </Tag>
  )
}
