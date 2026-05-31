import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createClient as createClientSSR } from "@/lib/supabase/server"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const supabase = await createClientSSR()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { atendimento_id, message } = await request.json()

    if (!atendimento_id || !message?.trim()) {
      return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 })
    }

    // Buscar dados do atendimento
    const { data: atendimento } = await supabaseAdmin
      .from("atendimentos")
      .select("whatsapp_number, locadora_id")
      .eq("id", atendimento_id)
      .single()

    if (!atendimento) {
      return NextResponse.json({ error: "Atendimento não encontrado" }, { status: 404 })
    }

    // Buscar configuração Z-API da locadora
    const { data: locadora } = await supabaseAdmin
      .from("locadoras")
      .select("zapi_token, zapi_instance")
      .eq("id", atendimento.locadora_id)
      .single()

    // Salvar mensagem no histórico (sempre, mesmo sem Z-API)
    await supabaseAdmin.from("mensagens").insert({
      atendimento_id,
      tipo:      "saida",
      conteudo:  message.trim(),
      remetente: "atendente",
    })

    // Enviar via Z-API se configurado
    if (locadora?.zapi_token && locadora?.zapi_instance) {
      const zapiUrl = `https://api.z-api.io/instances/${locadora.zapi_instance}/token/${locadora.zapi_token}/send-text`
      await fetch(zapiUrl, {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          "Client-Token": locadora.zapi_token,
        },
        body: JSON.stringify({
          phone:   atendimento.whatsapp_number,
          message: message.trim(),
        }),
      }).catch(err => console.error("[SEND] Z-API erro:", err))
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error("[SEND] Erro:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
