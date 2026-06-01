"use client"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useProfile } from "@/hooks/use-profile"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { ClienteDocumentos } from "@/components/clientes/ClienteDocumentos"
import { Plus, Pencil, Search, FolderOpen, FileEdit } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

const UF_LIST = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"]
const CNH_CATS = ["A","B","C","D","E","AB","AC"]

const schema = z.object({
  name:     z.string().min(2, "Nome obrigatório"),
  cpf:      z.string().optional(),
  rg:       z.string().optional(),
  whatsapp: z.string().min(10, "WhatsApp inválido"),
  logradouro:  z.string().optional(),
  numero:      z.string().optional(),
  complemento: z.string().optional(),
  bairro:      z.string().optional(),
  cidade:      z.string().optional(),
  estado:      z.string().optional(),
  cep:         z.string().optional(),
  cnh_numero:                    z.string().optional(),
  cnh_categoria:                 z.string().optional(),
  cnh_data_primeira_habilitacao: z.string().optional(),
  cnh_data_validade:             z.string().optional(),
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
  const [activeTab, setActiveTab] = useState<"dados" | "documentos">("dados")

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
    setActiveTab("dados")
    reset({ name: "", cpf: "", rg: "", whatsapp: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "", cep: "", cnh_numero: "", cnh_categoria: "", cnh_data_primeira_habilitacao: "", cnh_data_validade: "" })
    setModalOpen(true)
  }

  function openEdit(c: Cliente) {
    setEditing(c)
    setActiveTab("dados")
    reset({
      name: c.name, cpf: c.cpf, rg: c.rg, whatsapp: c.whatsapp,
      logradouro: c.logradouro, numero: c.numero, complemento: c.complemento,
      bairro: c.bairro, cidade: c.cidade, estado: c.estado, cep: c.cep,
      cnh_numero: c.cnh_numero, cnh_categoria: c.cnh_categoria,
      cnh_data_primeira_habilitacao: c.cnh_data_primeira_habilitacao,
      cnh_data_validade: c.cnh_data_validade,
    })
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
             title={editing ? "Editar Cliente" : "Novo Cliente"}
             width="max-w-2xl">

        {/* Abas — só mostra documentos ao editar cliente existente */}
        {editing && (
          <div className="flex gap-1 mb-4 border-b border-border -mt-1 pb-0">
            {([["dados", FileEdit, "Dados"], ["documentos", FolderOpen, "Documentos"]] as const).map(([key, Icon, label]) => (
              <button key={key} type="button" onClick={() => setActiveTab(key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-all ${activeTab === key ? "border-accent text-accent" : "border-transparent text-muted hover:text-text"}`}>
                <Icon size={13} />{label}
              </button>
            ))}
          </div>
        )}

        {/* Aba Documentos */}
        {activeTab === "documentos" && editing && (
          <div className="max-h-[65vh] overflow-y-auto pr-1">
            <ClienteDocumentos clienteId={editing.id} />
          </div>
        )}

        {/* Aba Dados */}
        {activeTab === "dados" && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">

          {/* Dados pessoais */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">Dados Pessoais</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Input label="Nome completo *" {...register("name")} error={errors.name?.message} />
              </div>
              <Input label="CPF" placeholder="000.000.000-00" {...register("cpf")} />
              <Input label="RG" placeholder="00.000.000-0" {...register("rg")} />
              <Input label="WhatsApp *" placeholder="5511999999999" {...register("whatsapp")} error={errors.whatsapp?.message} />
            </div>
          </div>

          {/* Endereço */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">Endereço</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Input label="Logradouro" placeholder="Rua, Avenida, Travessa..." {...register("logradouro")} />
              </div>
              <Input label="Número" placeholder="123" {...register("numero")} />
              <Input label="Complemento" placeholder="Apto 42, Bloco B..." {...register("complemento")} />
              <Input label="Bairro" placeholder="Centro" {...register("bairro")} />
              <Input label="CEP" placeholder="00000-000" {...register("cep")} />
              <Input label="Cidade" placeholder="São Paulo" {...register("cidade")} />
              <Select label="Estado" {...register("estado")}>
                <option value="">Selecione</option>
                {UF_LIST.map(uf => <option key={uf} value={uf}>{uf}</option>)}
              </Select>
            </div>
          </div>

          {/* Habilitação */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">Habilitação (CNH)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Número de Registro" placeholder="00000000000" {...register("cnh_numero")} />
              <Select label="Categoria" {...register("cnh_categoria")}>
                <option value="">Selecione</option>
                {CNH_CATS.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </Select>
              <Input label="Data da 1ª Habilitação" type="date" {...register("cnh_data_primeira_habilitacao")} />
              <Input label="Data de Validade" type="date" {...register("cnh_data_validade")} />
            </div>
          </div>

          <div className="flex gap-3 pt-2 border-t border-border sticky bottom-0 bg-surface pb-1">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : editing ? "Salvar alterações" : "Cadastrar cliente"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
          </div>
        </form>
        )}
      </Modal>
    </div>
  )
}
