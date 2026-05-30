# INSTRUÇÕES PARA ATLAS — FASE 03: DASHBOARD COMPLETO

## Contexto
Fase 02 completa. Dashboard básico existe em src/app/dashboard/page.tsx com 4 cards.
Substituir completamente por dashboard rico com frota, financeiro e alertas operacionais.
Next.js 16, Tailwind v4, design tokens aplicados. Stack de componentes UI em src/components/ui/.

## Objetivo
Reescrever src/app/dashboard/page.tsx com:
1. Seção Frota — 4 cards: Total, Disponíveis, Alugados, Manutenção
2. Seção Financeiro — 2 cards: Receita do mês (R$), Inadimplência total (R$)
3. Dois painéis lado a lado: Contratos vencendo em 7 dias | Inadimplentes ativos

## Pré-condições
- [ ] `git checkout dev && git pull origin dev`
- [ ] `npm run dev` rodando sem erros

---

## PASSO 1 — Substituir dashboard/page.tsx

Substituir TODO o conteúdo de `src/app/dashboard/page.tsx` por:

```tsx
"use client"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Car, CheckCircle, Key, Wrench, TrendingUp, AlertTriangle, Clock } from "lucide-react"
import { format, isPast, isWithinInterval, addDays, differenceInDays, parseISO, startOfMonth, endOfMonth } from "date-fns"
import { ptBR } from "date-fns/locale"

type VeiculoStatus = { status: string }

type ContratoVencendo = {
  id: string
  data_vencimento: string
  clientes: { name: string } | null
  veiculos:  { placa: string; modelo: string } | null
}

type Inadimplente = ContratoVencendo

type Stats = {
  frota:       { total: number; disponivel: number; alugado: number; manutencao: number }
  financeiro:  { receita: number; inadimplencia: number }
  vencendo:    ContratoVencendo[]
  inadimplentes: Inadimplente[]
}

function moeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export default function DashboardPage() {
  const supabase = createClient()
  const [stats,   setStats]   = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const hoje  = new Date()
      const em7   = addDays(hoje, 7)
      const inicioMes = startOfMonth(hoje).toISOString()
      const fimMes    = endOfMonth(hoje).toISOString()

      const [veiculos, contratos, pagamentos] = await Promise.all([
        supabase.from("veiculos").select("status"),
        supabase.from("contratos")
          .select("id, data_vencimento, clientes(name), veiculos(placa, modelo)")
          .eq("status", "ativo"),
        supabase.from("pagamentos")
          .select("valor, status, created_at")
          .gte("created_at", inicioMes)
          .lte("created_at", fimMes),
      ])

      const vs = (veiculos.data ?? []) as VeiculoStatus[]
      const cts = (contratos.data ?? []) as unknown as ContratoVencendo[]
      const pgs = pagamentos.data ?? []

      const vencendo    = cts.filter(c => isWithinInterval(parseISO(c.data_vencimento), { start: hoje, end: em7 }))
      const inadimplentes = cts.filter(c => isPast(parseISO(c.data_vencimento)))

      const receita      = pgs.filter(p => p.status === "pago").reduce((s, p) => s + Number(p.valor), 0)
      const inadimValor  = pgs.filter(p => p.status === "atrasado").reduce((s, p) => s + Number(p.valor), 0)

      setStats({
        frota: {
          total:      vs.length,
          disponivel: vs.filter(v => v.status === "disponivel").length,
          alugado:    vs.filter(v => v.status === "alugado").length,
          manutencao: vs.filter(v => v.status === "manutencao").length,
        },
        financeiro: { receita, inadimplencia: inadimValor },
        vencendo,
        inadimplentes,
      })
      setLoading(false)
    }
    load()
  }, [])

  const mesAtual = format(new Date(), "MMMM yyyy", { locale: ptBR })

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="font-display text-2xl font-bold text-primary">Dashboard</h1>
        <p className="text-muted text-sm mt-1 capitalize">{mesAtual}</p>
      </div>

      {/* ── FROTA ─────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Frota</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Total",       value: stats?.frota.total,      icon: Car,         color: "var(--color-primary)" },
            { label: "Disponíveis", value: stats?.frota.disponivel, icon: CheckCircle, color: "var(--color-success)" },
            { label: "Alugados",    value: stats?.frota.alugado,    icon: Key,         color: "var(--color-accent)"  },
            { label: "Manutenção",  value: stats?.frota.manutencao, icon: Wrench,      color: "var(--color-warning)" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-surface rounded-lg border border-border p-4"
                 style={{ boxShadow: "var(--shadow-sm)" }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-muted">{label}</p>
                <div className="p-1.5 rounded-md" style={{ backgroundColor: `${color}18` }}>
                  <Icon size={14} style={{ color }} />
                </div>
              </div>
              <p className="font-display text-2xl font-bold" style={{ color }}>
                {loading ? "—" : (value ?? 0)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FINANCEIRO ────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Financeiro — {mesAtual}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-surface rounded-lg border border-border p-5"
               style={{ boxShadow: "var(--shadow-sm)" }}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-muted">Receita do mês</p>
              <div className="p-2 rounded-lg" style={{ backgroundColor: "var(--color-success)18" }}>
                <TrendingUp size={18} style={{ color: "var(--color-success)" }} />
              </div>
            </div>
            <p className="font-display text-3xl font-bold" style={{ color: "var(--color-success)" }}>
              {loading ? "—" : moeda(stats?.financeiro.receita ?? 0)}
            </p>
            <p className="text-xs text-muted mt-1">pagamentos confirmados</p>
          </div>

          <div className="bg-surface rounded-lg border p-5"
               style={{
                 boxShadow: "var(--shadow-sm)",
                 borderColor: (stats?.inadimplentes.length ?? 0) > 0 ? "var(--color-danger)" : "var(--color-border)"
               }}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-muted">Inadimplência</p>
              <div className="p-2 rounded-lg" style={{ backgroundColor: "var(--color-danger)18" }}>
                <AlertTriangle size={18} style={{ color: "var(--color-danger)" }} />
              </div>
            </div>
            <p className="font-display text-3xl font-bold" style={{ color: "var(--color-danger)" }}>
              {loading ? "—" : `${stats?.inadimplentes.length ?? 0}`}
              <span className="text-lg font-normal text-muted ml-2">contratos</span>
            </p>
            <p className="text-xs text-muted mt-1">com vencimento em atraso</p>
          </div>
        </div>
      </section>

      {/* ── ALERTAS ───────────────────────────── */}
      <section>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Vencendo em 7 dias */}
          <div className="bg-surface rounded-lg border border-border overflow-hidden"
               style={{ boxShadow: "var(--shadow-sm)" }}>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-background">
              <Clock size={15} style={{ color: "var(--color-accent)" }} />
              <h3 className="text-sm font-semibold text-text">Vencendo nos próximos 7 dias</h3>
              {!loading && (
                <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: (stats?.vencendo.length ?? 0) > 0 ? "var(--color-accent)" : "var(--color-muted)" }}>
                  {stats?.vencendo.length ?? 0}
                </span>
              )}
            </div>
            <div className="divide-y divide-border">
              {loading ? (
                <p className="px-4 py-6 text-sm text-center text-muted">Carregando...</p>
              ) : (stats?.vencendo.length ?? 0) === 0 ? (
                <p className="px-4 py-6 text-sm text-center text-muted">✅ Nenhum contrato vencendo em 7 dias</p>
              ) : stats!.vencendo.map(c => {
                const diasRestantes = differenceInDays(parseISO(c.data_vencimento), new Date())
                return (
                  <div key={c.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-text">{c.clientes?.name ?? "—"}</p>
                      <p className="text-xs font-mono text-muted mt-0.5">
                        {c.veiculos?.placa} · {c.veiculos?.modelo}
                      </p>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className="text-xs font-mono font-semibold" style={{ color: "var(--color-accent)" }}>
                        {format(parseISO(c.data_vencimento), "dd/MM/yyyy")}
                      </p>
                      <p className="text-xs text-muted mt-0.5">
                        em {diasRestantes === 0 ? "hoje" : `${diasRestantes}d`}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Inadimplentes */}
          <div className="bg-surface rounded-lg border overflow-hidden"
               style={{
                 boxShadow: "var(--shadow-sm)",
                 borderColor: (stats?.inadimplentes.length ?? 0) > 0 ? "var(--color-danger)" : "var(--color-border)"
               }}>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border"
                 style={{ backgroundColor: (stats?.inadimplentes.length ?? 0) > 0 ? "rgba(239,68,68,0.05)" : undefined }}>
              <AlertTriangle size={15} style={{ color: "var(--color-danger)" }} />
              <h3 className="text-sm font-semibold text-text">Inadimplentes</h3>
              {!loading && (
                <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: (stats?.inadimplentes.length ?? 0) > 0 ? "var(--color-danger)" : "var(--color-muted)" }}>
                  {stats?.inadimplentes.length ?? 0}
                </span>
              )}
            </div>
            <div className="divide-y divide-border">
              {loading ? (
                <p className="px-4 py-6 text-sm text-center text-muted">Carregando...</p>
              ) : (stats?.inadimplentes.length ?? 0) === 0 ? (
                <p className="px-4 py-6 text-sm text-center text-muted">✅ Nenhum inadimplente</p>
              ) : stats!.inadimplentes.map(c => {
                const diasAtraso = differenceInDays(new Date(), parseISO(c.data_vencimento))
                return (
                  <div key={c.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-text">{c.clientes?.name ?? "—"}</p>
                      <p className="text-xs font-mono text-muted mt-0.5">
                        {c.veiculos?.placa} · {c.veiculos?.modelo}
                      </p>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className="text-xs font-mono font-semibold" style={{ color: "var(--color-danger)" }}>
                        {format(parseISO(c.data_vencimento), "dd/MM/yyyy")}
                      </p>
                      <p className="text-xs font-semibold mt-0.5" style={{ color: "var(--color-danger)" }}>
                        {diasAtraso}d em atraso
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

        </div>
      </section>
    </div>
  )
}
```

