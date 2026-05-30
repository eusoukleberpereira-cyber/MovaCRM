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
import { format, isPast, parseISO } from "date-fns"

const STATUS_MAP = {
  pago:     { label: "Pago",     color: "var(--color-success)" },
  pendente: { label: "Pendente", color: "var(--color-warning)" },
  atrasado: { label: "Atrasado", color: "var(--color-danger)"  },
}

const schema = z.object({
  contrato_id:    z.string().min(1, "Selecione o contrato"),
  valor:          z.number().min(0.01, "Valor inválido"),
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
type Contrato = {
  id: string
  data_vencimento: string
  clientes: { name: string } | null
  veiculos:  { placa: string } | null
}

export default function PagamentosPage() {
  const { profile } = useProfile()
  const supabase = createClient()
  const [pagamentos,    setPagamentos]    = useState<Pagamento[]>([])
  const [contratos,     setContratos]     = useState<Contrato[]>([])
  const [inadimplentes, setInadimplentes] = useState<Contrato[]>([])
  const [loading,       setLoading]       = useState(true)
  const [modalOpen,     setModalOpen]     = useState(false)
  const [tab,           setTab]           = useState<"historico" | "inadimplencia">("historico")

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: "pago", data_pagamento: format(new Date(), "yyyy-MM-dd") },
  })

  async function load() {
    const [p, c] = await Promise.all([
      supabase.from("pagamentos")
        .select("*, contratos(clientes(name), veiculos(placa))")
        .order("created_at", { ascending: false }),
      supabase.from("contratos")
        .select("id, data_vencimento, clientes(name), veiculos(placa)")
        .eq("status", "ativo"),
    ])
    setPagamentos(p.data ?? [])
    setContratos((c.data ?? []) as unknown as Contrato[])
    setInadimplentes(((c.data ?? []) as unknown as Contrato[]).filter(ct => isPast(parseISO(ct.data_vencimento))))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function onSubmit(data: FormData) {
    await supabase.from("pagamentos").insert(data)
    setModalOpen(false)
    reset({ status: "pago", data_pagamento: format(new Date(), "yyyy-MM-dd") })
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-primary">Pagamentos</h1>
          {inadimplentes.length > 0 && (
            <p className="text-danger text-sm mt-0.5 flex items-center gap-1.5">
              <AlertTriangle size={14} />
              {inadimplentes.length} contrato(s) com vencimento em atraso
            </p>
          )}
        </div>
        <Button onClick={() => { reset({ status: "pago", data_pagamento: format(new Date(), "yyyy-MM-dd") }); setModalOpen(true) }}>
          <Plus size={16} className="mr-1.5" /> Registrar Pagamento
        </Button>
      </div>

      {/* Abas */}
      <div className="flex gap-1 mb-5 border-b border-border">
        {(["historico", "inadimplencia"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-text"
            }`}
          >
            {t === "historico"
              ? "Histórico"
              : `Inadimplência${inadimplentes.length > 0 ? ` (${inadimplentes.length})` : ""}`}
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
                <tr><td colSpan={5} className="px-4 py-10 text-center text-muted">Carregando...</td></tr>
              ) : pagamentos.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-muted">Nenhum pagamento registrado.</td></tr>
              ) : pagamentos.map((p, i) => (
                <tr key={p.id} className={i % 2 !== 0 ? "bg-background/50" : ""}>
                  <td className="px-4 py-3 text-text">{p.contratos?.clientes?.name ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs">{p.contratos?.veiculos?.placa ?? "—"}</td>
                  <td className="px-4 py-3 text-text">R$ {Number(p.valor).toFixed(2)}</td>
                  <td className="px-4 py-3 text-muted font-mono text-xs">
                    {p.data_pagamento ? format(parseISO(p.data_pagamento), "dd/MM/yyyy") : "—"}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={p.status} map={STATUS_MAP} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "inadimplencia" && (
        <div className="bg-surface rounded-lg border overflow-hidden"
             style={{ borderColor: inadimplentes.length > 0 ? "var(--color-danger)" : "var(--color-border)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border"
                  style={{ backgroundColor: inadimplentes.length > 0 ? "rgba(239,68,68,0.05)" : undefined }}>
                <th className="px-4 py-3 text-left font-medium text-muted">Cliente</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Placa</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Venceu em</th>
              </tr>
            </thead>
            <tbody>
              {inadimplentes.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-10 text-center text-success">✅ Nenhum inadimplente.</td></tr>
              ) : inadimplentes.map((c, i) => (
                <tr key={c.id} className={i % 2 !== 0 ? "bg-background/50" : ""}>
                  <td className="px-4 py-3 font-medium text-text">{c.clientes?.name ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs">{c.veiculos?.placa ?? "—"}</td>
                  <td className="px-4 py-3 text-danger font-semibold font-mono text-xs">
                    {format(parseISO(c.data_vencimento), "dd/MM/yyyy")}
                  </td>
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
            {contratos.map(c => (
              <option key={c.id} value={c.id}>
                {c.clientes?.name} — {c.veiculos?.placa}
              </option>
            ))}
          </Select>
          <Input label="Valor (R$)" type="number" step="0.01" placeholder="0.00"
                 {...register("valor", { valueAsNumber: true })} error={errors.valor?.message} />
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
