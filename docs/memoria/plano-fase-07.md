# INSTRUÇÕES PARA ATLAS — FASE 07: IA DE ATENDIMENTO (CLAUDE)

## Contexto
Fase 06 completa. Webhook /api/webhook/zapi já salva mensagens e cria atendimentos.
Tabelas: atendimentos (status: espera/ativo/resolvido), mensagens, kanban_cards.
ANTHROPIC_API_KEY deve estar em .env.local antes de executar esta fase.

## Objetivo
1. Instalar @anthropic-ai/sdk
2. Criar src/lib/ai/atendimento.ts — serviço que chama Claude e detecta lead qualificado
3. Reescrever webhook para chamar IA automaticamente quando status é "espera"
4. Quando qualificado: criar card no Kanban + vincular ao atendimento
5. Adicionar ANTHROPIC_API_KEY na Vercel

## Fluxo implementado
```
Cliente envia mensagem no WhatsApp
    ↓ webhook POST /api/webhook/zapi
Salva mensagem (remetente: cliente)
    ↓ se atendimento.status === "espera"
Busca histórico de mensagens
    ↓
Claude processa (system prompt + histórico + nova msg)
    ↓
Salva resposta (remetente: ia)
Envia via Z-API
    ↓ se resposta contém [LEAD_QUALIFICADO]
Cria kanban_card na coluna "lead"
Vincula atendimento.kanban_card_id
```

---

## PASSO 1 — Verificar ANTHROPIC_API_KEY no .env.local

Verificar se a variável está preenchida:
```bash
node -e "require('dotenv').config({path:'.env.local'}); console.log(process.env.ANTHROPIC_API_KEY ? '✅ KEY OK' : '❌ KEY AUSENTE')"
```

Se ausente: PARAR e reportar ao Hades. Não prosseguir sem a chave.

---

## PASSO 2 — Instalar @anthropic-ai/sdk

```bash
npm install @anthropic-ai/sdk
```

Verificar: `node -e "require('@anthropic-ai/sdk')" && echo "OK"`

---

## PASSO 3 — Criar serviço de IA

Criar `src/lib/ai/atendimento.ts`:

```ts
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const SYSTEM_PROMPT = `Você é um assistente virtual de uma locadora de veículos.
Seu objetivo é fazer o primeiro atendimento de clientes que entram em contato pelo WhatsApp.

MISSÃO:
1. Cumprimentar o cliente de forma calorosa e profissional
2. Coletar as seguintes informações (uma por mensagem, de forma natural):
   - Nome completo
   - Tipo de veículo de interesse (carro, SUV, pickup, etc.)
   - Período de locação desejado
   - Se possui CNH válida
3. Quando tiver TODAS as informações, avisar que um atendente humano vai continuar

REGRAS:
- Responda SEMPRE em português brasileiro
- Seja amigável mas objetivo — máximo 3 linhas por mensagem
- Use linguagem simples, sem jargão técnico
- Use formatação WhatsApp: *negrito* para destaque
- NÃO invente informações sobre preços ou disponibilidade
- Colete UMA informação por vez, de forma conversacional

QUANDO TIVER TODAS AS INFORMAÇÕES:
Envie a mensagem de encerramento E inclua exatamente no final (na última linha):
[LEAD_QUALIFICADO: nome="NOME", interesse="INTERESSE", cnh=SIM/NAO]

Exemplo de encerramento:
"Perfeito, [Nome]! Já tenho tudo que preciso. Um de nossos atendentes vai entrar em contato em breve para finalizar o processo. 😊
[LEAD_QUALIFICADO: nome="João Silva", interesse="SUV por 2 meses", cnh=SIM]"`

export type AIResult = {
  message:   string
  qualified: boolean
  leadData?: {
    nome:      string
    interesse: string
    cnh:       string
  }
}

type HistoricoMsg = {
  tipo:      "entrada" | "saida"
  conteudo:  string
  remetente: string
}

