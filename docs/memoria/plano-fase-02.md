# INSTRUÇÕES PARA ATLAS — FASE 02: FROTA, CLIENTES & CONTRATOS

## Contexto
Fase 01 completa. Sistema no ar em https://movacrm-three.vercel.app com login funcional.
Next.js 16, Tailwind v4 (usa @theme inline no globals.css), proxy.ts (não middleware.ts).
Design tokens já aplicados: primary=#0F172A, accent=#F97316, fontes Bricolage Grotesque + Plus Jakarta Sans.

## Objetivo da Fase 02
Implementar 4 módulos completos com layout base:
1. Layout com Sidebar (base de todas as páginas internas)
2. Veículos — CRUD completo com status
3. Clientes — CRUD completo
4. Contratos — CRUD vinculando cliente + veículo
5. Pagamentos — registrar pagamentos + painel de inadimplência

## Pré-condições
- [ ] `git checkout dev && git pull origin dev`
- [ ] `npm run dev` rodando sem erros

---

## PASSO 1 — Hook de perfil do usuário autenticado

Criar `src/hooks/use-profile.ts`:

```ts
"use client"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export type Profile = {
  id: string
  name: string
  email: string
  role: "admin" | "atendente" | "financeiro" | "comercial"
  locadora_id: string
}

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()
      setProfile(data)
      setLoading(false)
    }
    load()
  }, [])

  return { profile, loading }
}
```

---

## PASSO 2 — Componentes UI base

### 2.1 — Badge de status

Criar `src/components/ui/status-badge.tsx`:

```tsx
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
```

### 2.2 — Botão base

Criar `src/components/ui/button.tsx`:

```tsx
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
```

### 2.3 — Input base

Criar `src/components/ui/input.tsx`:

```tsx
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
```

### 2.4 — Select base

Criar `src/components/ui/select.tsx`:

```tsx
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
```

### 2.5 — Modal base

Criar `src/components/ui/modal.tsx`:

```tsx
"use client"
import { X } from "lucide-react"
import { useEffect } from "react"

type ModalProps = {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  width?: string
}

export function Modal({ open, onClose, title, children, width = "max-w-lg" }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={clsx("relative bg-surface rounded-lg shadow-lg w-full mx-4", width)}
           style={{ boxShadow: "var(--shadow-lg)" }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-display text-lg font-bold text-primary">{title}</h2>
          <button onClick={onClose} className="text-muted hover:text-text transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

function clsx(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ")
}
```

---

## PASSO 3 — Layout com Sidebar

### 3.1 — Componente Sidebar

Criar `src/components/sidebar.tsx`:

```tsx
"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useProfile } from "@/hooks/use-profile"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import {
  LayoutDashboard, Car, Users, FileText, CreditCard, LogOut
} from "lucide-react"
import { clsx } from "clsx"

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin","atendente","financeiro","comercial"] },
  { href: "/dashboard/veiculos", label: "Veículos", icon: Car, roles: ["admin","atendente","financeiro","comercial"] },
  { href: "/dashboard/clientes", label: "Clientes", icon: Users, roles: ["admin","atendente","financeiro","comercial"] },
  { href: "/dashboard/contratos", label: "Contratos", icon: FileText, roles: ["admin","atendente","financeiro","comercial"] },
  { href: "/dashboard/pagamentos", label: "Pagamentos", icon: CreditCard, roles: ["admin","financeiro"] },
]

export function Sidebar() {
  const pathname = usePathname()
  const { profile } = useProfile()
  const router = useRouter()
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
          <p className="text-xs mt-0.5" style={{ color: "var(--sidebar-text)" }}>
            {profile.name} · {profile.role}
          </p>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                active
                  ? "text-white"
                  : "hover:bg-white/10"
              )}
              style={{
                color: active ? "white" : "var(--sidebar-text)",
                backgroundColor: active ? "var(--color-accent)" : undefined
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
          style={{ color: "var(--sidebar-text)" }}
        >
          <LogOut size={18} />
          Sair
        </button>
      </div>
    </aside>
  )
}
```

### 3.2 — Layout do Dashboard

Criar `src/app/dashboard/layout.tsx`:

```tsx
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
```

---

## PASSO 4 — Módulo Veículos

