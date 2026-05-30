import { clsx } from "clsx"
import { forwardRef } from "react"

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string
  error?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, className, children, ...props }, ref) => (
    <div className="space-y-1.5">
      {label && <label className="block text-sm font-medium text-text">{label}</label>}
      <select
        ref={ref}
        className={clsx(
          "w-full border rounded-md px-3 py-2 text-sm bg-surface text-text",
          "focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all",
          error ? "border-danger" : "border-border",
          className
        )}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
)
Select.displayName = "Select"
