"use client"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useProfile } from "@/hooks/use-profile"
import { createClient } from "@/lib/supabase/client"
import {
  LayoutDashboard, Car, Users, FileText, CreditCard, LogOut, Columns3, Settings, MessageCircle,
} from "lucide-react"
import { clsx } from "clsx"

const NAV = [
  { href: "/dashboard",           label: "Dashboard",  icon: LayoutDashboard, roles: ["admin","atendente","financeiro","comercial"] },
  { href: "/dashboard/veiculos",  label: "Veículos",   icon: Car,             roles: ["admin","atendente","financeiro","comercial"] },
  { href: "/dashboard/clientes",  label: "Clientes",   icon: Users,           roles: ["admin","atendente","financeiro","comercial"] },
  { href: "/dashboard/contratos", label: "Contratos",  icon: FileText,        roles: ["admin","atendente","financeiro","comercial"] },
  { href: "/dashboard/kanban",    label: "Kanban",     icon: Columns3,        roles: ["admin","atendente","comercial"] },
  { href: "/dashboard/inbox",     label: "Inbox",      icon: MessageCircle,   roles: ["admin","atendente","comercial"] },
  { href: "/dashboard/pagamentos",    label: "Pagamentos",    icon: CreditCard,      roles: ["admin","financeiro"] },
  { href: "/dashboard/configuracoes", label: "Configurações", icon: Settings,        roles: ["admin"] },
]

export function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const { profile } = useProfile()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push("/login")
  }

  const links = NAV.filter(n => !profile || n.roles.includes(profile.role))

  return (
    <aside
      className="fixed left-0 top-0 h-screen flex flex-col z-40"
      style={{ width: "var(--sidebar-width)", backgroundColor: "var(--color-primary)" }}
    >
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/10">
        <span className="font-display text-xl font-bold text-white">MovaCRM</span>
        {profile && (
          <p className="text-xs mt-0.5 capitalize" style={{ color: "var(--color-muted)" }}>
            {profile.name} · {profile.role}
          </p>
        )}
      </div>

      {/* Navegação */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                !active && "hover:bg-white/10"
              )}
              style={{
                color: active ? "white" : "var(--color-muted)",
                backgroundColor: active ? "var(--color-accent)" : undefined,
              }}
            >
              <Icon size={18} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-white/10">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium w-full hover:bg-white/10 transition-colors"
          style={{ color: "var(--color-muted)" }}
        >
          <LogOut size={18} />
          Sair
        </button>
      </div>
    </aside>
  )
}