### 4.1 — Page de Veículos

Criar `src/app/dashboard/veiculos/page.tsx`:

```tsx
"use client"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useProfile } from "@/hooks/use-profile"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import { Modal } from "@/components/ui/modal"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Plus, Pencil } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

const STATUS_MAP = {
  disponivel:  { label: "Disponível", color: "var(--color-success)" },
  alugado:     { label: "Alugado",    color: "var(--color-accent)" },
  manutencao:  { label: "Manutenção", color: "var(--color-warning)" },
}

const schema = z.object({
  placa:  z.string().min(7, "Placa inválida").max(8),
  modelo: z.string().min(2, "Modelo obrigatório"),
  ano:    z.coerce.number().min(1990).max(new Date().getFullYear() + 1),
  status: z.enum(["disponivel", "alugado", "manutencao"]),
})
type FormData = z.infer<typeof schema>

type Veiculo = FormData & { id: string }

export default function VeiculosPage() {
  const { profile } = useProfile()
  const supabase = createClient()
  const [veiculos, setVeiculos] = useState<Veiculo[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Veiculo | null>(null)

  const canEdit = profile?.role === "admin"

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: "disponivel" }
  })

  async function load() {
    const { data } = await supabase.from("veiculos").select("*").order("modelo")
    setVeiculos(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openCreate() {
    setEditing(null)
    reset({ status: "disponivel", placa: "", modelo: "", ano: new Date().getFullYear() })
    setModalOpen(true)
  }

  function openEdit(v: Veiculo) {
    setEditing(v)
    reset({ placa: v.placa, modelo: v.modelo, ano: v.ano, status: v.status })
    setModalOpen(true)
  }

  async function onSubmit(data: FormData) {
    if (editing) {
      await supabase.from("veiculos").update(data).eq("id", editing.id)
    } else {
      await supabase.from("veiculos").insert({ ...data, locadora_id: profile!.locadora_id })
    }
    setModalOpen(false)
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-primary">Veículos</h1>
          <p className="text-muted text-sm mt-0.5">{veiculos.length} veículo(s) cadastrado(s)</p>
        </div>
        {canEdit && (
          <Button onClick={openCreate}>
            <Plus size={16} className="mr-1.5" /> Novo Veículo
          </Button>
        )}
      </div>

      <div className="bg-surface rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background">
              <th className="px-4 py-3 text-left font-medium text-muted">Placa</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Modelo</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Ano</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Status</th>
              {canEdit && <th className="px-4 py-3 text-left font-medium text-muted">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">Carregando...</td></tr>
            ) : veiculos.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">Nenhum veículo cadastrado.</td></tr>
            ) : veiculos.map((v, i) => (
              <tr key={v.id} className={i % 2 === 0 ? "" : "bg-background/50"}>
                <td className="px-4 py-3 font-mono font-medium">{v.placa}</td>
                <td className="px-4 py-3 text-text">{v.modelo}</td>
                <td className="px-4 py-3 text-text">{v.ano}</td>
                <td className="px-4 py-3"><StatusBadge status={v.status} map={STATUS_MAP} /></td>
                {canEdit && (
                  <td className="px-4 py-3">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(v)}>
                      <Pencil size={14} />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
             title={editing ? "Editar Veículo" : "Novo Veículo"}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Placa" placeholder="ABC-1234" {...register("placa")} error={errors.placa?.message} />
          <Input label="Modelo" placeholder="Ex: Fiat Strada" {...register("modelo")} error={errors.modelo?.message} />
          <Input label="Ano" type="number" {...register("ano")} error={errors.ano?.message} />
          <Select label="Status" {...register("status")}>
            <option value="disponivel">Disponível</option>
            <option value="alugado">Alugado</option>
            <option value="manutencao">Manutenção</option>
          </Select>
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : editing ? "Salvar alterações" : "Cadastrar veículo"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
```

---

## PASSO 5 — Módulo Clientes

Criar `src/app/dashboard/clientes/page.tsx`:

