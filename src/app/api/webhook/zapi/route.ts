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

    // Ignorar mensagens enviadas pelo próprio número
    if (body.fromMe) return NextResponse.json({ ok: true })

    // Extrair conteúdo da mensagem
    const messageText =
      body.text?.message ||
      body.image?.caption ||
      body.audio?.audioUrl ||
      body.document?.fileName ||
      null

    if (!messageText) return NextResponse.json({ ok: true })

    // Extrair número e metadados
    const rawPhone   = body.phone ?? ""
    const phone      = rawPhone.replace(/@.*/, "")
    const chatName   = body.senderName ?? body.chatName ?? phone
    const instanceId = body.instanceId ?? ""

    if (!phone) return NextResponse.json({ ok: true })

    // Buscar locadora pelo instanceId (inclui credenciais Z-API)
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

    let atendimentoId: string
    let atendStatus:   string
    let jaTemKanban:   boolean

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

    // ── IA responde apenas quando atendimento está em "espera" e lead ainda não qualificado ──
    if (atendStatus === "espera" && !jaTemKanban && process.env.ANTHROPIC_API_KEY) {
      try {
        // Buscar histórico completo para contexto
        const { data: historico } = await supabaseAdmin
          .from("mensagens")
          .select("tipo, conteudo, remetente")
          .eq("atendimento_id", atendimentoId)
          .order("created_at")

        const result = await processarMensagem(
          (historico ?? []) as any[],
          messageText
        )

        if (result.message) {
          // Salvar resposta da IA no histórico
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
        }

        // ── Lead qualificado: criar card no Kanban ────────────────────────
        if (result.qualified && !jaTemKanban) {
          const nome = result.leadData?.nome || chatName

          const { data: card } = await supabaseAdmin
            .from("kanban_cards")
            .insert({
              locadora_id:      locadora.id,
              estagio:          "lead",
              cliente_nome:     nome,
              cliente_whatsapp: phone,
              posicao:          0,
            })
            .select("id")
            .single()

          if (card) {
            await supabaseAdmin
              .from("atendimentos")
              .update({
                kanban_card_id: card.id,
                nome_contato:   nome,
              })
              .eq("id", atendimentoId)

            console.log("[WEBHOOK] Lead qualificado → kanban_card criado:", card.id)
          }
        }
      } catch (aiErr: any) {
        // IA falhou — webhook continua funcionando normalmente
        console.error("[WEBHOOK] IA erro:", aiErr.message)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error("[WEBHOOK] Erro geral:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Z-API verifica o endpoint com GET ao configurar webhook
export async function GET() {
  return NextResponse.json({ status: "webhook ativo", service: "MovaCRM" })
}
