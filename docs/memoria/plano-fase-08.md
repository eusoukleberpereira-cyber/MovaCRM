# INSTRUÇÕES PARA ATLAS — FASE 08: CONFIGURAÇÕES & GESTÃO DE USUÁRIOS

## Contexto
Fases 01-07 completas. Página /dashboard/configuracoes já existe com Z-API + disparos.
Tabela profiles: id, name, email, role, locadora_id. Tabela locadoras: id, name, logo_url, etc.
RLS ativo — precisa de service role para listar/gerenciar usuários de outros profiles.

## Objetivo
1. Criar rotas de API para gestão de usuários (service role)
2. Reescrever /dashboard/configuracoes com 3 abas: Locadora | Usuários | WhatsApp
3. Build + commit + push

---

## PASSO 1 — API de Usuários

### 1.1 — Listar e Criar usuários

Criar `src/app/api/users/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createClient as createClientSSR } from "@/lib/supabase/server"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET — listar usuários da locadora
export async function GET() {
  try {
    const supabase = await createClientSSR()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: caller } = await supabaseAdmin
      .from("profiles")
      .select("role, locadora_id")
      .eq("id", user.id)
      .single()

    if (caller?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: users } = await supabaseAdmin
      .from("profiles")
      .select("id, name, email, role, created_at")
      .eq("locadora_id", caller.locadora_id)
      .order("name")

    return NextResponse.json(users ?? [])
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST — criar novo usuário
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClientSSR()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: caller } = await supabaseAdmin
      .from("profiles")
      .select("role, locadora_id")
      .eq("id", user.id)
      .single()

    if (caller?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { name, email, role } = await request.json()

    if (!name || !email || !role) {
      return NextResponse.json({ error: "name, email e role são obrigatórios" }, { status: 400 })
    }

    // Senha temporária
    const tempPassword = `MovaCRM@${new Date().getFullYear()}!`

    // Criar usuário no Supabase Auth
    const { data: newUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password:      tempPassword,
      email_confirm: true,
      user_metadata: { name, role },
    })

    if (authErr) {
      return NextResponse.json({ error: authErr.message }, { status: 422 })
    }

    // Upsert no profile (trigger pode ter criado com role padrão)
    await supabaseAdmin
      .from("profiles")
      .upsert({
        id:          newUser.user.id,
        name,
        email,
        role,
        locadora_id: caller.locadora_id,
      })

    return NextResponse.json({
      ok:            true,
      user_id:       newUser.user.id,
      temp_password: tempPassword,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

### 1.2 — Atualizar e Deletar usuário

Criar `src/app/api/users/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createClient as createClientSSR } from "@/lib/supabase/server"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getCallerAdmin() {
  const supabase = await createClientSSR()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: caller } = await supabaseAdmin
    .from("profiles")
    .select("id, role, locadora_id")
    .eq("id", user.id)
    .single()

  if (caller?.role !== "admin") return null
  return caller
}