```tsx
"use client"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useProfile } from "@/hooks/use-profile"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import { Input } from "@/components/ui/input"
import { Plus, Pencil, Search } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

const schema = z.object({
  name:     z.string().min(2, "Nome obrigatório"),
  cpf:      z.string().optional(),
  whatsapp: z.string().min(10, "WhatsApp inválido"),
})
type FormData = z.infer<typeof schema>
type Cliente = FormData & { id: string }

export default function ClientesPage() {
  const { profile } = useProfile()
  const supabase = createClient()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [busca, setBusca] = useState("")
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Cliente | null>(null)

  const canEdit = ["admin", "atendente"].includes(profile?.role ?? "")

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema)
  })

  async function load() {
    const { data } = await supabase.from("clientes").select("*").order("name")
    setClientes(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = clientes.filter(c =>
    c.name.toLowerCase().includes(busca.toLowerCase()) ||
    c.whatsapp.includes(busca) ||
    (c.cpf ?? "").includes(busca)
  )

  function openCreate() {
    setEditing(null)
    reset({ name: "", cpf: "", whatsapp: "" })
    setModalOpen(true)
  }

  function openEdit(c: Cliente) {
    setEditing(c)
    reset({ name: c.name, cpf: c.cpf, whatsapp: c.whatsapp })
    setModalOpen(true)
  }

  async function onSubmit(data: FormData) {
    if (editing) {
      await supabase.from("clientes").update(data).eq("id", editing.id)
    } else {
      await supabase.from("clientes").insert({ ...data, locadora_id: profile!.locadora_id })
    }
    setModalOpen(false)
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-primary">Clientes</h1>
          <p className="text-muted text-sm mt-0.5">{clientes.length} cliente(s) cadastrado(s)</p>
        </div>
        {canEdit && (
          <Button onClick={openCreate}>
            <Plus size={16} className="mr-1.5" /> Novo Cliente
          </Button>
        )}
      </div>

      <div className="mb-4 relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nome, CPF ou WhatsApp..."
          className="w-full border border-border rounded-md pl-9 pr-3 py-2 text-sm bg-surface text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      <div className="bg-surface rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background">
              <th className="px-4 py-3 text-left font-medium text-muted">Nome</th>
              <th className="px-4 py-3 text-left font-medium text-muted">CPF</th>
              <th className="px-4 py-3 text-left font-medium text-muted">WhatsApp</th>
              {canEdit && <th className="px-4 py-3 text-left font-medium text-muted">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-muted">Carregando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-muted">Nenhum cliente encontrado.</td></tr>
            ) : filtered.map((c, i) => (
              <tr key={c.id} className={i % 2 === 0 ? "" : "bg-background/50"}>
                <td className="px-4 py-3 font-medium text-text">{c.name}</td>
                <td className="px-4 py-3 text-muted font-mono">{c.cpf || "—"}</td>
                <td className="px-4 py-3 text-text">{c.whatsapp}</td>
                {canEdit && (
                  <td className="px-4 py-3">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                      <Pencil size={14} />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
             title={editing ? "Editar Cliente" : "Novo Cliente"}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Nome completo" {...register("name")} error={errors.name?.message} />
          <Input label="CPF" placeholder="000.000.000-00" {...register("cpf")} />
          <Input label="WhatsApp" placeholder="5511999999999" {...register("whatsapp")} error={errors.whatsapp?.message} />
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : editing ? "Salvar alterações" : "Cadastrar cliente"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
```

---

## PASSO 6 — Módulo Contratos

Criar `src/app/dashboard/contratos/page.tsx`:

