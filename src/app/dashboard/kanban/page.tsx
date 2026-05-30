"use client"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useProfile } from "@/hooks/use-profile"
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import { Input } from "@/components/ui/input"
import { Plus, GripVertical } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"

// ── Colunas do pipeline ────────────────────────────────────────────────────────
const ESTAGIOS = [
  { id: "lead",         label: "Lead",         color: "var(--color-kanban-lead)"       },
  { id: "qualificacao", label: "Qualificação",  color: "var(--color-kanban-qualif)"     },
  { id: "proposta",     label: "Proposta",      color: "var(--color-kanban-proposta)"   },
  { id: "negociacao",   label: "Negociação",    color: "var(--color-kanban-negociacao)" },
  { id: "fechado",      label: "Fechado",       color: "var(--color-kanban-fechado)"    },
  { id: "renovacao",    label: "Renovação",     color: "var(--color-kanban-renovacao)"  },
] as const

type Estagio = typeof ESTAGIOS[number]["id"]

type KanbanCard = {
  id: string
  estagio: Estagio
  cliente_nome: string
  cliente_whatsapp: string | null
  responsavel_id: string | null
  posicao: number
  created_at: string
}

// ── Schema do formulário ───────────────────────────────────────────────────────
const schema = z.object({
  cliente_nome:     z.string().min(2, "Nome obrigatório"),
  cliente_whatsapp: z.string().optional(),
  estagio:          z.enum(["lead","qualificacao","proposta","negociacao","fechado","renovacao"]),
})
type FormData = z.infer<typeof schema>

