import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { addDays, format } from "date-fns"
import { ptBR } from "date-fns/locale"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DIAS_ANTES = 3

export async function GET(request: NextRequest) {
  const authHeader    = request.headers.get("authorization")
  const isVercelCron  = request.headers.get("x-vercel-cron") === "1"
  const isManual      = authHeader === `Bearer ${process.env.CRON_SECRET}`

  if (!isVercelCron && !isManual) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const hoje      = new Date()
  const limite    = addDays(hoje, DIAS_ANTES)
  const hojeISO   = hoje.toISOString().split("T")[0]
  const limiteISO = limite.toISOString().split("T")[0]
  const resumo    = { enviados: 0, erros: 0, locadoras: 0 }

  try {
    const { data: locadoras } = await supabaseAdmin
      .from("locadoras")
      .select("id, name, zapi_token, zapi_instance")
      .not("zapi_token", "is", null)
      .not("zapi_instance", "is", null)

    if (!locadoras?.length) {
      return NextResponse.json({
        message: "Nenhuma locadora com Z-API configurado.",
        resumo,
      })
    }

    for (const locadora of locadoras) {
      resumo.locadoras++

      const { data: contratos } = await supabaseAdmin
        .from("contratos")
        .select(`
          id,
          data_vencimento,
          valor_mensal,
          clientes (name, whatsapp, grupo_whatsapp_id),
          veiculos  (placa, modelo)
        `)
        .eq("locadora_id", locadora.id)
        .eq("status", "ativo")
        .gte("data_vencimento", hojeISO)
        .lte("data_vencimento", limiteISO)

      if (!contratos?.length) continue

      for (const contrato of contratos as any[]) {
        const cliente = contrato.clientes
        const veiculo = contrato.veiculos

        if (!cliente.grupo_whatsapp_id) continue

        const vencimento    = new Date(contrato.data_vencimento)
        const diasRestantes = Math.ceil(
          (vencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)
        )
        const dataFormatada = format(vencimento, "dd/MM/yyyy", { locale: ptBR })

        const msgGrupo = [
          `📋 *Aviso de Vencimento*`,
          ``,
          `Olá, *${cliente.name}*! 👋`,
          `Seu contrato de locação está próximo do vencimento:`,
          ``,
          `🚗 Veículo: *${veiculo.modelo}* (Placa: ${veiculo.placa})`,
          `📅 Vencimento: *${dataFormatada}* (em ${diasRestantes} dia${diasRestantes > 1 ? "s" : ""})`,
          `💰 Valor mensal: R$ ${Number(contrato.valor_mensal).toFixed(2)}`,
          ``,
          `Entre em contato para renovação ou maiores informações.`,
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

    return NextResponse.json({
      message:      "Cron executado com sucesso.",
      resumo,
      executado_em: new Date().toISOString(),
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
    const url = `https://api.z-api.io/instances/${instance}/token/${token}/send-text`
    const res = await fetch(url, {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": token,
      },
      body: JSON.stringify({ phone, message }),
    })
    return { ok: res.ok }
  } catch {
    return { ok: false }
  }
}
