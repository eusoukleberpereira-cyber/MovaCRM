import { Sidebar } from "@/components/sidebar"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main style={{ marginLeft: "var(--sidebar-width)" }}>
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
