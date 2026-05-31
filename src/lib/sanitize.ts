const HTML_CHARS: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
}

export function stripHtml(value: string): string {
  return value.replace(/[&<>"']/g, c => HTML_CHARS[c] ?? c).trim()
}
