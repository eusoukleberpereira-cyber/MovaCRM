type StatusBadgeProps = {
  status: string
  map: Record<string, { label: string; color: string }>
}

export function StatusBadge({ status, map }: StatusBadgeProps) {
  const item = map[status] ?? { label: status, color: "#94A3B8" }
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
      style={{ backgroundColor: item.color }}
    >
      {item.label}
    </span>
  )
}