// ── Componente principal ───────────────────────────────────────────────────────
export default function KanbanPage() {
  const { profile } = useProfile()
  const supabase    = createClient()
  const [cards,     setCards]     = useState<KanbanCard[]>([])
  const [loading,   setLoading]   = useState(true)
  const [modalOpen, setModalOpen] = useState(false)

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } =
    useForm<FormData>({
      resolver: zodResolver(schema),
      defaultValues: { estagio: "lead" },
    })

  // ── Carregar cards ───────────────────────────────────────────────────────────
  async function load() {
    const { data } = await supabase
      .from("kanban_cards")
      .select("*")
      .order("posicao")
    setCards((data ?? []) as KanbanCard[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // ── Utilitário: cards de uma coluna ─────────────────────────────────────────
  function cardsByEstagio(estagio: Estagio) {
    return cards
      .filter(c => c.estagio === estagio)
      .sort((a, b) => a.posicao - b.posicao)
  }

  // ── Abrir modal com estágio pré-selecionado ──────────────────────────────────
  function openModal(estagio: Estagio = "lead") {
    reset({ cliente_nome: "", cliente_whatsapp: "", estagio })
    setValue("estagio", estagio)
    setModalOpen(true)
  }

  // ── Criar card ───────────────────────────────────────────────────────────────
  async function onSubmit(data: FormData) {
    const posicao = cardsByEstagio(data.estagio).length
    await supabase.from("kanban_cards").insert({
      ...data,
      locadora_id:    profile!.locadora_id,
      responsavel_id: profile!.id,
      posicao,
    })
    setModalOpen(false)
    load()
  }

  // ── Drag-and-drop ────────────────────────────────────────────────────────────
  async function onDragEnd(result: DropResult) {
    const { source, destination, draggableId } = result
    if (!destination) return
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) return

    const novoEstagio = destination.droppableId as Estagio
    const cardMovido  = cards.find(c => c.id === draggableId)
    if (!cardMovido) return

    // Optimistic update
    setCards(prev =>
      prev.map(c =>
        c.id === draggableId
          ? { ...c, estagio: novoEstagio, posicao: destination.index }
          : c
      )
    )

    // Persistir no banco
    await supabase
      .from("kanban_cards")
      .update({ estagio: novoEstagio, posicao: destination.index })
      .eq("id", draggableId)
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted text-sm">Carregando pipeline...</p>
      </div>
    )
  }

  return (
    <div>
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-primary">Kanban</h1>
          <p className="text-muted text-sm mt-0.5">
            {cards.length} lead(s) no pipeline
          </p>
        </div>
        <Button onClick={() => openModal("lead")}>
          <Plus size={16} className="mr-1.5" /> Novo Lead
        </Button>
      </div>

      {/* Board ──────────────────────────────────────────────────────────────── */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div
          className="flex gap-3 overflow-x-auto pb-6"
          style={{ minHeight: "calc(100vh - 220px)" }}
        >
          {ESTAGIOS.map(({ id, label, color }) => {
            const colCards = cardsByEstagio(id)
            return (
              <div
                key={id}
                className="flex-shrink-0 flex flex-col rounded-lg border border-border"
                style={{ width: 252, backgroundColor: "var(--color-background)" }}
              >
                {/* Cabeçalho da coluna */}
                <div
                  className="flex items-center justify-between px-3 py-2.5"
                  style={{ borderBottom: `2px solid ${color}` }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-sm font-semibold text-text">{label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-muted bg-border px-1.5 py-0.5 rounded-full">
                      {colCards.length}
                    </span>
                    <button
                      onClick={() => openModal(id)}
                      className="text-muted hover:text-text transition-colors"
                      title={`Novo card em ${label}`}
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>

                {/* Cards */}
                <Droppable droppableId={id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="flex-1 p-2 space-y-2 transition-colors rounded-b-lg"
                      style={{
                        minHeight: 100,
                        backgroundColor: snapshot.isDraggingOver
                          ? `${color}12`
                          : undefined,
                      }}
                    >
                      {colCards.map((card, index) => (
                        <Draggable
                          key={card.id}
                          draggableId={card.id}
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className="bg-surface rounded-md border border-border p-3 select-none"
                              style={{
                                ...provided.draggableProps.style,
                                boxShadow: snapshot.isDragging
                                  ? "var(--shadow-lg)"
                                  : "var(--shadow-sm)",
                                borderColor: snapshot.isDragging
                                  ? color
                                  : undefined,
                              }}
                            >
                              <div className="flex items-start gap-2">
                                <div
                                  {...provided.dragHandleProps}
                                  className="text-muted hover:text-text transition-colors mt-0.5 cursor-grab active:cursor-grabbing shrink-0"
                                >
                                  <GripVertical size={13} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-text leading-snug truncate">
                                    {card.cliente_nome}
                                  </p>
                                  {card.cliente_whatsapp && (
                                    <p className="text-xs text-muted font-mono mt-0.5 truncate">
                                      {card.cliente_whatsapp}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-border">
                                <span
                                  className="text-xs font-medium px-1.5 py-0.5 rounded-full text-white"
                                  style={{ backgroundColor: color }}
                                >
                                  {label}
                                </span>
                                <span className="text-xs text-muted">
                                  {format(parseISO(card.created_at), "dd/MM", { locale: ptBR })}
                                </span>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}

                      {/* Empty state */}
                      {colCards.length === 0 && !snapshot.isDraggingOver && (
                        <div
                          className="border-2 border-dashed rounded-md p-3 text-center cursor-pointer transition-opacity hover:opacity-60"
                          style={{ borderColor: color, opacity: 0.35 }}
                          onClick={() => openModal(id)}
                        >
                          <p className="text-xs text-muted">Solte um card aqui</p>
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            )
          })}
        </div>
      </DragDropContext>

      {/* Modal novo lead */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Novo Lead"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Nome do cliente / lead"
            placeholder="Ex: João Silva"
            {...register("cliente_nome")}
            error={errors.cliente_nome?.message}
          />
          <Input
            label="WhatsApp (opcional)"
            placeholder="5511999999999"
            {...register("cliente_whatsapp")}
          />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text">Estágio</label>
            <select
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-surface text-text focus:outline-none focus:ring-2 focus:ring-accent transition-all"
              {...register("estagio")}
            >
              {ESTAGIOS.map(e => (
                <option key={e.id} value={e.id}>{e.label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Criando..." : "Criar lead"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModalOpen(false)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
