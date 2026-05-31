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
  disponivel: { label: "Disponível", color: "var(--color-success)" },
  alugado:    { label: "Alugado",    color: "var(--color-accent)"  },
  manutencao: { label: "Manutenção", color: "var(--color-warning)" },
}

const schema = z.object({
  placa:  z.string().min(7, "Placa inválida").max(8),
  modelo: z.string().min(2, "Modelo obrigatório"),
  ano:    z.number().min(1990, "Ano inválido").max(new Date().getFullYear() + 1, "Ano inválido"),
  status: z.enum(["disponivel", "alugado", "manutencao"]),
})
type FormData = z.infer<typeof schema>
type Veiculo  = FormData & { id: string }

export default function VeiculosPage() {
  const { profile } = useProfile()
  const supabase = createClient()
  const [veiculos,   setVeiculos]   = useState<Veiculo[]>([])
  const [loading,    setLoading]    = useState(true)
  const [modalOpen,  setModalOpen]  = useState(false)
  const [editing,    setEditing]    = useState<Veiculo | null>(null)

  const canEdit = profile?.role === "admin"

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: "disponivel" },
  })

  async function load() {
    const { data } = await supabase.from("veiculos").select("*").order("modelo")
    setVeiculos(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openCreate() {
    setEditing(null)
    reset({ placa: "", modelo: "", ano: new Date().getFullYear(), status: "disponivel" })
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

  const disponivel  = veiculos.filter(v => v.status === "disponivel").length
  const alugado     = veiculos.filter(v => v.status === "alugado").length
  const manutencao  = veiculos.filter(v => v.status === "manutencao").length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-primary">Veículos</h1>
          <p className="text-muted text-sm mt-0.5">
            {veiculos.length} total · {disponivel} disponíveis · {alugado} alugados · {manutencao} em manutenção
          </p>
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
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted">Carregando...</td></tr>
            ) : veiculos.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted">Nenhum veículo cadastrado.</td></tr>
            ) : veiculos.map((v, i) => (
              <tr key={v.id} className={i % 2 !== 0 ? "bg-background/50" : ""}>
                <td className="px-4 py-3 font-mono font-medium text-text">{v.placa}</td>
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
          <Input label="Ano" type="number" {...register("ano", { valueAsNumber: true })} error={errors.ano?.message} />
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
