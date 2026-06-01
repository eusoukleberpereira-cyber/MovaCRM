"use client"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useProfile } from "@/hooks/use-profile"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import { Modal } from "@/components/ui/modal"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Plus } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { format, parseISO } from "date-fns"

const STATUS_MAP = {
  ativo:     { label: "Ativo",     color: "var(--color-success)" },
  encerrado: { label: "Encerrado", color: "var(--color-muted)"   },
}

const DIAS_SEMANA = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda-feira" },
  { value: 2, label: "Terça-feira" },
  { value: 3, label: "Quarta-feira" },
  { value: 4, label: "Quinta-feira" },
  { value: 5, label: "Sexta-feira" },
  { value: 6, label: "Sábado" },
]

const DIA_BADGE: Record<number, string> = {
  0: "bg-gray-100 text-gray-600",
  1: "bg-blue-100 text-blue-700",
  2: "bg-purple-100 text-purple-700",
  3: "bg-green-100 text-green-700",
  4: "bg-yellow-100 text-yellow-700",
  5: "bg-orange-100 text-orange-700",
  6: "bg-red-100 text-red-700",
}

const schema = z.object({
  cliente_id:      z.string().min(1, "Selecione o cliente"),
  veiculo_id:      z.string().min(1, "Selecione o veículo"),
  valor_mensal:    z.number().min(1, "Valor inválido"),
  data_inicio:     z.string().min(1, "Data obrigatória"),
  data_vencimento: z.string().min(1, "Data obrigatória"),
  dia_semana:      z.number({ invalid_type_error: "Selecione o dia" }).min(0).max(6),
})
type FormData = z.infer<typeof schema>

type Contrato = {
  id: string
  valor_mensal: number
  data_inicio: string
  data_vencimento: string
  dia_semana: number | null
  status: string
  clientes: { name: string } | null
  veiculos:  { placa: string; modelo: string } | null
}
type Cliente = { id: string; name: string }
type Veiculo = { id: string; placa: string; modelo: string; status: string }

export default function ContratosPage() {
  const { profile } = useProfile()
  const supabase = createClient()
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [clientes,  setClientes]  = useState<Cliente[]>([])
  const [veiculos,  setVeiculos]  = useState<Veiculo[]>([])
  const [loading,   setLoading]   = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const canCreate = ["admin", "financeiro"].includes(profile?.role ?? "")

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function load() {
    const [ct, cl, v] = await Promise.all([
      supabase.from("contratos")
        .select("*, clientes(name), veiculos(placa, modelo)")
        .order("created_at", { ascending: false }),
      supabase.from("clientes").select("id, name").order("name"),
      supabase.from("veiculos").select("id, placa, modelo, status").order("modelo"),
    ])
    setContratos(ct.data ?? [])
    setClientes(cl.data ?? [])
    setVeiculos(v.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const veiculosDisponiveis = veiculos.filter(v => v.status === "disponivel")
  const ativos = contratos.filter(c => c.status === "ativo").length

  function openCreate() {
    setSaveError(null)
    reset({
      data_inicio:     format(new Date(), "yyyy-MM-dd"),
      data_vencimento: "",
      valor_mensal:    undefined as unknown as number,
      dia_semana:      undefined as unknown as number,
    })
    setModalOpen(true)
  }

  async function onSubmit(data: FormData) {
    setSaveError(null)
    const { error } = await supabase.from("contratos").insert({
      ...data,
      locadora_id: profile!.locadora_id,
      status: "ativo",
    })
    if (error) { setSaveError(error.message); return }
    await supabase.from("veiculos").update({ status: "alugado" }).eq("id", data.veiculo_id)
    setModalOpen(false)
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-primary">Contratos</h1>
          <p className="text-muted text-sm mt-0.5">{ativos} ativo(s) · {contratos.length} total</p>
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
              <th className="px-4 py-3 text-left font-medium text-muted">Dia do Disparo</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Vencimento</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted">Carregando...</td></tr>
            ) : contratos.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted">Nenhum contrato cadastrado.</td></tr>
            ) : contratos.map((c, i) => (
              <tr key={c.id} className={i % 2 !== 0 ? "bg-background/50" : ""}>
                <td className="px-4 py-3 font-medium text-text">{c.clientes?.name ?? "—"}</td>
                <td className="px-4 py-3 font-mono text-xs text-text">
                  {c.veiculos ? `${c.veiculos.placa} · ${c.veiculos.modelo}` : "—"}
                </td>
                <td className="px-4 py-3 text-text">R$ {Number(c.valor_mensal).toFixed(2)}</td>
                <td className="px-4 py-3">
                  {c.dia_semana != null ? (
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${DIA_BADGE[c.dia_semana]}`}>
                      {DIAS_SEMANA[c.dia_semana]?.label}
                    </span>
                  ) : <span className="text-muted">—</span>}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-text">
                  {format(parseISO(c.data_vencimento), "dd/MM/yyyy")}
                </td>
                <td className="px-4 py-3"><StatusBadge status={c.status} map={STATUS_MAP} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Novo Contrato" width="max-w-lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {saveError && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
              {saveError}
            </div>
          )}
          <Select label="Cliente" {...register("cliente_id")} error={errors.cliente_id?.message}>
            <option value="">Selecione o cliente</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select label="Veículo disponível" {...register("veiculo_id")} error={errors.veiculo_id?.message}>
            <option value="">Selecione o veículo</option>
            {veiculosDisponiveis.map(v => (
              <option key={v.id} value={v.id}>{v.placa} — {v.modelo}</option>
            ))}
          </Select>
          {veiculosDisponiveis.length === 0 && (
            <p className="text-xs text-warning">⚠️ Nenhum veículo disponível para locação.</p>
          )}
          <Select
            label="Dia do disparo semanal"
            {...register("dia_semana", { valueAsNumber: true })}
            error={errors.dia_semana?.message}
          >
            <option value="">Selecione o dia</option>
            {DIAS_SEMANA.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </Select>
          <Input label="Valor semanal (R$)" type="number" step="0.01" placeholder="0.00"
                 {...register("valor_mensal", { valueAsNumber: true })} error={errors.valor_mensal?.message} />
          <Input label="Data de início" type="date" {...register("data_inicio")} error={errors.data_inicio?.message} />
          <Input label="Data de vencimento do contrato" type="date" {...register("data_vencimento")} error={errors.data_vencimento?.message} />
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={isSubmitting || veiculosDisponiveis.length === 0}>
              {isSubmitting ? "Criando..." : "Criar contrato"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
