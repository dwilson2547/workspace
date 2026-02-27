import { InputHTMLAttributes, useId } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export function Input({ label, id, className = '', ...rest }: Props) {
  const autoId = useId()
  const inputId = id ?? autoId

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-xs text-muted uppercase tracking-wider">
          {label}
        </label>
      )}
      <input
        id={inputId}
        {...rest}
        className={[
          'bg-surface-3 text-primary text-sm px-3 py-1.5 rounded border border-surface-3/80',
          'focus:outline-none focus:border-accent placeholder-muted/50',
          'disabled:opacity-40',
          className,
        ].join(' ')}
      />
    </div>
  )
}
