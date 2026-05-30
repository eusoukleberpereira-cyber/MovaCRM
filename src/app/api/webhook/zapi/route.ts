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

    // Extrair conteúdo da mensagem
    const messageText =
      body.text?.message ||
      body.image?.caption ||
      body.audio?.audioUrl ||
      body.document?.fileName ||
      null

    if (!messageText) return NextResponse.json({ ok: true })

    // Extrair número limpo (remove @c.us, @g.us, etc)
    const rawPhone   = body.phone ?? ""
    const phone      = rawPhone.replace(/@.*/, "")
    const chatName   = body.senderName ?? body.chatName ?? phone
    const instanceId = body.instanceId ?? ""

    if (!phone) return NextResponse.json({ ok: true })

    // Identificar locadora pelo instanceId da Z-API
    const { data: locadora } = await supabaseAdmin
      .from("locadoras")
      .select("id")
      .eq("zapi_instance", instanceId)
      .maybeSingle()

    if (!locadora) {
      console.warn("[WEBHOOK] Locadora não encontrada para instance:", instanceId)
      return NextResponse.json({ ok: true })
    }

    // Buscar atendimento aberto para este número
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

    // Salvar mensagem no histórico
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

// Z-API verifica o endpoint com GET ao configurar
export async function GET() {
  return NextResponse.json({ status: "webhook ativo", service: "MovaCRM" })
}
