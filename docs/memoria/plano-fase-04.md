# INSTRUÇÕES PARA ATLAS — FASE 04: KANBAN COMERCIAL

## Contexto
Fases 01-03 completas. Sistema no ar com módulos CRUD e Dashboard.
Next.js 16, Tailwind v4, design tokens, componentes UI em src/components/ui/.
Tabela `kanban_cards` já existe no banco com: id, locadora_id, estagio, cliente_nome,
cliente_whatsapp, responsavel_id, posicao, created_at, updated_at.

## Objetivo
1. Instalar @hello-pangea/dnd para drag-and-drop
2. Adicionar "Kanban" à sidebar (roles: admin, atendente, comercial)
3. Criar /dashboard/kanban/page.tsx com 6 colunas e drag-and-drop

## Pré-condições
- [ ] `git checkout dev && git pull origin dev`
- [ ] `npm run dev` sem erros

---

## PASSO 1 — Instalar dependência

```bash
npm install @hello-pangea/dnd
npm install --save-dev @types/hello-pangea__dnd
```

Resultado esperado: instalado sem erros críticos.

---

## PASSO 2 — Adicionar Kanban à Sidebar

Editar `src/components/sidebar.tsx`:

**2.1 — Adicionar import do ícone Kanban:**
Trocar a linha de imports de ícones por:
```tsx
import {
  LayoutDashboard, Car, Users, FileText, CreditCard, LogOut, Columns3,
} from "lucide-react"
```

**2.2 — Adicionar entrada no array NAV após "Contratos":**
```tsx
{ href: "/dashboard/kanban",    label: "Kanban",     icon: Columns3,        roles: ["admin","atendente","comercial"] },
```

Array NAV completo após edição:
```tsx
const NAV = [
  { href: "/dashboard",           label: "Dashboard",  icon: LayoutDashboard, roles: ["admin","atendente","financeiro","comercial"] },
  { href: "/dashboard/veiculos",  label: "Veículos",   icon: Car,             roles: ["admin","atendente","financeiro","comercial"] },
  { href: "/dashboard/clientes",  label: "Clientes",   icon: Users,           roles: ["admin","atendente","financeiro","comercial"] },
  { href: "/dashboard/contratos", label: "Contratos",  icon: FileText,        roles: ["admin","atendente","financeiro","comercial"] },
  { href: "/dashboard/kanban",    label: "Kanban",     icon: Columns3,        roles: ["admin","atendente","comercial"] },
  { href: "/dashboard/pagamentos",label: "Pagamentos", icon: CreditCard,      roles: ["admin","financeiro"] },
]
```

---

## PASSO 3 — Criar página do Kanban

Criar `src/app/dashboard/kanban/page.tsx` com o conteúdo abaixo:

