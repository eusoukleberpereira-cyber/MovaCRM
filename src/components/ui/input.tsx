import { clsx } from "clsx"
import { forwardRef } from "react"

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, ...props }, ref) => (
    <div className="space-y-1.5">
      {label && <label className="block text-sm font-medium text-text">{label}</label>}
      <input
        ref={ref}
        className={clsx(
          "w-full border rounded-md px-3 py-2 text-sm bg-surface text-text placeholder:text-muted",
          "focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all",
          error ? "border-danger" : "border-border",
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
)
Input.displayName = "Input"
