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
type Cliente  = FormData & { id: string }

export default function ClientesPage() {
  const { profile } = useProfile()
  const supabase = createClient()
  const [clientes,  setClientes]  = useState<Cliente[]>([])
  const [busca,     setBusca]     = useState("")
  const [loading,   setLoading]   = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing,   setEditing]   = useState<Cliente | null>(null)

  const canEdit = ["admin", "atendente"].includes(profile?.role ?? "")

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
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
              <tr><td colSpan={4} className="px-4 py-10 text-center text-muted">Carregando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-muted">Nenhum cliente encontrado.</td></tr>
            ) : filtered.map((c, i) => (
              <tr key={c.id} className={i % 2 !== 0 ? "bg-background/50" : ""}>
                <td className="px-4 py-3 font-medium text-text">{c.name}</td>
                <td className="px-4 py-3 text-muted font-mono text-xs">{c.cpf || "—"}</td>
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
