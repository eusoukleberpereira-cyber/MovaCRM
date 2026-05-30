import { clsx } from "clsx"

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost"
  size?: "sm" | "md"
}

export function Button({ variant = "primary", size = "md", className, children, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        size === "sm" && "px-3 py-1.5 text-sm",
        size === "md" && "px-4 py-2 text-sm",
        variant === "primary" && "text-white",
        variant === "secondary" && "bg-surface border border-border text-text hover:bg-background",
        variant === "danger" && "bg-danger text-white hover:bg-danger/90",
        variant === "ghost" && "bg-transparent text-muted hover:text-text hover:bg-background",
        className
      )}
      style={variant === "primary" ? { backgroundColor: "var(--color-accent)" } : undefined}
      {...props}
    >
      {children}
    </button>
  )
}