```tsx
"use client"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useProfile } from "@/hooks/use-profile"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import { Modal } from "@/components/ui/modal"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Plus, FileText } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { format, isPast } from "date-fns"

const STATUS_MAP = {
  ativo:     { label: "Ativo",     color: "var(--color-success)" },
  encerrado: { label: "Encerrado", color: "var(--color-muted)" },
}

const schema = z.object({
  cliente_id:      z.string().min(1, "Selecione o cliente"),
  veiculo_id:      z.string().min(1, "Selecione o veículo"),
  valor_mensal:    z.coerce.number().min(1, "Valor inválido"),
  data_inicio:     z.string().min(1, "Data obrigatória"),
  data_vencimento: z.string().min(1, "Data obrigatória"),
})
type FormData = z.infer<typeof schema>

type Contrato = {
  id: string
  valor_mensal: number
  data_inicio: string
  data_vencimento: string
  status: string
  clientes: { name: string } | null
  veiculos: { placa: string; modelo: string } | null
}

type Cliente = { id: string; name: string }
type Veiculo = { id: string; placa: string; modelo: string; status: string }

export default function ContratosPage() {
  const { profile } = useProfile()
  const supabase = createClient()
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [veiculos, setVeiculos] = useState<Veiculo[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)

  const canCreate = profile?.role === "admin" || profile?.role === "financeiro"

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema)
  })

  async function load() {
    const [c, cl, v] = await Promise.all([
      supabase.from("contratos").select("*, clientes(name), veiculos(placa, modelo)").order("created_at", { ascending: false }),
      supabase.from("clientes").select("id, name").order("name"),
      supabase.from("veiculos").select("id, placa, modelo, status").order("modelo"),
    ])
    setContratos(c.data ?? [])
    setClientes(cl.data ?? [])
    setVeiculos(v.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const veiculosDisponiveis = veiculos.filter(v => v.status === "disponivel")

  function openCreate() {
    reset({ data_inicio: format(new Date(), "yyyy-MM-dd") })
    setModalOpen(true)
  }

  async function onSubmit(data: FormData) {
    await supabase.from("contratos").insert({ ...data, locadora_id: profile!.locadora_id, status: "ativo" })
    await supabase.from("veiculos").update({ status: "alugado" }).eq("id", data.veiculo_id)
    setModalOpen(false)
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-primary">Contratos</h1>
          <p className="text-muted text-sm mt-0.5">{contratos.filter(c => c.status === "ativo").length} contrato(s) ativo(s)</p>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus size={16} className="mr-1.5" /> Novo Contrato
          </Button>
        )}
      </div>

      <div className="bg-surface rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background">
              <th className="px-4 py-3 text-left font-medium text-muted">Cliente</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Veículo</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Valor</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Vencimento</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">Carregando...</td></tr>
            ) : contratos.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">Nenhum contrato cadastrado.</td></tr>
            ) : contratos.map((c, i) => {
              const vencido = c.status === "ativo" && isPast(new Date(c.data_vencimento))
              return (
                <tr key={c.id} className={i % 2 === 0 ? "" : "bg-background/50"}>
                  <td className="px-4 py-3 font-medium text-text">{c.clientes?.name ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-sm">{c.veiculos ? `${c.veiculos.placa} · ${c.veiculos.modelo}` : "—"}</td>
                  <td className="px-4 py-3 text-text">R$ {Number(c.valor_mensal).toFixed(2)}</td>
                  <td className={`px-4 py-3 font-mono text-sm ${vencido ? "text-danger font-semibold" : "text-text"}`}>
                    {format(new Date(c.data_vencimento), "dd/MM/yyyy")}
                    {vencido && " ⚠️"}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={c.status} map={STATUS_MAP} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Novo Contrato">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Select label="Cliente" {...register("cliente_id")} error={errors.cliente_id?.message}>
            <option value="">Selecione o cliente</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select label="Veículo disponível" {...register("veiculo_id")} error={errors.veiculo_id?.message}>
            <option value="">Selecione o veículo</option>
            {veiculosDisponiveis.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.modelo}</option>)}
          </Select>
          <Input label="Valor mensal (R$)" type="number" step="0.01" {...register("valor_mensal")} error={errors.valor_mensal?.message} />
          <Input label="Data de início" type="date" {...register("data_inicio")} error={errors.data_inicio?.message} />
          <Input label="Data de vencimento" type="date" {...register("data_vencimento")} error={errors.data_vencimento?.message} />
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={isSubmitting || veiculosDisponiveis.length === 0}>
              {isSubmitting ? "Criando..." : "Criar contrato"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
          </div>
          {veiculosDisponiveis.length === 0 && (
            <p className="text-sm text-warning">⚠️ Nenhum veículo disponível para locação.</p>
          )}
        </form>
      </Modal>
    </div>
  )
}
```

---

## PASSO 7 — Módulo Pagamentos + Inadimplência

Criar `src/app/dashboard/pagamentos/page.tsx`:

