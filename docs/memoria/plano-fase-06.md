# INSTRUÇÕES PARA ATLAS — FASE 06: INBOX DE ATENDIMENTO

## Contexto
Fases 01-05 completas. Z-API configurada, tabelas atendimentos e mensagens existem no banco.
Next.js 16, Tailwind v4, componentes UI em src/components/ui/.
Supabase service role disponível em SUPABASE_SERVICE_ROLE_KEY.

## Objetivo
1. Habilitar Supabase Realtime nas tabelas atendimentos e mensagens
2. Webhook /api/webhook/zapi — recebe mensagens da Z-API e salva no banco
3. API /api/messages/send — envia mensagem via Z-API
4. Página /dashboard/inbox — inbox completo com conversa em tempo real
5. Sidebar: adicionar "Inbox"

---

## PASSO 1 — Habilitar Realtime no Supabase

Criar e executar `scripts/enable-realtime.mjs`:

```js
import pg from 'pg'
const { Client } = pg

const client = new Client({
  connectionString: 'postgresql://postgres:mJtjYJWf3M53fucE@db.ecovfdmqnwskqkbtaebb.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
})

await client.connect()

await client.query(`
  ALTER PUBLICATION supabase_realtime ADD TABLE mensagens;
`)
console.log('✅ Realtime habilitado: mensagens')

await client.query(`
  ALTER PUBLICATION supabase_realtime ADD TABLE atendimentos;
`)
console.log('✅ Realtime habilitado: atendimentos')

await client.end()
```

Executar com: `node scripts/enable-realtime.mjs`

---

## PASSO 2 — Webhook Z-API

Criar `src/app/api/webhook/zapi/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Ignorar mensagens enviadas pelo próprio número
    if (body.fromMe) return NextResponse.json({ ok: true })

    // Ignorar eventos que não são mensagens recebidas
    const messageText =
      body.text?.message ||
      body.image?.caption ||
      body.audio?.audioUrl ||
      body.document?.fileName ||
      "[mensagem não suportada]"

    if (!messageText) return NextResponse.json({ ok: true })

    // Extrair número limpo (remove @c.us, @g.us, etc)
    const rawPhone   = body.phone ?? ""
    const phone      = rawPhone.replace(/@.*/, "")
    const chatName   = body.senderName ?? body.chatName ?? phone
    const instanceId = body.instanceId ?? ""

    if (!phone) return NextResponse.json({ ok: true })

    // Identificar locadora pelo instanceId
    const { data: locadora } = await supabaseAdmin
      .from("locadoras")
      .select("id")
      .eq("zapi_instance", instanceId)
      .maybeSingle()

    if (!locadora) {
      console.warn("[WEBHOOK] Locadora não encontrada para instance:", instanceId)
      return NextResponse.json({ ok: true })
    }

    // Buscar ou criar atendimento
    const { data: existente } = await supabaseAdmin
      .from("atendimentos")
      .select("id, status")
      .eq("locadora_id", locadora.id)
      .eq("whatsapp_number", phone)
      .not("status", "eq", "resolvido")
      .maybeSingle()

    let atendimentoId: string

    if (existente) {
      atendimentoId = existente.id
      // Atualizar updated_at
      await supabaseAdmin
        .from("atendimentos")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", atendimentoId)
    } else {
      const { data: novo } = await supabaseAdmin
        .from("atendimentos")
        .insert({
          locadora_id:     locadora.id,
          whatsapp_number: phone,
          nome_contato:    chatName,
          status:          "espera",
        })
        .select("id")
        .single()

      atendimentoId = novo!.id
    }

    // Salvar mensagem
    await supabaseAdmin.from("mensagens").insert({
      atendimento_id: atendimentoId,
      tipo:           "entrada",
      conteudo:       messageText,
      remetente:      "cliente",
    })

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error("[WEBHOOK] Erro:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Z-API verifica o endpoint com GET
export async function GET() {
  return NextResponse.json({ status: "webhook ativo" })
}
```

---

## PASSO 3 — API de Envio de Mensagem

