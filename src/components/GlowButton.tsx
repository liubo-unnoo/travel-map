import type { CSSProperties, ReactNode } from 'react'

interface Props {
  onClick?: () => void
  children: ReactNode
  fullWidth?: boolean
  style?: CSSProperties
}

export default function GlowButton({ onClick, children, fullWidth, style }: Props) {
  return (
    <button
      onClick={onClick}
      className="glow-btn"
      style={{
        width: fullWidth ? '100%' : undefined,
        ...style,
      }}
    >
      {children}
    </button>
  )
}
