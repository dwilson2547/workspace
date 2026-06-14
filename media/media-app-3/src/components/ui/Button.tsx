import { ButtonHTMLAttributes, forwardRef } from 'react'

type Variant = 'default' | 'ghost' | 'danger' | 'accent'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'sm' | 'md'
}

const variantClasses: Record<Variant, string> = {
  default:
    'bg-surface-3 text-primary hover:bg-surface-3/80 border border-surface-3 hover:border-muted',
  ghost:
    'bg-transparent text-muted hover:bg-surface-3 hover:text-primary border border-transparent',
  danger:
    'bg-danger/10 text-danger hover:bg-danger/20 border border-danger/30',
  accent:
    'bg-accent text-white hover:bg-accent-hover border border-accent',
}

const sizeClasses = {
  sm: 'px-3 py-1 text-xs rounded',
  md: 'px-4 py-1.5 text-sm rounded-md',
}

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = 'default', size = 'md', className = '', children, disabled, ...rest }, ref) => {
    return (
      <button
        ref={ref}
        {...rest}
        disabled={disabled}
        className={[
          'inline-flex items-center gap-1.5 font-medium transition-colors cursor-pointer',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          variantClasses[variant],
          sizeClasses[size],
          className,
        ].join(' ')}
      >
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
