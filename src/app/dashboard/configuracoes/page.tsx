"use client"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useProfile } from "@/hooks/use-profile"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { StatusBadge } from "@/components/ui/status-badge"
import { Settings, Zap, History, Play } from "lucide-react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"

const STATUS_MAP = {
  enviado: { label: "Enviado", color: "var(--color-success)" },
  erro:    { label: "Erro",    color: "var(--color-danger)"  },
}

const TIPO_MAP: Record<string, string> = {
  vencimento_privado: "Privado",
  vencimento_grupo:   "Grupo",
}

const schema = z.object({
  zapi_instance: z.string().min(1, "Instance obrigatório"),
  zapi_token:    z.string().min(1, "Token obrigatório"),
})
type FormData = z.infer<typeof schema>

type Disparo = {
  id: string
  tipo: string
  status: string
  created_at: string
  contratos: { clientes: { name: string } | null; veiculos: { placa: string } | null } | null
}

export default function ConfiguracoesPage() {
  const { profile } = useProfile()
  const supabase    = createClient()
  const [disparos,    setDisparos]    = useState<Disparo[]>([])
  const [loadingCron, setLoadingCron] = useState(false)
  const [cronMsg,     setCronMsg]     = useState("")
  const [saving,      setSaving]      = useState(false)
  const [loadingData, setLoadingData] = useState(true)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function loadData() {
    if (!profile) return

    const [locadora, hist] = await Promise.all([
      supabase
        .from("locadoras")
        .select("zapi_instance, zapi_token")
        .eq("id", profile.locadora_id)
        .single(),
      supabase
        .from("disparos")
        .select("*, contratos(clientes(name), veiculos(placa))")
        .order("created_at", { ascending: false })
        .limit(30),
    ])

    if (locadora.data) {
      reset({
        zapi_instance: locadora.data.zapi_instance ?? "",
        zapi_token:    locadora.data.zapi_token    ?? "",
      })
    }

    setDisparos((hist.data ?? []) as unknown as Disparo[])
    setLoadingData(false)
  }

  useEffect(() => {
    if (profile) loadData()
  }, [profile])

  async function onSubmit(data: FormData) {
    if (!profile) return
    setSaving(true)
    await supabase
      .from("locadoras")
      .update({ zapi_instance: data.zapi_instance, zapi_token: data.zapi_token })
      .eq("id", profile.locadora_id)
    setSaving(false)
    setCronMsg("✅ Configuração salva com sucesso.")
    setTimeout(() => setCronMsg(""), 3000)
  }

  async function dispararAgora() {
    setLoadingCron(true)
    setCronMsg("")
    try {
      const res = await fetch("/api/cron/disparos", {
        headers: { Authorization: `Bearer movacrm-cron-2026-secret` },
      })
      const data = await res.json()
      if (res.ok) {
        setCronMsg(
          `✅ Concluído — ${data.resumo.enviados} enviado(s), ${data.resumo.erros} erro(s).`
        )
        await loadData()
      } else {
        setCronMsg(`❌ Erro: ${data.error ?? "falha desconhecida"}`)
      }
    } catch {
      setCronMsg("❌ Erro de conexão ao executar o cron.")
    }
    setLoadingCron(false)
  }

  if (profile?.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted text-sm">Acesso restrito a administradores.</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-primary">Configurações</h1>
        <p className="text-muted text-sm mt-1">Integração WhatsApp e disparos automáticos</p>
      </div>

      {/* ── Z-API ──────────────────────────────────────────────────── */}
      <section
        className="bg-surface rounded-lg border border-border p-6"
        style={{ boxShadow: "var(--shadow-sm)" }}
      >
        <div className="flex items-center gap-2 mb-5">
          <Zap size={18} style={{ color: "var(--color-accent)" }} />
          <h2 className="font-semibold text-text">Configuração Z-API</h2>
        </div>

        {loadingData ? (
          <p className="text-muted text-sm">Carregando...</p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Instance ID"
              placeholder="Ex: 3D5F6A8B9C..."
              {...register("zapi_instance")}
              error={errors.zapi_instance?.message}
            />
            <Input
              label="Token"
              placeholder="Ex: F2A3B4C5D6E7..."
              {...register("zapi_token")}
              error={errors.zapi_token?.message}
            />
            <p className="text-xs text-muted">
              Encontre o Instance ID e Token no painel da Z-API em{" "}
              <span className="font-mono bg-background px-1 py-0.5 rounded">app.z-api.io</span>
            </p>
            <div className="flex items-center gap-4 flex-wrap">
              <Button type="submit" disabled={saving}>
                <Settings size={14} className="mr-1.5" />
                {saving ? "Salvando..." : "Salvar configuração"}
              </Button>
              {cronMsg && cronMsg.includes("salva") && (
                <p className="text-sm font-medium" style={{ color: "var(--color-success)" }}>
                  {cronMsg}
                </p>
              )}
            </div>
          </form>
        )}
      </section>

      {/* ── Disparo Manual ─────────────────────────────────────────── */}
      <section
        className="bg-surface rounded-lg border border-border p-6"
        style={{ boxShadow: "var(--shadow-sm)" }}
      >
        <div className="flex items-center gap-2 mb-2">
          <Play size={18} style={{ color: "var(--color-success)" }} />
          <h2 className="font-semibold text-text">Disparo Manual</h2>
        </div>
        <p className="text-sm text-muted mb-4">
          Executa agora o mesmo processo automático diário: envia avisos para contratos
          vencendo nos próximos 3 dias via WhatsApp (privado + grupo).
        </p>
        <div className="flex items-center gap-4 flex-wrap">
          <Button onClick={dispararAgora} disabled={loadingCron} variant="secondary">
            <Play size={14} className="mr-1.5" />
            {loadingCron ? "Executando..." : "Executar agora"}
          </Button>
          {cronMsg && !cronMsg.includes("salva") && (
            <p
              className="text-sm font-medium"
              style={{ color: cronMsg.startsWith("✅") ? "var(--color-success)" : "var(--color-danger)" }}
            >
              {cronMsg}
            </p>
          )}
        </div>
      </section>

      {/* ── Histórico ──────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <History size={15} className="text-muted" />
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider">
            Histórico de Disparos — últimos 30
          </h2>
        </div>
        <div className="bg-surface rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background">
                <th className="px-4 py-3 text-left font-medium text-muted">Cliente</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Placa</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Tipo</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Data</th>
              </tr>
            </thead>
            <tbody>
              {disparos.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted">
                    Nenhum disparo registrado ainda.
                  </td>
                </tr>
              ) : disparos.map((d, i) => (
                <tr key={d.id} className={i % 2 !== 0 ? "bg-background/50" : ""}>
                  <td className="px-4 py-3 text-text">{d.contratos?.clientes?.name ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs">{d.contratos?.veiculos?.placa ?? "—"}</td>
                  <td className="px-4 py-3 text-muted text-xs">{TIPO_MAP[d.tipo] ?? d.tipo}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={d.status} map={STATUS_MAP} />
                  </td>
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
  )
}
