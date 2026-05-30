"use client"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Car, Users, FileText, AlertTriangle } from "lucide-react"
import { isPast, parseISO } from "date-fns"

type Stats = {
  veiculos: number
  disponiveis: number
  clientes: number
  contratos: number
  inadimplentes: number
}

export default function DashboardPage() {
  const supabase = createClient()
  const [stats, setStats] = useState<Stats>({
    veiculos: 0, disponiveis: 0, clientes: 0, contratos: 0, inadimplentes: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [v, c, ct] = await Promise.all([
        supabase.from("veiculos").select("id, status"),
        supabase.from("clientes").select("id", { count: "exact", head: true }),
        supabase.from("contratos").select("id, data_vencimento, status").eq("status", "ativo"),
      ])
      const veiculos     = v.data ?? []
      const contratos    = ct.data ?? []
      const inadimplentes = contratos.filter(c => isPast(parseISO(c.data_vencimento))).length

      setStats({
        veiculos:     veiculos.length,
        disponiveis:  veiculos.filter(v => v.status === "disponivel").length,
        clientes:     c.count ?? 0,
        contratos:    contratos.length,
        inadimplentes,
      })
      setLoading(false)
    }
    load()
  }, [])

  const cards = [
    {
      label:    "Veículos na frota",
      value:    stats.veiculos,
      sub:      `${stats.disponiveis} disponíveis`,
      icon:     Car,
      color:    "var(--color-primary)",
    },
    {
      label:    "Clientes cadastrados",
      value:    stats.clientes,
      sub:      "total",
      icon:     Users,
      color:    "var(--color-accent)",
    },
    {
      label:    "Contratos ativos",
      value:    stats.contratos,
      sub:      "em andamento",
      icon:     FileText,
      color:    "var(--color-success)",
    },
    {
      label:    "Inadimplentes",
      value:    stats.inadimplentes,
      sub:      "contratos vencidos",
      icon:     AlertTriangle,
      color:    stats.inadimplentes > 0 ? "var(--color-danger)" : "var(--color-muted)",
    },
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-primary">Dashboard</h1>
        <p className="text-muted text-sm mt-1">Visão geral da locadora</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value, sub, icon: Icon, color }) => (
          <div
            key={label}
            className="bg-surface rounded-lg border border-border p-5"
            style={{ boxShadow: "var(--shadow-sm)" }}
          >
            <div className="flex items-start justify-between mb-4">
              <p className="text-sm font-medium text-muted leading-snug">{label}</p>
              <div className="p-2 rounded-lg shrink-0" style={{ backgroundColor: `${color}18` }}>
                <Icon size={18} style={{ color }} />
              </div>
            </div>
            <p className="font-display text-3xl font-bold" style={{ color }}>
              {loading ? "—" : value}
            </p>
            <p className="text-xs text-muted mt-1">{sub}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
