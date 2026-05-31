"use client"
import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { useProfile } from "@/hooks/use-profile"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import { MessageCircle, Send, UserCheck, CheckCheck, Users } from "lucide-react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"

const STATUS_MAP = {
  espera:    { label: "Espera",    color: "var(--color-warning)" },
  ativo:     { label: "Ativo",     color: "var(--color-success)" },
  resolvido: { label: "Resolvido", color: "var(--color-muted)"   },
}

type Atendimento = {
  id: string
  whatsapp_number: string
  nome_contato: string | null
  status: "espera" | "ativo" | "resolvido"
  updated_at: string
}

type Mensagem = {
  id: string
  tipo: "entrada" | "saida"
  conteudo: string
  remetente: "cliente" | "ia" | "atendente"
  created_at: string
}

type Grupo = {
  id: string
  name: string
  grupo_whatsapp_id: string
  contratos: Array<{
    id: string
    veiculos: { placa: string; modelo: string } | null
  }>
}

type TabType = "todos" | "espera" | "ativo" | "resolvido" | "grupos"

export default function InboxPage() {
  const { profile } = useProfile()
  const supabase    = createClient()
  const bottomRef   = useRef<HTMLDivElement>(null)

  const [tab,          setTab]          = useState<TabType>("todos")
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([])
  const [selected,     setSelected]     = useState<Atendimento | null>(null)
  const [mensagens,    setMensagens]    = useState<Mensagem[]>([])
  const [grupos,       setGrupos]       = useState<Grupo[]>([])
  const [texto,        setTexto]        = useState("")
  const [enviando,     setEnviando]     = useState(false)
  const [loadingMsgs,  setLoadingMsgs]  = useState(false)

  // ── Carregar atendimentos ────────────────────────────────────────────────
  async function loadAtendimentos() {
    let query = supabase
      .from("atendimentos")
      .select("*")
      .order("updated_at", { ascending: false })

    if (tab !== "todos" && tab !== "grupos") {
      query = query.eq("status", tab)
    }

    const { data } = await query
    setAtendimentos((data ?? []) as Atendimento[])
  }

  // ── Carregar grupos ──────────────────────────────────────────────────────
  async function loadGrupos() {
    const { data } = await supabase
      .from("clientes")
      .select("id, name, grupo_whatsapp_id, contratos(id, veiculos(placa, modelo))")
      .not("grupo_whatsapp_id", "is", null)
    setGrupos((data ?? []) as unknown as Grupo[])
  }

  // ── Carregar mensagens ───────────────────────────────────────────────────
  async function loadMensagens(atendimentoId: string) {
    setLoadingMsgs(true)
    const { data } = await supabase
      .from("mensagens")
      .select("*")
      .eq("atendimento_id", atendimentoId)
      .order("created_at")
    setMensagens((data ?? []) as Mensagem[])
    setLoadingMsgs(false)
  }

  useEffect(() => {
    loadAtendimentos()
    if (tab === "grupos") loadGrupos()
  }, [tab])

  // ── Selecionar conversa ──────────────────────────────────────────────────
  async function selectAtendimento(at: Atendimento) {
    setSelected(at)
    setMensagens([])
    await loadMensagens(at.id)
  }

  // ── Scroll automático ────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [mensagens])

  // ── Realtime: novas mensagens ────────────────────────────────────────────
  useEffect(() => {
    if (!selected) return

    const channel = supabase
      .channel(`msgs-${selected.id}`)
      .on(
        "postgres_changes",
        {
          event:  "INSERT",
          schema: "public",
          table:  "mensagens",
          filter: `atendimento_id=eq.${selected.id}`,
        },
        (payload) => {
          setMensagens(prev => [...prev, payload.new as Mensagem])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [selected?.id])

  // ── Realtime: lista de atendimentos ─────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel("atend-list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "atendimentos" },
        () => loadAtendimentos()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [tab])

  // ── Assumir atendimento ──────────────────────────────────────────────────
  async function assumir() {
    if (!selected || !profile) return
    await supabase
      .from("atendimentos")
      .update({ status: "ativo", atendente_id: profile.id })
      .eq("id", selected.id)
    setSelected(prev => prev ? { ...prev, status: "ativo" } : null)
    loadAtendimentos()
  }

  // ── Resolver atendimento ─────────────────────────────────────────────────
  async function resolver() {
    if (!selected) return
    await supabase
      .from("atendimentos")
      .update({ status: "resolvido" })
      .eq("id", selected.id)
    setSelected(null)
    setMensagens([])
    loadAtendimentos()
  }

  // ── Enviar mensagem ──────────────────────────────────────────────────────
  async function enviarMensagem() {
    if (!texto.trim() || !selected || enviando) return
    setEnviando(true)
    const textoEnviar = texto.trim()
    setTexto("")

    await fetch("/api/messages/send", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        atendimento_id: selected.id,
        message:        textoEnviar,
      }),
    })
    setEnviando(false)
  }

  // ── Contadores ───────────────────────────────────────────────────────────
  const count = (s: string) => atendimentos.filter(a => a.status === s).length

  const TABS: { id: TabType; label: string; badge?: number }[] = [
    { id: "todos",     label: "Todos",     badge: atendimentos.length },
    { id: "espera",    label: "Espera",    badge: count("espera")     },
    { id: "ativo",     label: "Ativos",    badge: count("ativo")      },
    { id: "resolvido", label: "Resolvidos"                             },
    { id: "grupos",    label: "Grupos",    badge: grupos.length        },
  ]

  const listagem = tab === "grupos" ? [] : atendimentos

  return (
    <div className="flex gap-4" style={{ height: "calc(100vh - 160px)" }}>

      {/* ── Lista de conversas ─────────────────────────────────── */}
      <div className="w-72 flex-shrink-0 flex flex-col bg-surface rounded-lg border border-border overflow-hidden">

        {/* Abas */}
        <div className="flex border-b border-border shrink-0">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id)
                setSelected(null)
                setMensagens([])
              }}
              className={`flex-1 px-1.5 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                tab === t.id
                  ? "border-accent text-accent"
                  : "border-transparent text-muted hover:text-text"
              }`}
            >
              {t.label}
              {t.badge != null && t.badge > 0 && (
                <span
                  className="ml-1 text-xs font-bold px-1 py-0.5 rounded-full text-white"
                  style={{
                    backgroundColor:
                      t.id === "espera"
                        ? "var(--color-warning)"
                        : "var(--color-muted)",
                    fontSize: "10px",
                  }}
                >
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Conteúdo da lista */}
        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {tab === "grupos" ? (
            grupos.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-24 gap-2 p-4">
                <Users size={20} className="text-muted opacity-30" />
                <p className="text-xs text-muted text-center">
                  Nenhum cliente com grupo vinculado
                </p>
              </div>
            ) : grupos.map(g => (
              <div key={g.id} className="px-3 py-3">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Users size={11} className="text-muted shrink-0" />
                  <p className="text-xs font-semibold text-text truncate">{g.name}</p>
                </div>
                {g.contratos?.[0]?.veiculos && (
                  <p className="text-xs font-mono text-muted truncate pl-4">
                    {g.contratos[0].veiculos.placa} · {g.contratos[0].veiculos.modelo}
                  </p>
                )}
                <p className="text-xs text-muted font-mono truncate pl-4 mt-0.5 opacity-60">
                  {g.grupo_whatsapp_id}
                </p>
              </div>
            ))
          ) : listagem.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-24 gap-2">
              <MessageCircle size={22} className="text-muted opacity-20" />
              <p className="text-xs text-muted">Nenhum atendimento</p>
            </div>
          ) : listagem.map(at => (
            <button
              key={at.id}
              onClick={() => selectAtendimento(at)}
              className={`w-full text-left px-3 py-3 transition-colors hover:bg-background ${
                selected?.id === at.id ? "bg-background" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-text truncate">
                    {at.nome_contato ?? at.whatsapp_number}
                  </p>
                  <p className="text-xs font-mono text-muted truncate">
                    {at.whatsapp_number}
                  </p>
                </div>
                <StatusBadge status={at.status} map={STATUS_MAP} />
              </div>
              <p className="text-xs text-muted">
                {format(parseISO(at.updated_at), "dd/MM HH:mm", { locale: ptBR })}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Painel de conversa ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col bg-surface rounded-lg border border-border overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted">
            <MessageCircle size={40} className="opacity-20" />
            <p className="text-sm">Selecione uma conversa</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background shrink-0">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text truncate">
                  {selected.nome_contato ?? selected.whatsapp_number}
                </p>
                <p className="text-xs font-mono text-muted">{selected.whatsapp_number}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                <StatusBadge status={selected.status} map={STATUS_MAP} />
                {selected.status === "espera" && (
                  <Button size="sm" onClick={assumir}>
                    <UserCheck size={13} className="mr-1" /> Assumir
                  </Button>
                )}
                {selected.status === "ativo" && (
                  <Button size="sm" variant="secondary" onClick={resolver}>
                    <CheckCheck size={13} className="mr-1" /> Resolver
                  </Button>
                )}
              </div>
            </div>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5">
              {loadingMsgs ? (
                <p className="text-center text-sm text-muted py-8">Carregando...</p>
              ) : mensagens.length === 0 ? (
                <p className="text-center text-sm text-muted py-8">Sem mensagens ainda.</p>
              ) : mensagens.map(msg => {
                const isOut = msg.tipo === "saida"
                return (
                  <div key={msg.id} className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
                    <div
                      className="max-w-[75%] rounded-lg px-3 py-2 break-words"
                      style={{
                        backgroundColor: isOut
                          ? "var(--color-primary)"
                          : "var(--color-background)",
                        border: isOut ? "none" : "1px solid var(--color-border)",
                      }}
                    >
                      {msg.remetente === "ia" && (
                        <p
                          className="text-xs font-semibold mb-1"
                          style={{ color: "var(--color-accent)" }}
                        >
                          IA
                        </p>
                      )}
                      <p
                        className="text-sm whitespace-pre-wrap"
                        style={{ color: isOut ? "white" : "var(--color-text)" }}
                      >
                        {msg.conteudo}
                      </p>
                      <p
                        className="text-xs mt-1 text-right"
                        style={{
                          color: isOut
                            ? "rgba(255,255,255,0.55)"
                            : "var(--color-muted)",
                        }}
                      >
                        {format(parseISO(msg.created_at), "HH:mm")}
                      </p>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input de envio */}
            {selected.status !== "resolvido" && (
              <div className="flex items-center gap-2 px-3 py-3 border-t border-border shrink-0">
                <input
                  value={texto}
                  onChange={e => setTexto(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      enviarMensagem()
                    }
                  }}
                  placeholder="Digite uma mensagem... (Enter para enviar)"
                  className="flex-1 border border-border rounded-md px-3 py-2 text-sm bg-background text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
                  disabled={enviando}
                />
                <Button
                  onClick={enviarMensagem}
                  disabled={!texto.trim() || enviando}
                  size="sm"
                >
                  <Send size={14} />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
