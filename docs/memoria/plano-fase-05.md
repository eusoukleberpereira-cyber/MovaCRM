# INSTRUÇÕES PARA ATLAS — FASE 05: WHATSAPP & DISPAROS AUTOMÁTICOS

## Contexto
Fases 01-04 completas. Sistema no ar.
Tabelas: `locadoras` (tem zapi_token, zapi_instance), `contratos`, `clientes`, `disparos`.
Next.js 16, App Router, Tailwind v4, componentes UI em src/components/ui/.
SUPABASE_SERVICE_ROLE_KEY já está em .env.local.

## Objetivo
1. Variável CRON_SECRET no .env.local
2. vercel.json com cron schedule
3. Route Handler /api/cron/disparos — lógica de disparo via Z-API
4. Página /dashboard/configuracoes — admin configura Z-API + disparo manual + histórico
5. Sidebar: adicionar "Configurações" (admin only)

---

## PASSO 1 — Adicionar CRON_SECRET ao .env.local

Adicionar esta linha ao final de `.env.local`:
```
CRON_SECRET=movacrm-cron-2026-secret
```

---

## PASSO 2 — Criar vercel.json

Criar `vercel.json` na raiz do projeto:

```json
{
  "crons": [
    {
      "path": "/api/cron/disparos",
      "schedule": "0 8 * * *"
    }
  ]
}
```

O cron roda diariamente às 8h UTC (5h horário de Brasília).

---

## PASSO 3 — Criar Route Handler do Cron