```tsx
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

// ─── Configuração das colunas ─────────────────────────────────────────────────
const ESTAGIOS = [
  { id: "lead",        label: "Lead",        color: "var(--color-kanban-lead)"       },
  { id: "qualificacao",label: "Qualificação", color: "var(--color-kanban-qualif)"     },
  { id: "proposta",    label: "Proposta",     color: "var(--color-kanban-proposta)"   },
  { id: "negociacao",  label: "Negociação",   color: "var(--color-kanban-negociacao)" },
  { id: "fechado",     label: "Fechado",      color: "var(--color-kanban-fechado)"    },
  { id: "renovacao",   label: "Renovação",    color: "var(--color-kanban-renovacao)"  },
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

// ─── Schema do formulário ─────────────────────────────────────────────────────
const schema = z.object({
  cliente_nome:     z.string().min(2, "Nome obrigatório"),
  cliente_whatsapp: z.string().optional(),
  estagio:          z.enum(["lead","qualificacao","proposta","negociacao","fechado","renovacao"]),
})
type FormData = z.infer<typeof schema>

// ─── Componente principal ─────────────────────────────────────────────────────
export default function KanbanPage() {
  const { profile }  = useProfile()
  const supabase     = createClient()
  const [cards,      setCards]      = useState<KanbanCard[]>([])
  const [loading,    setLoading]    = useState(true)
  const [modalOpen,  setModalOpen]  = useState(false)
  const [defaultEstagio, setDefaultEstagio] = useState<Estagio>("lead")

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { estagio: "lead" },
  })

  // ── Carregar cards ──────────────────────────────────────────────────────────
  async function load() {
    const { data } = await supabase
      .from("kanban_cards")
      .select("*")
      .order("posicao")
    setCards((data ?? []) as KanbanCard[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // ── Cards por estágio ───────────────────────────────────────────────────────
  function cardsByEstagio(estagio: Estagio) {
    return cards
      .filter(c => c.estagio === estagio)
      .sort((a, b) => a.posicao - b.posicao)
  }

  // ── Abrir modal com estágio pré-selecionado ─────────────────────────────────
  function openModal(estagio: Estagio = "lead") {
    setDefaultEstagio(estagio)
    reset({ cliente_nome: "", cliente_whatsapp: "", estagio })
    setModalOpen(true)
  }

  // ── Criar card ──────────────────────────────────────────────────────────────
  async function onSubmit(data: FormData) {
    const cardsNoEstagio = cardsByEstagio(data.estagio)
    const posicao = cardsNoEstagio.length

    await supabase.from("kanban_cards").insert({
      ...data,
      locadora_id:   profile!.locadora_id,
      responsavel_id: profile!.id,
      posicao,
    })
    setModalOpen(false)
    load()
  }

  // ── Drag-and-drop ───────────────────────────────────────────────────────────
  async function onDragEnd(result: DropResult) {
    const { source, destination, draggableId } = result
    if (!destination) return
    if (source.droppableId === destination.droppableId && source.index === destination.index) return

    const novoEstagio = destination.droppableId as Estagio
    const cardMovido  = cards.find(c => c.id === draggableId)
    if (!cardMovido) return

    // Atualizar localmente (optimistic update)
    const newCards = cards.map(c =>
      c.id === draggableId
        ? { ...c, estagio: novoEstagio, posicao: destination.index }
        : c
    )
    setCards(newCards)

    // Persistir no banco
    await supabase
      .from("kanban_cards")
      .update({ estagio: novoEstagio, posicao: destination.index })
      .eq("id", draggableId)

    // Reordenar posições dos outros cards na coluna destino
    const cardsDestino = newCards
      .filter(c => c.estagio === novoEstagio && c.id !== draggableId)
      .sort((a, b) => a.posicao - b.posicao)

    for (let i = 0; i < cardsDestino.length; i++) {
      const novaPosicao = i >= destination.index ? i + 1 : i
      if (cardsDestino[i].posicao !== novaPosicao) {
        await supabase
          .from("kanban_cards")
          .update({ posicao: novaPosicao })
          .eq("id", cardsDestino[i].id)
      }
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted">Carregando Kanban...</p>
      </div>
    )
  }

  const totalCards = cards.length

  return (
    <div className="h-full">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-primary">Kanban</h1>
          <p className="text-muted text-sm mt-0.5">
            {totalCards} lead(s) no pipeline
          </p>
        </div>
        <Button onClick={() => openModal("lead")}>
          <Plus size={16} className="mr-1.5" /> Novo Lead
        </Button>
      </div>

      {/* Board */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: "calc(100vh - 200px)" }}>
          {ESTAGIOS.map(({ id, label, color }) => {
            const colCards = cardsByEstagio(id)
            return (
              <div
                key={id}
                className="flex-shrink-0 flex flex-col rounded-lg"
                style={{ width: 260, backgroundColor: "var(--color-background)" }}
              >
                {/* Cabeçalho da coluna */}
                <div className="flex items-center justify-between px-3 py-2.5 rounded-t-lg"
                     style={{ borderBottom: `3px solid ${color}` }}>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
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
                      className="text-muted hover:text-text transition-colors p-0.5"
                      title={`Adicionar em ${label}`}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                {/* Cards da coluna */}
                <Droppable droppableId={id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="flex-1 p-2 space-y-2 rounded-b-lg transition-colors"
                      style={{
                        minHeight: 80,
                        backgroundColor: snapshot.isDraggingOver
                          ? `${color}10`
                          : undefined,
                      }}
                    >
                      {colCards.map((card, index) => (
                        <Draggable key={card.id} draggableId={card.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className="bg-surface rounded-lg border border-border p-3 select-none"
                              style={{
                                ...provided.draggableProps.style,
                                boxShadow: snapshot.isDragging
                                  ? "var(--shadow-lg)"
                                  : "var(--shadow-sm)",
                                opacity: snapshot.isDragging ? 0.95 : 1,
                                borderColor: snapshot.isDragging ? color : undefined,
                              }}
                            >
                              {/* Grip + Nome */}
                              <div className="flex items-start gap-2">
                                <div
                                  {...provided.dragHandleProps}
                                  className="text-muted hover:text-text transition-colors mt-0.5 cursor-grab active:cursor-grabbing"
                                >
                                  <GripVertical size={14} />
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

                              {/* Footer do card */}
                              <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-border">
                                <span
                                  className="text-xs font-medium px-1.5 py-0.5 rounded-full text-white"
                                  style={{ backgroundColor: color, opacity: 0.85 }}
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

                      {/* Empty state da coluna */}
                      {colCards.length === 0 && !snapshot.isDraggingOver && (
                        <div
                          className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-opacity-60 transition-colors"
                          style={{ borderColor: color, opacity: 0.4 }}
                          onClick={() => openModal(id)}
                        >
                          <p className="text-xs text-muted">Arraste um card aqui</p>
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

      {/* Modal novo card */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Novo Lead">
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
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-surface text-text focus:outline-none focus:ring-2 focus:ring-accent"
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
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
```

---

## PASSO 4 — Build, verificação critic e commit

```bash
# Build
npm run build

# Verificar secrets
git add -A
git diff --cached | grep -E "(SERVICE_ROLE|PASSWORD)" | head -5

# Commit
git commit -m "feat(kanban): pipeline comercial com drag-and-drop e 6 estagios"
git push origin dev
```

---

## Critério de Aceitação da Fase 04

✅ `npm run build` sem erros
✅ Sidebar exibe "Kanban" para admin, atendente e comercial (não para financeiro)
✅ Board com 6 colunas visíveis e coloridas
✅ Botão "Novo Lead" abre modal com campos nome + WhatsApp + estágio
✅ Card criado aparece na coluna correta
✅ Drag-and-drop move card entre colunas
✅ Push para origin/dev

## Em caso de erro
Parar e reportar ao Hades com output completo.

## ✅ RELATÓRIO OBRIGATÓRIO AO CONCLUIR
- STATUS: sucesso / erro
- STEPS EXECUTADOS
- OUTPUT DO BUILD
- ERROS ENCONTRADOS
