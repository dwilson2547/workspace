import React from 'react'

interface Props {
  children: React.ReactNode
  variant?: 'default' | 'accent' | 'success' | 'danger' | 'muted'
}

const variantClasses = {
  default: 'bg-surface-3 text-primary',
  accent: 'bg-accent/20 text-accent',
  success: 'bg-success/15 text-success',
  danger: 'bg-danger/15 text-danger',
  muted: 'bg-surface-3 text-muted',
}

export function Badge({ children, variant = 'default' }: Props) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${variantClasses[variant]}`}>
      {children}
    </span>
  )
}
