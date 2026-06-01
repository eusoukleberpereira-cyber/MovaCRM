import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DIAS_SEMANA = ["Domingo","Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado"]

export async function GET(request: NextRequest) {
  const authHeader   = request.headers.get("authorization")
  const isVercelCron = request.headers.get("x-vercel-cron") === "1"
  const isManual     = authHeader === `Bearer ${process.env.CRON_SECRET}`

  if (!isVercelCron && !isManual) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Dia de hoje em Brasília (UTC-3)
  const agora        = new Date()
  const brasilia     = new Date(agora.getTime() - 3 * 60 * 60 * 1000)
  const diaSemanaHoje = brasilia.getDay() // 0=Dom … 6=Sab
  const nomeDia      = DIAS_SEMANA[diaSemanaHoje]
  const resumo       = { enviados: 0, erros: 0, locadoras: 0 }

  try {
    const { data: locadoras } = await supabaseAdmin
      .from("locadoras")
      .select("id, name, zapi_token, zapi_instance")
      .not("zapi_token",    "is", null)
      .not("zapi_instance", "is", null)

    if (!locadoras?.length) {
      return NextResponse.json({ message: "Nenhuma locadora com Z-API configurado.", resumo })
    }

    for (const locadora of locadoras) {
      resumo.locadoras++

      const { data: contratos } = await supabaseAdmin
        .from("contratos")
        .select(`
          id,
          valor_mensal,
          dia_semana,
          clientes (name, whatsapp, grupo_whatsapp_id),
          veiculos  (placa, modelo)
        `)
        .eq("locadora_id", locadora.id)
        .eq("status",      "ativo")
        .eq("dia_semana",  diaSemanaHoje)

      if (!contratos?.length) continue

      for (const contrato of contratos as any[]) {
        const cliente = contrato.clientes
        const veiculo = contrato.veiculos
        const valor   = Number(contrato.valor_mensal).toLocaleString("pt-BR", { minimumFractionDigits: 2 })

        // ── Mensagem privada ─────────────────────────────────────────────
        const msgPrivada = [
          `Olá, *${cliente.name}*! 👋`,
          ``,
          `Seu pagamento de *R$ ${valor}* vence *HOJE* (${nomeDia}).`,
          ``,
          `🚗 Veículo: *${veiculo.modelo}* (Placa: ${veiculo.placa})`,
          ``,
          `Qualquer dúvida é só falar! 🙏`,
        ].join("\n")

        const resPrivado = await enviarZAPI(
          locadora.zapi_instance,
          locadora.zapi_token,
          cliente.whatsapp,
          msgPrivada
        )

        await supabaseAdmin.from("disparos").insert({
          locadora_id: locadora.id,
          contrato_id: contrato.id,
          tipo:        "vencimento_privado",
          status:      resPrivado.ok ? "enviado" : "erro",
          mensagem:    msgPrivada,
        })

        resPrivado.ok ? resumo.enviados++ : resumo.erros++

        // ── Mensagem no grupo ────────────────────────────────────────────
        if (cliente.grupo_whatsapp_id) {
          const msgGrupo = [
            `📋 *Aviso de Pagamento*`,
            ``,
            `Olá, *${cliente.name}*! 👋`,
            `Seu pagamento de *R$ ${valor}* vence *HOJE* (${nomeDia}).`,
            ``,
            `🚗 Veículo: *${veiculo.modelo}* (Placa: ${veiculo.placa})`,
            ``,
            `Obrigado! 🙏`,
          ].join("\n")

          const resGrupo = await enviarZAPI(
            locadora.zapi_instance,
            locadora.zapi_token,
            cliente.grupo_whatsapp_id,
            msgGrupo
          )

          await supabaseAdmin.from("disparos").insert({
            locadora_id: locadora.id,
            contrato_id: contrato.id,
            tipo:        "vencimento_grupo",
            status:      resGrupo.ok ? "enviado" : "erro",
            mensagem:    msgGrupo,
          })

          resGrupo.ok ? resumo.enviados++ : resumo.erros++
        }
      }
    }

    return NextResponse.json({
      message:      `Cron executado — ${nomeDia}.`,
      dia:          nomeDia,
      resumo,
      executado_em: agora.toISOString(),
    })
  } catch (error: any) {
    console.error("[CRON] Erro:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function enviarZAPI(
  instance: string,
  token: string,
  phone: string,
  message: string
): Promise<{ ok: boolean }> {
  try {
    const res = await fetch(
      `https://api.z-api.io/instances/${instance}/token/${token}/send-text`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json", "Client-Token": token },
        body:    JSON.stringify({ phone, message }),
      }
    )
    return { ok: res.ok }
  } catch {
    return { ok: false }
  }
}