Criar `src/app/api/messages/send/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createClient as createClientSSR } from "@/lib/supabase/server"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClientSSR()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { atendimento_id, message } = await request.json()

    if (!atendimento_id || !message?.trim()) {
      return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 })
    }

    // Buscar dados do atendimento + locadora
    const { data: atendimento } = await supabaseAdmin
      .from("atendimentos")
      .select("whatsapp_number, locadora_id")
      .eq("id", atendimento_id)
      .single()

    if (!atendimento) return NextResponse.json({ error: "Atendimento não encontrado" }, { status: 404 })

    const { data: locadora } = await supabaseAdmin
      .from("locadoras")
      .select("zapi_token, zapi_instance")
      .eq("id", atendimento.locadora_id)
      .single()

    if (!locadora?.zapi_token || !locadora?.zapi_instance) {
      return NextResponse.json({ error: "Z-API não configurado" }, { status: 422 })
    }

    // Enviar via Z-API
    const zapiUrl = `https://api.z-api.io/instances/${locadora.zapi_instance}/token/${locadora.zapi_token}/send-text`
    const zapiRes = await fetch(zapiUrl, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "Client-Token": locadora.zapi_token },
      body:    JSON.stringify({ phone: atendimento.whatsapp_number, message }),
    })

    const zapiData = await zapiRes.json()

    // Salvar mensagem enviada no histórico
    await supabaseAdmin.from("mensagens").insert({
      atendimento_id,
      tipo:      "saida",
      conteudo:  message,
      remetente: "atendente",
    })

    return NextResponse.json({ ok: zapiRes.ok, zapi: zapiData })
  } catch (error: any) {
    console.error("[SEND] Erro:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

---

## PASSO 4 — Página do Inbox

Criar `src/app/dashboard/inbox/page.tsx`:

```tsx
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
  contratos: { id: string; veiculos: { placa: string; modelo: string } | null }[]
}

type TabType = "todos" | "espera" | "ativo" | "resolvido" | "grupos"

export default function InboxPage() {
  const { profile } = useProfile()
  const supabase    = createClient()
  const bottomRef   = useRef<HTMLDivElement>(null)

  const [tab,              setTab]              = useState<TabType>("todos")
  const [atendimentos,     setAtendimentos]     = useState<Atendimento[]>([])
  const [selected,         setSelected]         = useState<Atendimento | null>(null)
  const [mensagens,        setMensagens]        = useState<Mensagem[]>([])
  const [grupos,           setGrupos]           = useState<Grupo[]>([])
  const [texto,            setTexto]            = useState("")
  const [enviando,         setEnviando]         = useState(false)
  const [loadingMsgs,      setLoadingMsgs]      = useState(false)

  // ── Carregar atendimentos ──────────────────────────────────────────────────
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

  // ── Carregar grupos ────────────────────────────────────────────────────────
  async function loadGrupos() {
    const { data } = await supabase
      .from("clientes")
      .select("id, name, grupo_whatsapp_id, contratos(id, veiculos(placa, modelo))")
      .not("grupo_whatsapp_id", "is", null)
    setGrupos((data ?? []) as unknown as Grupo[])
  }

  // ── Carregar mensagens do atendimento selecionado ──────────────────────────
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
    loadGrupos()
  }, [tab])

  // ── Selecionar atendimento ─────────────────────────────────────────────────
  async function selectAtendimento(at: Atendimento) {
    setSelected(at)
    setMensagens([])
    await loadMensagens(at.id)
  }

  // ── Scroll automático para o final ────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [mensagens])

  // ── Realtime: novas mensagens ──────────────────────────────────────────────
  useEffect(() => {
    if (!selected) return

    const channel = supabase
      .channel(`mensagens-${selected.id}`)
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

  // ── Realtime: lista de atendimentos ───────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel("atendimentos-list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "atendimentos" },
        () => { loadAtendimentos() }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [tab])

  // ── Assumir atendimento ────────────────────────────────────────────────────
  async function assumir() {
    if (!selected || !profile) return
    await supabase
      .from("atendimentos")
      .update({ status: "ativo", atendente_id: profile.id })
      .eq("id", selected.id)
    setSelected(prev => prev ? { ...prev, status: "ativo" } : null)
    loadAtendimentos()
  }

  // ── Resolver atendimento ───────────────────────────────────────────────────
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

  // ── Enviar mensagem ────────────────────────────────────────────────────────
  async function enviarMensagem() {
    if (!texto.trim() || !selected || enviando) return
    setEnviando(true)
    const textoEnviar = texto.trim()
    setTexto("")

    try {
      await fetch("/api/messages/send", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ atendimento_id: selected.id, message: textoEnviar }),
      })
    } catch {
      // Mensagem já foi salva no banco pelo route handler
    }
    setEnviando(false)
  }

  // ── Contadores das abas ────────────────────────────────────────────────────
  const count = (s: string) => atendimentos.filter(a => a.status === s).length
  const tabs: { id: TabType; label: string; badge?: number }[] = [
    { id: "todos",     label: "Todos",     badge: atendimentos.length },
    { id: "espera",    label: "Espera",    badge: count("espera") },
    { id: "ativo",     label: "Ativos",    badge: count("ativo") },
    { id: "resolvido", label: "Resolvidos" },
    { id: "grupos",    label: "Grupos",    badge: grupos.length },
  ]

  const listaFiltrada = tab === "grupos"
    ? []
    : atendimentos

  return (
    <div className="flex gap-4" style={{ height: "calc(100vh - 160px)" }}>

      {/* ── Painel esquerdo — lista ──────────────────────────────── */}
      <div className="w-72 flex-shrink-0 flex flex-col bg-surface rounded-lg border border-border overflow-hidden">

        {/* Abas */}
        <div className="flex border-b border-border overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setSelected(null); setMensagens([]) }}
              className={`flex-shrink-0 px-3 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors ${
                tab === t.id
                  ? "border-accent text-accent"
                  : "border-transparent text-muted hover:text-text"
              }`}
            >
              {t.label}
              {t.badge != null && t.badge > 0 && (
                <span className="ml-1.5 text-xs font-bold px-1.5 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: t.id === "espera" ? "var(--color-warning)" : "var(--color-muted)" }}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Lista de atendimentos */}
        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {tab === "grupos" ? (
            grupos.length === 0 ? (
              <div className="flex items-center justify-center h-24">
                <p className="text-xs text-muted text-center px-4">
                  Nenhum cliente com grupo vinculado.
                </p>
              </div>
            ) : grupos.map(g => (
              <div key={g.id} className="px-3 py-3">
                <div className="flex items-center gap-2 mb-0.5">
                  <Users size={12} className="text-muted shrink-0" />
                  <p className="text-xs font-semibold text-text truncate">{g.name}</p>
                </div>
                {g.contratos?.[0]?.veiculos && (
                  <p className="text-xs font-mono text-muted truncate ml-[20px]">
                    {g.contratos[0].veiculos.placa} · {g.contratos[0].veiculos.modelo}
                  </p>
                )}
                <p className="text-xs text-muted font-mono truncate ml-[20px] mt-0.5">
                  {g.grupo_whatsapp_id}
                </p>
              </div>
            ))
          ) : listaFiltrada.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-24 gap-2">
              <MessageCircle size={24} className="text-muted opacity-30" />
              <p className="text-xs text-muted">Nenhum atendimento</p>
            </div>
          ) : listaFiltrada.map(at => (
            <button
              key={at.id}
              onClick={() => selectAtendimento(at)}
              className={`w-full text-left px-3 py-3 hover:bg-background transition-colors ${
                selected?.id === at.id ? "bg-background" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-text truncate">
                    {at.nome_contato ?? at.whatsapp_number}
                  </p>
                  <p className="text-xs font-mono text-muted truncate mt-0.5">
                    {at.whatsapp_number}
                  </p>
                </div>
                <StatusBadge status={at.status} map={STATUS_MAP} />
              </div>
              <p className="text-xs text-muted mt-1.5">
                {format(parseISO(at.updated_at), "dd/MM HH:mm", { locale: ptBR })}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Painel direito — conversa ────────────────────────────── */}
      <div className="flex-1 flex flex-col bg-surface rounded-lg border border-border overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted">
            <MessageCircle size={40} className="opacity-20" />
            <p className="text-sm">Selecione uma conversa</p>
          </div>
        ) : (
          <>
            {/* Header da conversa */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background">
              <div>
                <p className="text-sm font-semibold text-text">
                  {selected.nome_contato ?? selected.whatsapp_number}
                </p>
                <p className="text-xs font-mono text-muted">{selected.whatsapp_number}</p>
              </div>
              <div className="flex items-center gap-2">
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
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {loadingMsgs ? (
                <p className="text-center text-sm text-muted">Carregando...</p>
              ) : mensagens.length === 0 ? (
                <p className="text-center text-sm text-muted">Sem mensagens ainda.</p>
              ) : mensagens.map(msg => {
                const isOutgoing = msg.tipo === "saida"
                return (
                  <div key={msg.id} className={`flex ${isOutgoing ? "justify-end" : "justify-start"}`}>
                    <div
                      className="max-w-[75%] rounded-lg px-3 py-2"
                      style={{
                        backgroundColor: isOutgoing
                          ? "var(--color-primary)"
                          : "var(--color-background)",
                        border: isOutgoing ? "none" : "1px solid var(--color-border)",
                      }}
                    >
                      {msg.remetente === "ia" && (
                        <p className="text-xs font-semibold mb-1" style={{ color: "var(--color-accent)" }}>
                          IA
                        </p>
                      )}
                      <p
                        className="text-sm whitespace-pre-wrap break-words"
                        style={{ color: isOutgoing ? "white" : "var(--color-text)" }}
                      >
                        {msg.conteudo}
                      </p>
                      <p
                        className="text-xs mt-1"
                        style={{ color: isOutgoing ? "rgba(255,255,255,0.6)" : "var(--color-muted)" }}
                      >
                        {format(parseISO(msg.created_at), "HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input de envio */}
            {selected.status !== "resolvido" && (
              <div className="flex items-center gap-2 px-4 py-3 border-t border-border">
                <input
                  value={texto}
                  onChange={e => setTexto(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), enviarMensagem())}
                  placeholder="Digite uma mensagem..."
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
```

---

## PASSO 5 — Adicionar Inbox à Sidebar

Editar `src/components/sidebar.tsx`:

**5.1 — Adicionar import:**
```tsx
  LayoutDashboard, Car, Users, FileText, CreditCard, LogOut, Columns3, Settings, MessageCircle,
```

**5.2 — Adicionar ao array NAV após Kanban:**
```tsx
  { href: "/dashboard/inbox",     label: "Inbox",        icon: MessageCircle,   roles: ["admin","atendente","comercial"] },
```

---

## PASSO 6 — Build, verificação e commit

```bash
npm run build

git add -A
git commit -m "feat(inbox): atendimento WhatsApp em tempo real com webhook e envio"
git push origin dev
```

---

## PASSO 7 — Instrução pós-deploy (para Kleber)

Após o push e deploy na Vercel, configure o webhook na Z-API:

1. Acesse o painel da Z-API
2. Vá em Webhooks → Received Delivery
3. Coloque a URL: `https://movacrm-three.vercel.app/api/webhook/zapi`
4. Salve e envie uma mensagem de teste para o número

---

## Critério de Aceitação da Fase 06

✅ `npm run build` sem erros
✅ `GET /api/webhook/zapi` retorna `{"status":"webhook ativo"}`
✅ `POST /api/webhook/zapi` com payload cria atendimento e mensagem no banco
✅ Inbox exibe abas: Todos, Espera, Ativos, Resolvidos, Grupos
✅ Selecionar atendimento exibe histórico de mensagens
✅ Botão "Assumir" muda status de espera para ativo
✅ Botão "Resolver" muda status para resolvido e fecha conversa
✅ Campo de envio com Enter funciona
✅ Push para origin/dev

## Em caso de erro
Parar e reportar ao Hades com output completo.

## ✅ RELATÓRIO OBRIGATÓRIO AO CONCLUIR
- STATUS: sucesso / erro
- STEPS EXECUTADOS
- OUTPUT DO BUILD
- ERROS ENCONTRADOS