```tsx
"use client"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useProfile } from "@/hooks/use-profile"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import { Modal } from "@/components/ui/modal"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Plus, AlertTriangle } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { format, isPast } from "date-fns"

const STATUS_MAP = {
  pago:     { label: "Pago",     color: "var(--color-success)" },
  pendente: { label: "Pendente", color: "var(--color-warning)" },
  atrasado: { label: "Atrasado", color: "var(--color-danger)" },
}

const schema = z.object({
  contrato_id:    z.string().min(1, "Selecione o contrato"),
  valor:          z.coerce.number().min(0.01, "Valor inválido"),
  data_pagamento: z.string().min(1, "Data obrigatória"),
  status:         z.enum(["pago", "pendente", "atrasado"]),
})
type FormData = z.infer<typeof schema>

type Pagamento = {
  id: string
  valor: number
  data_pagamento: string | null
  status: string
  contratos: { clientes: { name: string } | null; veiculos: { placa: string } | null } | null
}

type Contrato = { id: string; clientes: { name: string } | null; veiculos: { placa: string } | null }

export default function PagamentosPage() {
  const { profile } = useProfile()
  const supabase = createClient()
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([])
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [inadimplentes, setInadimplentes] = useState<Contrato[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [tab, setTab] = useState<"historico" | "inadimplencia">("historico")

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: "pago", data_pagamento: format(new Date(), "yyyy-MM-dd") }
  })

  async function load() {
    const [p, c] = await Promise.all([
      supabase.from("pagamentos")
        .select("*, contratos(clientes(name), veiculos(placa))")
        .order("created_at", { ascending: false }),
      supabase.from("contratos")
        .select("id, data_vencimento, clientes(name), veiculos(placa)")
        .eq("status", "ativo")
    ])

    setPagamentos(p.data ?? [])
    setContratos(c.data ?? [])

    const inadimpl = (c.data ?? []).filter((ct: any) => isPast(new Date(ct.data_vencimento)))
    setInadimplentes(inadimpl)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function onSubmit(data: FormData) {
    await supabase.from("pagamentos").insert(data)
    setModalOpen(false)
    reset()
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-primary">Pagamentos</h1>
          {inadimplentes.length > 0 && (
            <p className="text-danger text-sm mt-0.5 flex items-center gap-1">
              <AlertTriangle size={14} /> {inadimplentes.length} contrato(s) inadimplente(s)
            </p>
          )}
        </div>
        <Button onClick={() => { reset(); setModalOpen(true) }}>
          <Plus size={16} className="mr-1.5" /> Registrar Pagamento
        </Button>
      </div>

      {/* Abas */}
      <div className="flex gap-1 mb-4 border-b border-border">
        {(["historico", "inadimplencia"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-text"
            }`}
          >
            {t === "historico" ? "Histórico" : `Inadimplência ${inadimplentes.length > 0 ? `(${inadimplentes.length})` : ""}`}
          </button>
        ))}
      </div>

      {tab === "historico" && (
        <div className="bg-surface rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background">
                <th className="px-4 py-3 text-left font-medium text-muted">Cliente</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Placa</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Valor</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Data</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">Carregando...</td></tr>
              ) : pagamentos.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">Nenhum pagamento registrado.</td></tr>
              ) : pagamentos.map((p, i) => (
                <tr key={p.id} className={i % 2 === 0 ? "" : "bg-background/50"}>
                  <td className="px-4 py-3 text-text">{p.contratos?.clientes?.name ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-sm">{p.contratos?.veiculos?.placa ?? "—"}</td>
                  <td className="px-4 py-3 text-text">R$ {Number(p.valor).toFixed(2)}</td>
                  <td className="px-4 py-3 text-muted">{p.data_pagamento ? format(new Date(p.data_pagamento), "dd/MM/yyyy") : "—"}</td>
                  <td className="px-4 py-3"><StatusBadge status={p.status} map={STATUS_MAP} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "inadimplencia" && (
        <div className="bg-surface rounded-lg border border-danger/30 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-danger/5">
                <th className="px-4 py-3 text-left font-medium text-muted">Cliente</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Placa</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Situação</th>
              </tr>
            </thead>
            <tbody>
              {inadimplentes.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-success">✅ Nenhum inadimplente.</td></tr>
              ) : inadimplentes.map((c: any, i) => (
                <tr key={c.id} className={i % 2 === 0 ? "" : "bg-background/50"}>
                  <td className="px-4 py-3 font-medium text-text">{c.clientes?.name ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-sm">{c.veiculos?.placa ?? "—"}</td>
                  <td className="px-4 py-3 text-danger font-medium">Venceu em {format(new Date(c.data_vencimento), "dd/MM/yyyy")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Registrar Pagamento">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Select label="Contrato" {...register("contrato_id")} error={errors.contrato_id?.message}>
            <option value="">Selecione o contrato</option>
            {contratos.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.clientes?.name} — {c.veiculos?.placa}
              </option>
            ))}
          </Select>
          <Input label="Valor (R$)" type="number" step="0.01" {...register("valor")} error={errors.valor?.message} />
          <Input label="Data do pagamento" type="date" {...register("data_pagamento")} error={errors.data_pagamento?.message} />
          <Select label="Status" {...register("status")}>
            <option value="pago">Pago</option>
            <option value="pendente">Pendente</option>
            <option value="atrasado">Atrasado</option>
          </Select>
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Registrando..." : "Registrar pagamento"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
```

---

## PASSO 8 — Atualizar Dashboard placeholder

Atualizar `src/app/dashboard/page.tsx` com contadores básicos:

```tsx
"use client"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Car, Users, FileText, AlertTriangle } from "lucide-react"

export default function DashboardPage() {
  const supabase = createClient()
  const [stats, setStats] = useState({ veiculos: 0, clientes: 0, contratos: 0, inadimplentes: 0 })

  useEffect(() => {
    async function load() {
      const [v, c, ct] = await Promise.all([
        supabase.from("veiculos").select("id", { count: "exact" }),
        supabase.from("clientes").select("id", { count: "exact" }),
        supabase.from("contratos").select("id, data_vencimento").eq("status", "ativo"),
      ])
      const inadimplentes = (ct.data ?? []).filter((c: any) => new Date(c.data_vencimento) < new Date()).length
      setStats({ veiculos: v.count ?? 0, clientes: c.count ?? 0, contratos: ct.data?.length ?? 0, inadimplentes })
    }
    load()
  }, [])

  const cards = [
    { label: "Veículos cadastrados", value: stats.veiculos, icon: Car, color: "var(--color-primary)" },
    { label: "Clientes cadastrados", value: stats.clientes, icon: Users, color: "var(--color-accent)" },
    { label: "Contratos ativos", value: stats.contratos, icon: FileText, color: "var(--color-success)" },
    { label: "Inadimplentes", value: stats.inadimplentes, icon: AlertTriangle, color: "var(--color-danger)" },
  ]

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-primary mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-surface rounded-lg border border-border p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted">{label}</p>
              <div className="p-2 rounded-md" style={{ backgroundColor: `${color}15` }}>
                <Icon size={18} style={{ color }} />
              </div>
            </div>
            <p className="font-display text-3xl font-bold" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

## PASSO 9 — Build, verificação e commit

```bash
# Verificar build
npm run build

# Verificação de secrets
git add -A
git diff --cached | grep -E "(API_KEY|SECRET|PASSWORD|TOKEN|ANON_KEY|SERVICE_ROLE|eyJ)"

# Commit
git commit -m "feat(modules): veículos, clientes, contratos e pagamentos com sidebar e permissões"
git push origin dev
```

---

## Critério de Aceitação da Fase 02

✅ Sidebar visível com navegação funcional
✅ Logout funciona e redireciona para /login
✅ Veículos: listar, criar, editar (somente admin)
✅ Clientes: listar, buscar, criar, editar
✅ Contratos: listar, criar (vincula cliente + veículo → muda status do veículo para "alugado")
✅ Pagamentos: registrar pagamento, ver histórico, ver inadimplentes
✅ Permissões respeitadas por role
✅ `npm run build` sem erros

## Em caso de erro
Parar e reportar ao Hades com output completo do terminal.

## ✅ RELATÓRIO OBRIGATÓRIO AO CONCLUIR
- STATUS: sucesso / erro
- STEPS EXECUTADOS: lista numerada
- OUTPUT DO BUILD: resultado do `npm run build`
- ERROS ENCONTRADOS: copiar mensagem exata