export async function processarMensagem(
  historico: HistoricoMsg[],
  novaMensagem: string
): Promise<AIResult> {
  // Montar histórico no formato do Claude
  const messages: Anthropic.MessageParam[] = []

  for (const msg of historico) {
    const role = msg.tipo === "entrada" ? "user" : "assistant"
    // Combinar mensagens consecutivas do mesmo role
    const last = messages[messages.length - 1]
    if (last && last.role === role) {
      last.content += "\n" + msg.conteudo
    } else {
      messages.push({ role, content: msg.conteudo })
    }
  }

  // Adicionar nova mensagem do cliente
  const lastMsg = messages[messages.length - 1]
  if (lastMsg?.role === "user") {
    lastMsg.content += "\n" + novaMensagem
  } else {
    messages.push({ role: "user", content: novaMensagem })
  }

  // Garantir que começa com "user"
  if (messages[0]?.role !== "user") {
    messages.unshift({ role: "user", content: novaMensagem })
  }

  const response = await anthropic.messages.create({
    model:      "claude-haiku-4-5-20251001",
    max_tokens: 300,
    system:     SYSTEM_PROMPT,
    messages,
  })

  const fullText = response.content
    .filter(b => b.type === "text")
    .map(b => b.text)
    .join("")

  // Detectar lead qualificado
  const qualMatch = fullText.match(
    /\[LEAD_QUALIFICADO:\s*nome="([^"]+)",\s*interesse="([^"]+)",\s*cnh=(SIM|NAO)\]/i
  )

  // Mensagem limpa (sem o marcador)
  const message = fullText
    .replace(/\[LEAD_QUALIFICADO:[^\]]+\]/i, "")
    .trim()

  if (qualMatch) {
    return {
      message,
      qualified: true,
      leadData: {
        nome:      qualMatch[1],
        interesse: qualMatch[2],
        cnh:       qualMatch[3],
      },
    }
  }

  return { message, qualified: false }
}
```

---

## PASSO 4 — Reescrever Webhook com IA integrada

Substituir TODO o conteúdo de `src/app/api/webhook/zapi/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { processarMensagem } from "@/lib/ai/atendimento"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (body.fromMe) return NextResponse.json({ ok: true })

    const messageText =
      body.text?.message ||
      body.image?.caption ||
      body.audio?.audioUrl ||
      body.document?.fileName ||
      null

    if (!messageText) return NextResponse.json({ ok: true })

    const rawPhone   = body.phone ?? ""
    const phone      = rawPhone.replace(/@.*/, "")
    const chatName   = body.senderName ?? body.chatName ?? phone
    const instanceId = body.instanceId ?? ""

    if (!phone) return NextResponse.json({ ok: true })

    // Buscar locadora pelo instanceId
    const { data: locadora } = await supabaseAdmin
      .from("locadoras")
      .select("id, zapi_token, zapi_instance")
      .eq("zapi_instance", instanceId)
      .maybeSingle()

    if (!locadora) {
      console.warn("[WEBHOOK] Locadora não encontrada:", instanceId)
      return NextResponse.json({ ok: true })
    }

    // Buscar ou criar atendimento
    const { data: existente } = await supabaseAdmin
      .from("atendimentos")
      .select("id, status, kanban_card_id")
      .eq("locadora_id", locadora.id)
      .eq("whatsapp_number", phone)
      .not("status", "eq", "resolvido")
      .maybeSingle()

    let atendimentoId:  string
    let atendStatus:    string
    let jaTemKanban:    boolean

    if (existente) {
      atendimentoId = existente.id
      atendStatus   = existente.status
      jaTemKanban   = !!existente.kanban_card_id
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
      atendStatus   = "espera"
      jaTemKanban   = false
    }

    // Salvar mensagem do cliente
    await supabaseAdmin.from("mensagens").insert({
      atendimento_id: atendimentoId,
      tipo:           "entrada",
      conteudo:       messageText,
      remetente:      "cliente",
    })

    // ── IA responde apenas quando atendimento está em "espera" ────────────────
    if (atendStatus === "espera" && process.env.ANTHROPIC_API_KEY) {
      try {
        // Buscar histórico completo
        const { data: historico } = await supabaseAdmin
          .from("mensagens")
          .select("tipo, conteudo, remetente")
          .eq("atendimento_id", atendimentoId)
          .order("created_at")

        const result = await processarMensagem(
          (historico ?? []) as any[],
          messageText
        )

        // Salvar resposta da IA
        await supabaseAdmin.from("mensagens").insert({
          atendimento_id: atendimentoId,
          tipo:           "saida",
          conteudo:       result.message,
          remetente:      "ia",
        })

        // Enviar via Z-API
        if (locadora.zapi_token && locadora.zapi_instance) {
          await fetch(
            `https://api.z-api.io/instances/${locadora.zapi_instance}/token/${locadora.zapi_token}/send-text`,
            {
              method:  "POST",
              headers: {
                "Content-Type": "application/json",
                "Client-Token": locadora.zapi_token,
              },
              body: JSON.stringify({ phone, message: result.message }),
            }
          ).catch(err => console.error("[WEBHOOK] Z-API send err:", err))
        }

        // ── Lead qualificado: criar card no Kanban ──────────────────────────
        if (result.qualified && !jaTemKanban && result.leadData) {
          const { data: card } = await supabaseAdmin
            .from("kanban_cards")
            .insert({
              locadora_id:     locadora.id,
              estagio:         "lead",
              cliente_nome:    result.leadData.nome || chatName,
              cliente_whatsapp: phone,
              posicao:         0,
            })
            .select("id")
            .single()

          if (card) {
            await supabaseAdmin
              .from("atendimentos")
              .update({ kanban_card_id: card.id })
              .eq("id", atendimentoId)
          }
        }
      } catch (aiErr: any) {
        console.error("[WEBHOOK] IA erro:", aiErr.message)
        // Não bloqueia — webhook retorna ok mesmo se IA falhar
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error("[WEBHOOK] Erro:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: "webhook ativo", service: "MovaCRM" })
}
```

---

## PASSO 5 — Adicionar ANTHROPIC_API_KEY na Vercel

```bash
echo "SUA_ANTHROPIC_KEY" | npx vercel env add ANTHROPIC_API_KEY production \
  --token $VERCEL_TOKEN --scope kleber-pereiras-projects --yes
```

Substituir $VERCEL_TOKEN pelo token salvo no vault ou pedir ao Kleber.

---

## PASSO 6 — Build, verificação e commit

```bash
npm run build

git add -A
git commit -m "feat(ia): Claude responde automaticamente e qualifica leads no Kanban"
git push origin dev
```

---

## Critério de Aceitação da Fase 07

✅ `npm run build` sem erros
✅ Webhook recebe mensagem → Claude responde → mensagem salva com remetente "ia"
✅ Resposta da IA aparece no Inbox com label "IA"
✅ Após coletar todos os dados → card criado no Kanban na coluna "Lead"
✅ Atendimento vinculado ao kanban_card_id
✅ Se ANTHROPIC_API_KEY ausente → webhook funciona normalmente (sem IA)
✅ Push para origin/dev

## Em caso de erro
Parar e reportar ao Hades com output completo.

## ✅ RELATÓRIO OBRIGATÓRIO
- STATUS: sucesso / erro
- STEPS EXECUTADOS
- OUTPUT DO BUILD
- ERROS ENCONTRADOS