// PATCH — atualizar role
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await getCallerAdmin()
    if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { id } = await params
    const { role } = await request.json()

    // Verificar que o usuário pertence à mesma locadora
    const { data: target } = await supabaseAdmin
      .from("profiles")
      .select("locadora_id")
      .eq("id", id)
      .single()

    if (target?.locadora_id !== caller.locadora_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await supabaseAdmin
      .from("profiles")
      .update({ role })
      .eq("id", id)

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE — remover usuário
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await getCallerAdmin()
    if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { id } = await params

    // Não permitir auto-exclusão
    if (id === caller.id) {
      return NextResponse.json({ error: "Não é possível remover sua própria conta" }, { status: 400 })
    }

    // Verificar mesma locadora
    const { data: target } = await supabaseAdmin
      .from("profiles")
      .select("locadora_id")
      .eq("id", id)
      .single()

    if (target?.locadora_id !== caller.locadora_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Deletar via Auth Admin (cascade deleta o profile)
    await supabaseAdmin.auth.admin.deleteUser(id)

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

---

## PASSO 2 — Reescrever página de Configurações

Substituir TODO o conteúdo de `src/app/dashboard/configuracoes/page.tsx`:

```tsx
"use client"
import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { useProfile } from "@/hooks/use-profile"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { StatusBadge } from "@/components/ui/status-badge"
import { Modal } from "@/components/ui/modal"
import { Building2, Users, Zap, Play, History, Plus, Pencil, Trash2, Copy, Check } from "lucide-react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"

// ── Tipos ─────────────────────────────────────────────────────────────────────
type TabType = "locadora" | "usuarios" | "whatsapp"

type Usuario = {
  id: string
  name: string
  email: string
  role: string
  created_at: string
}

type Disparo = {
  id: string
  tipo: string
  status: string
  created_at: string
  contratos: { clientes: { name: string } | null; veiculos: { placa: string } | null } | null
}

const STATUS_MAP = {
  enviado: { label: "Enviado", color: "var(--color-success)" },
  erro:    { label: "Erro",    color: "var(--color-danger)"  },
}

const TIPO_MAP: Record<string, string> = {
  vencimento_privado: "Privado",
  vencimento_grupo:   "Grupo",
}

const ROLES = [
  { value: "admin",      label: "Admin"      },
  { value: "atendente",  label: "Atendente"  },
  { value: "financeiro", label: "Financeiro" },
  { value: "comercial",  label: "Comercial"  },
]

const ROLE_MAP: Record<string, { label: string; color: string }> = {
  admin:      { label: "Admin",      color: "var(--color-primary)" },
  atendente:  { label: "Atendente",  color: "var(--color-accent)"  },
  financeiro: { label: "Financeiro", color: "var(--color-success)" },
  comercial:  { label: "Comercial",  color: "var(--color-warning)" },
}

// ── Schemas ───────────────────────────────────────────────────────────────────
const locadoraSchema = z.object({
  name:     z.string().min(2, "Nome obrigatório"),
  logo_url: z.string().url("URL inválida").optional().or(z.literal("")),
})

const zapiSchema = z.object({
  zapi_instance: z.string().min(1, "Instance obrigatório"),
  zapi_token:    z.string().min(1, "Token obrigatório"),
})

const userSchema = z.object({
  name:  z.string().min(2, "Nome obrigatório"),
  email: z.string().email("Email inválido"),
  role:  z.enum(["admin","atendente","financeiro","comercial"]),
})

type LocadoraForm = z.infer<typeof locadoraSchema>
type ZapiForm    = z.infer<typeof zapiSchema>
type UserForm    = z.infer<typeof userSchema>

// ── Componente principal ──────────────────────────────────────────────────────
export default function ConfiguracoesPage() {
  const { profile } = useProfile()
  const supabase    = createClient()

  const [tab,          setTab]          = useState<TabType>("locadora")
  const [usuarios,     setUsuarios]     = useState<Usuario[]>([])
  const [disparos,     setDisparos]     = useState<Disparo[]>([])
  const [loading,      setLoading]      = useState(true)
  const [modalUser,    setModalUser]    = useState(false)
  const [editingUser,  setEditingUser]  = useState<Usuario | null>(null)
  const [tempPassword, setTempPassword] = useState("")
  const [copied,       setCopied]       = useState(false)
  const [savingLoc,    setSavingLoc]    = useState(false)
  const [savingZapi,   setSavingZapi]   = useState(false)
  const [cronMsg,      setCronMsg]      = useState("")
  const [runningCron,  setRunningCron]  = useState(false)
  const [msg,          setMsg]          = useState("")

  const locadoraForm = useForm<LocadoraForm>({ resolver: zodResolver(locadoraSchema) })
  const zapiForm     = useForm<ZapiForm>({ resolver: zodResolver(zapiSchema) })
  const userForm     = useForm<UserForm>({
    resolver: zodResolver(userSchema),
    defaultValues: { role: "atendente" },
  })

  // ── Carregar dados ───────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!profile) return
    setLoading(true)

    const [locadora, users, hist] = await Promise.all([
      supabase.from("locadoras").select("name, logo_url, zapi_instance, zapi_token").eq("id", profile.locadora_id).single(),
      fetch("/api/users").then(r => r.json()),
      supabase.from("disparos").select("*, contratos(clientes(name), veiculos(placa))").order("created_at", { ascending: false }).limit(20),
    ])

    if (locadora.data) {
      locadoraForm.reset({ name: locadora.data.name ?? "", logo_url: locadora.data.logo_url ?? "" })
      zapiForm.reset({ zapi_instance: locadora.data.zapi_instance ?? "", zapi_token: locadora.data.zapi_token ?? "" })
    }

    if (Array.isArray(users)) setUsuarios(users)
    setDisparos((hist.data ?? []) as unknown as Disparo[])
    setLoading(false)
  }, [profile])

  useEffect(() => { if (profile) loadData() }, [profile, loadData])

  // ── Salvar locadora ──────────────────────────────────────────────────────
  async function saveLocadora(data: LocadoraForm) {
    if (!profile) return
    setSavingLoc(true)
    await supabase.from("locadoras").update({ name: data.name, logo_url: data.logo_url || null }).eq("id", profile.locadora_id)
    setSavingLoc(false)
    showMsg("✅ Dados da locadora salvos.")
  }

  // ── Salvar Z-API ─────────────────────────────────────────────────────────
  async function saveZapi(data: ZapiForm) {
    if (!profile) return
    setSavingZapi(true)
    await supabase.from("locadoras").update({ zapi_instance: data.zapi_instance, zapi_token: data.zapi_token }).eq("id", profile.locadora_id)
    setSavingZapi(false)
    showMsg("✅ Z-API salvo.")
  }

  // ── Criar / editar usuário ───────────────────────────────────────────────
  async function onSubmitUser(data: UserForm) {
    if (editingUser) {
      await fetch(`/api/users/${editingUser.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ role: data.role }),
      })
      setModalUser(false)
      loadData()
    } else {
      const res = await fetch("/api/users", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(data),
      })
      const result = await res.json()
      if (res.ok) {
        setTempPassword(result.temp_password)
        loadData()
      } else {
        showMsg(`❌ ${result.error}`)
        setModalUser(false)
      }
    }
  }

  async function deleteUser(id: string, name: string) {
    if (!confirm(`Remover ${name}? Esta ação não pode ser desfeita.`)) return
    await fetch(`/api/users/${id}`, { method: "DELETE" })
    loadData()
  }

  function openCreate() {
    setEditingUser(null)
    setTempPassword("")
    userForm.reset({ name: "", email: "", role: "atendente" })
    setModalUser(true)
  }

  function openEdit(u: Usuario) {
    setEditingUser(u)
    setTempPassword("")
    userForm.reset({ name: u.name, email: u.email, role: u.role as any })
    setModalUser(true)
  }

  async function runCron() {
    setRunningCron(true)
    setCronMsg("")
    const res = await fetch("/api/cron/disparos", { headers: { Authorization: "Bearer movacrm-cron-2026-secret" } })
    const data = await res.json()
    setCronMsg(res.ok ? `✅ ${data.resumo.enviados} enviado(s), ${data.resumo.erros} erro(s).` : `❌ ${data.error}`)
    loadData()
    setRunningCron(false)
  }

  function showMsg(text: string) {
    setMsg(text)
    setTimeout(() => setMsg(""), 3000)
  }

  async function copyPassword() {
    await navigator.clipboard.writeText(tempPassword)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (profile?.role !== "admin") {
    return <div className="flex items-center justify-center h-64"><p className="text-muted text-sm">Acesso restrito a administradores.</p></div>
  }

  const TABS: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: "locadora",  label: "Locadora",  icon: <Building2 size={15} /> },
    { id: "usuarios",  label: "Usuários",  icon: <Users size={15} />     },
    { id: "whatsapp",  label: "WhatsApp",  icon: <Zap size={15} />       },
  ]

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-primary">Configurações</h1>
        <p className="text-muted text-sm mt-1">Administração da locadora</p>
      </div>

      {/* Feedback global */}
      {msg && (
        <div className="mb-4 px-4 py-2.5 rounded-lg text-sm font-medium"
             style={{ backgroundColor: msg.startsWith("✅") ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                      color: msg.startsWith("✅") ? "var(--color-success)" : "var(--color-danger)" }}>
          {msg}
        </div>
      )}

      {/* Abas */}
      <div className="flex border-b border-border mb-6">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    tab === t.id ? "border-accent text-accent" : "border-transparent text-muted hover:text-text"
                  }`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {loading ? <p className="text-muted text-sm">Carregando...</p> : (
        <>
          {/* ── ABA LOCADORA ──────────────────────────────────────────── */}
          {tab === "locadora" && (
            <section className="bg-surface rounded-lg border border-border p-6 space-y-4" style={{ boxShadow: "var(--shadow-sm)" }}>
              <div className="flex items-center gap-2 mb-2">
                <Building2 size={18} style={{ color: "var(--color-accent)" }} />
                <h2 className="font-semibold text-text">Dados da Locadora</h2>
              </div>
              <form onSubmit={locadoraForm.handleSubmit(saveLocadora)} className="space-y-4">
                <Input label="Nome da locadora" {...locadoraForm.register("name")} error={locadoraForm.formState.errors.name?.message} />
                <Input label="URL do logotipo (opcional)" placeholder="https://exemplo.com/logo.png" {...locadoraForm.register("logo_url")} error={locadoraForm.formState.errors.logo_url?.message} />
                <p className="text-xs text-muted">O logotipo será exibido na barra lateral. Cole a URL de uma imagem pública.</p>
                <Button type="submit" disabled={savingLoc}>
                  {savingLoc ? "Salvando..." : "Salvar dados"}
                </Button>
              </form>
            </section>
          )}

          {/* ── ABA USUÁRIOS ──────────────────────────────────────────── */}
          {tab === "usuarios" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-muted uppercase tracking-wider">
                  Usuários ({usuarios.length})
                </h2>
                <Button size="sm" onClick={openCreate}>
                  <Plus size={14} className="mr-1.5" /> Novo usuário
                </Button>
              </div>

              <div className="bg-surface rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-background">
                      <th className="px-4 py-3 text-left font-medium text-muted">Nome</th>
                      <th className="px-4 py-3 text-left font-medium text-muted">Email</th>
                      <th className="px-4 py-3 text-left font-medium text-muted">Perfil</th>
                      <th className="px-4 py-3 text-left font-medium text-muted">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuarios.length === 0 ? (
                      <tr><td colSpan={4} className="px-4 py-8 text-center text-muted">Nenhum usuário encontrado.</td></tr>
                    ) : usuarios.map((u, i) => (
                      <tr key={u.id} className={i % 2 !== 0 ? "bg-background/50" : ""}>
                        <td className="px-4 py-3 font-medium text-text">{u.name}</td>
                        <td className="px-4 py-3 text-muted text-xs font-mono">{u.email}</td>
                        <td className="px-4 py-3"><StatusBadge status={u.role} map={ROLE_MAP} /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(u)} title="Editar perfil">
                              <Pencil size={13} />
                            </Button>
                            {u.id !== profile?.id && (
                              <Button variant="ghost" size="sm" onClick={() => deleteUser(u.id, u.name)} title="Remover usuário">
                                <Trash2 size={13} style={{ color: "var(--color-danger)" }} />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Senha temporária após criar */}
              {tempPassword && (
                <div className="bg-surface rounded-lg border border-border p-4" style={{ borderColor: "var(--color-success)" }}>
                  <p className="text-sm font-semibold text-text mb-2">✅ Usuário criado! Compartilhe as credenciais:</p>
                  <div className="flex items-center gap-2 bg-background rounded-md px-3 py-2 font-mono text-sm">
                    <span className="flex-1">{tempPassword}</span>
                    <button onClick={copyPassword} className="text-muted hover:text-text transition-colors">
                      {copied ? <Check size={14} style={{ color: "var(--color-success)" }} /> : <Copy size={14} />}
                    </button>
                  </div>
                  <p className="text-xs text-muted mt-2">O usuário deve alterar a senha no primeiro acesso.</p>
                </div>
              )}
            </div>
          )}

          {/* ── ABA WHATSAPP ──────────────────────────────────────────── */}
          {tab === "whatsapp" && (
            <div className="space-y-6">
              {/* Z-API */}
              <section className="bg-surface rounded-lg border border-border p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
                <div className="flex items-center gap-2 mb-5">
                  <Zap size={18} style={{ color: "var(--color-accent)" }} />
                  <h2 className="font-semibold text-text">Configuração Z-API</h2>
                </div>
                <form onSubmit={zapiForm.handleSubmit(saveZapi)} className="space-y-4">
                  <Input label="Instance ID" placeholder="Ex: 3D5F6A8B..." {...zapiForm.register("zapi_instance")} error={zapiForm.formState.errors.zapi_instance?.message} />
                  <Input label="Token" placeholder="Ex: F2A3B4C5D6..." {...zapiForm.register("zapi_token")} error={zapiForm.formState.errors.zapi_token?.message} />
                  <p className="text-xs text-muted">Encontre em <span className="font-mono bg-background px-1 py-0.5 rounded">app.z-api.io</span></p>
                  <Button type="submit" disabled={savingZapi}>
                    {savingZapi ? "Salvando..." : "Salvar Z-API"}
                  </Button>
                </form>
              </section>

              {/* Disparo manual */}
              <section className="bg-surface rounded-lg border border-border p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <Play size={18} style={{ color: "var(--color-success)" }} />
                  <h2 className="font-semibold text-text">Disparo Manual</h2>
                </div>
                <p className="text-sm text-muted mb-4">Envia avisos para contratos vencendo nos próximos 3 dias.</p>
                <div className="flex items-center gap-4 flex-wrap">
                  <Button onClick={runCron} disabled={runningCron} variant="secondary">
                    <Play size={14} className="mr-1.5" />
                    {runningCron ? "Executando..." : "Executar agora"}
                  </Button>
                  {cronMsg && (
                    <p className="text-sm font-medium" style={{ color: cronMsg.startsWith("✅") ? "var(--color-success)" : "var(--color-danger)" }}>
                      {cronMsg}
                    </p>
                  )}
                </div>
              </section>

              {/* Histórico */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <History size={15} className="text-muted" />
                  <h2 className="text-xs font-semibold text-muted uppercase tracking-wider">Histórico (últimos 20)</h2>
                </div>
                <div className="bg-surface rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-background">
                        <th className="px-4 py-3 text-left font-medium text-muted">Cliente</th>
                        <th className="px-4 py-3 text-left font-medium text-muted">Tipo</th>
                        <th className="px-4 py-3 text-left font-medium text-muted">Status</th>
                        <th className="px-4 py-3 text-left font-medium text-muted">Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {disparos.length === 0 ? (
                        <tr><td colSpan={4} className="px-4 py-8 text-center text-muted">Nenhum disparo registrado.</td></tr>
                      ) : disparos.map((d, i) => (
                        <tr key={d.id} className={i % 2 !== 0 ? "bg-background/50" : ""}>
                          <td className="px-4 py-3 text-text">{d.contratos?.clientes?.name ?? "—"}</td>
                          <td className="px-4 py-3 text-muted text-xs">{TIPO_MAP[d.tipo] ?? d.tipo}</td>
                          <td className="px-4 py-3"><StatusBadge status={d.status} map={STATUS_MAP} /></td>
                          <td className="px-4 py-3 font-mono text-xs text-muted">
                            {format(parseISO(d.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}
        </>
      )}

      {/* Modal criar/editar usuário */}
      <Modal open={modalUser} onClose={() => { setModalUser(false); setTempPassword("") }}
             title={editingUser ? `Editar — ${editingUser.name}` : "Novo Usuário"}>
        <form onSubmit={userForm.handleSubmit(onSubmitUser)} className="space-y-4">
          {!editingUser && (
            <>
              <Input label="Nome completo" {...userForm.register("name")} error={userForm.formState.errors.name?.message} />
              <Input label="Email" type="email" {...userForm.register("email")} error={userForm.formState.errors.email?.message} />
            </>
          )}
          <Select label="Perfil de acesso" {...userForm.register("role")}>
            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>
          {editingUser && (
            <p className="text-xs text-muted">Apenas o perfil pode ser alterado. Para trocar email ou nome, remova e crie um novo usuário.</p>
          )}
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={userForm.formState.isSubmitting}>
              {userForm.formState.isSubmitting ? "Salvando..." : editingUser ? "Salvar perfil" : "Criar usuário"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => { setModalUser(false); setTempPassword("") }}>
              Cancelar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
```

---

## PASSO 3 — Build, verificação e commit

```bash
npm run build

git add -A
git commit -m "feat(settings): gestao de usuarios, dados da locadora e configuracoes em abas"
git push origin dev
```

---

## Critério de Aceitação da Fase 08

✅ `npm run build` sem erros
✅ Aba "Locadora": edita nome e logo_url da locadora
✅ Aba "Usuários": lista usuários, cria com senha temporária, edita role, remove
✅ Aba "WhatsApp": Z-API config + disparo manual + histórico (migrado da página antiga)
✅ Admin não consegue remover a própria conta
✅ `GET /api/users` retorna 403 para não-admins
✅ Push para origin/dev

## Em caso de erro
Parar e reportar ao Hades com output completo.

## ✅ RELATÓRIO OBRIGATÓRIO
- STATUS: sucesso / erro
- STEPS EXECUTADOS
- OUTPUT DO BUILD
- ERROS ENCONTRADOS