Criar `src/app/api/cron/disparos/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { addDays, format } from "date-fns"
import { ptBR } from "date-fns/locale"

// Supabase admin — bypassa RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DIAS_ANTES = 3 // avisa X dias antes do vencimento

export async function GET(request: NextRequest) {
  // Verificar autorização do cron
  const authHeader = request.headers.get("authorization")
  const isVercelCron = request.headers.get("x-vercel-cron") === "1"
  const isManual = authHeader === `Bearer ${process.env.CRON_SECRET}`

  if (!isVercelCron && !isManual) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const hoje     = new Date()
  const limite   = addDays(hoje, DIAS_ANTES)
  const hojeISO  = hoje.toISOString().split("T")[0]
  const limiteISO = limite.toISOString().split("T")[0]

  const resumo = { enviados: 0, erros: 0, locadoras: 0 }

  try {
    // Buscar locadoras com Z-API configurado
    const { data: locadoras } = await supabaseAdmin
      .from("locadoras")
      .select("id, name, zapi_token, zapi_instance")
      .not("zapi_token", "is", null)
      .not("zapi_instance", "is", null)

    if (!locadoras?.length) {
      return NextResponse.json({ message: "Nenhuma locadora com Z-API configurado.", resumo })
    }

    for (const locadora of locadoras) {
      resumo.locadoras++

      // Buscar contratos vencendo nos próximos DIAS_ANTES dias
      const { data: contratos } = await supabaseAdmin
        .from("contratos")
        .select(`
          id,
          data_vencimento,
          valor_mensal,
          clientes (name, whatsapp, grupo_whatsapp_id),
          veiculos  (placa, modelo)
        `)
        .eq("locadora_id", locadora.id)
        .eq("status", "ativo")
        .gte("data_vencimento", hojeISO)
        .lte("data_vencimento", limiteISO)

      if (!contratos?.length) continue

      for (const contrato of contratos as any[]) {
        const cliente    = contrato.clientes
        const veiculo    = contrato.veiculos
        const vencimento = new Date(contrato.data_vencimento)
        const diasRestantes = Math.ceil(
          (vencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)
        )
        const dataFormatada = format(vencimento, "dd/MM/yyyy", { locale: ptBR })

        // ── Mensagem privada ─────────────────────────────────────────────────
        const msgPrivada = [
          `Olá, *${cliente.name}*! 👋`,
          ``,
          `Seu contrato de locação está próximo do vencimento:`,
          `🚗 Veículo: *${veiculo.modelo}* (Placa: ${veiculo.placa})`,
          `📅 Vencimento: *${dataFormatada}* (em ${diasRestantes} dia${diasRestantes > 1 ? "s" : ""})`,
          `💰 Valor mensal: R$ ${Number(contrato.valor_mensal).toFixed(2)}`,
          ``,
          `Entre em contato para renovação ou maiores informações.`,
        ].join("\n")

        const resultPrivado = await enviarZAPI(
          locadora.zapi_instance,
          locadora.zapi_token,
          cliente.whatsapp,
          msgPrivada
        )

        await supabaseAdmin.from("disparos").insert({
          locadora_id: locadora.id,
          contrato_id: contrato.id,
          tipo:        "vencimento_privado",
          status:      resultPrivado.ok ? "enviado" : "erro",
          mensagem:    msgPrivada,
        })

        if (resultPrivado.ok) resumo.enviados++
        else resumo.erros++

        // ── Mensagem no grupo (se houver) ────────────────────────────────────
        if (cliente.grupo_whatsapp_id) {
          const msgGrupo = [
            `📋 *Aviso de Vencimento*`,
            ``,
            `Contrato do veículo *${veiculo.modelo}* (Placa: ${veiculo.placa})`,
            `vence em *${dataFormatada}* (${diasRestantes} dia${diasRestantes > 1 ? "s" : ""}).`,
          ].join("\n")

          const resultGrupo = await enviarZAPI(
            locadora.zapi_instance,
            locadora.zapi_token,
            cliente.grupo_whatsapp_id,
            msgGrupo
          )

          await supabaseAdmin.from("disparos").insert({
            locadora_id: locadora.id,
            contrato_id: contrato.id,
            tipo:        "vencimento_grupo",
            status:      resultGrupo.ok ? "enviado" : "erro",
            mensagem:    msgGrupo,
          })

          if (resultGrupo.ok) resumo.enviados++
          else resumo.erros++
        }
      }
    }

    return NextResponse.json({
      message: "Cron executado com sucesso.",
      resumo,
      executado_em: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error("[CRON] Erro:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ── Utilitário: chamar Z-API ─────────────────────────────────────────────────
async function enviarZAPI(
  instance: string,
  token: string,
  phone: string,
  message: string
): Promise<{ ok: boolean; data?: unknown }> {
  try {
    const url = `https://api.z-api.io/instances/${instance}/token/${token}/send-text`
    const res = await fetch(url, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "Client-Token": token },
      body:    JSON.stringify({ phone, message }),
    })
    const data = await res.json()
    return { ok: res.ok, data }
  } catch (err) {
    console.error("[Z-API] Erro ao enviar:", err)
    return { ok: false }
  }
}
```

---

## PASSO 4 — Criar página de Configurações

Criar `src/app/dashboard/configuracoes/page.tsx`:

```tsx
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

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  // Carregar config atual e histórico
  useEffect(() => {
    async function load() {
      if (!profile) return

      const [locadora, hist] = await Promise.all([
        supabase.from("locadoras").select("zapi_instance, zapi_token").eq("id", profile.locadora_id).single(),
        supabase.from("disparos")
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
    }
    load()
  }, [profile])

  // Salvar configuração Z-API
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

  // Disparar manualmente
  async function dispararAgora() {
    setLoadingCron(true)
    setCronMsg("")
    try {
      const res = await fetch("/api/cron/disparos", {
        headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET ?? "movacrm-cron-2026-secret"}` },
      })
      const data = await res.json()
      if (res.ok) {
        setCronMsg(`✅ Concluído — ${data.resumo.enviados} enviado(s), ${data.resumo.erros} erro(s).`)
        // Recarregar histórico
        const { data: hist } = await supabase
          .from("disparos")
          .select("*, contratos(clientes(name), veiculos(placa))")
          .order("created_at", { ascending: false })
          .limit(30)
        setDisparos((hist ?? []) as unknown as Disparo[])
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

      {/* ── Z-API Config ──────────────────────────────────── */}
      <section className="bg-surface rounded-lg border border-border p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="flex items-center gap-2 mb-5">
          <Zap size={18} style={{ color: "var(--color-accent)" }} />
          <h2 className="font-semibold text-text">Configuração Z-API</h2>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Instance ID"
            placeholder="Ex: 3D5F6A8B..."
            {...register("zapi_instance")}
            error={errors.zapi_instance?.message}
          />
          <Input
            label="Token"
            placeholder="Ex: F2A3B4C5D6..."
            {...register("zapi_token")}
            error={errors.zapi_token?.message}
          />
          <p className="text-xs text-muted">
            Encontre o Instance ID e Token no painel da Z-API em{" "}
            <span className="font-mono">app.z-api.io</span>
          </p>
          <Button type="submit" disabled={saving}>
            <Settings size={14} className="mr-1.5" />
            {saving ? "Salvando..." : "Salvar configuração"}
          </Button>
        </form>
      </section>

      {/* ── Disparo Manual ────────────────────────────────── */}
      <section className="bg-surface rounded-lg border border-border p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="flex items-center gap-2 mb-2">
          <Play size={18} style={{ color: "var(--color-success)" }} />
          <h2 className="font-semibold text-text">Disparo Manual</h2>
        </div>
        <p className="text-sm text-muted mb-4">
          Executa agora o mesmo processo que roda automaticamente todo dia às 5h. Envia avisos para contratos vencendo nos próximos 3 dias.
        </p>
        <div className="flex items-center gap-4 flex-wrap">
          <Button onClick={dispararAgora} disabled={loadingCron} variant="secondary">
            <Play size={14} className="mr-1.5" />
            {loadingCron ? "Executando..." : "Executar agora"}
          </Button>
          {cronMsg && (
            <p className="text-sm font-medium" style={{ color: cronMsg.startsWith("✅") ? "var(--color-success)" : "var(--color-danger)" }}>
              {cronMsg}
            </p>
          )}
        </div>
      </section>

      {/* ── Histórico de Disparos ─────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <History size={16} className="text-muted" />
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider">
            Histórico de Disparos (últimos 30)
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
                  <td className="px-4 py-3 text-muted">{TIPO_MAP[d.tipo] ?? d.tipo}</td>
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
  )
}
```

---

## PASSO 5 — Adicionar Configurações à Sidebar

Editar `src/components/sidebar.tsx`:

**5.1 — Adicionar import do ícone:**
Trocar:
```tsx
  LayoutDashboard, Car, Users, FileText, CreditCard, LogOut, Columns3,
```
Por:
```tsx
  LayoutDashboard, Car, Users, FileText, CreditCard, LogOut, Columns3, Settings,
```

**5.2 — Adicionar ao final do array NAV:**
```tsx
  { href: "/dashboard/configuracoes", label: "Configurações", icon: Settings, roles: ["admin"] },
```

---

## PASSO 6 — Adicionar variável à Vercel

Após build e commit, rodar:
```bash
echo "movacrm-cron-2026-secret" | npx vercel env add CRON_SECRET production \
  --token $VERCEL_TOKEN \
  --scope kleber-pereiras-projects --yes
```

---

## PASSO 7 — Build, verificação e commit

```bash
npm run build

git add -A
# verificar secrets (excluindo padrões de documentação)
git diff --cached | grep -E "(SERVICE_ROLE|eyJhb)" | grep -v grep

git commit -m "feat(whatsapp): cron de disparos, config Z-API e historico"
git push origin dev
```

---

## Critério de Aceitação da Fase 05

✅ `npm run build` sem erros
✅ Sidebar exibe "Configurações" apenas para admin
✅ `GET /api/cron/disparos` retorna 401 sem o header correto
✅ `GET /api/cron/disparos` com header retorna JSON com resumo
✅ Página /dashboard/configuracoes carrega com form Z-API e histórico
✅ Botão "Executar agora" chama o cron e exibe resultado
✅ `vercel.json` criado com cron schedule
✅ Push para origin/dev

## Em caso de erro
Parar e reportar ao Hades com output completo.

## ✅ RELATÓRIO OBRIGATÓRIO AO CONCLUIR
- STATUS: sucesso / erro
- STEPS EXECUTADOS
- OUTPUT DO BUILD
- ERROS ENCONTRADOS