---

## PASSO 2 — Instalar date-fns locale pt-BR

Verificar se `date-fns` já está instalado (deve estar da Fase 02). Se sim, apenas confirmar.

```bash
node -e "require('date-fns/locale')" && echo "OK"
```

Se falhar: `npm install date-fns`

---

## PASSO 3 — Build, verificação e commit

```bash
# Verificar build
npm run build

# Verificar secrets
git add -A
git diff --cached | grep -E "(API_KEY|SERVICE_ROLE|eyJ)"

# Commit
git commit -m "feat(dashboard): frota, financeiro, vencimentos e inadimplentes em tempo real"
git push origin dev
```

---

## Critério de Aceitação da Fase 03

✅ `npm run build` sem erros
✅ Dashboard exibe 4 cards de frota (Total, Disponíveis, Alugados, Manutenção)
✅ Receita do mês calculada dos pagamentos com status "pago"
✅ Painel "Vencendo em 7 dias" com lista de contratos (ou mensagem vazia)
✅ Painel "Inadimplentes" com lista + dias em atraso (ou mensagem vazia)
✅ Push para origin/dev

## Em caso de erro
Parar e reportar ao Hades com output completo.

## ✅ RELATÓRIO OBRIGATÓRIO AO CONCLUIR
- STATUS: sucesso / erro
- STEPS EXECUTADOS
- OUTPUT DO BUILD
- ERROS ENCONTRADOS
