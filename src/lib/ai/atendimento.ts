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
  // Montar histórico no formato do Claude (sem a nova mensagem — já está no historico)
  const messages: Anthropic.MessageParam[] = []

  for (const msg of historico) {
    const role = msg.tipo === "entrada" ? "user" : "assistant"
    const last = messages[messages.length - 1]
    if (last && last.role === role) {
      // Concatenar mensagens consecutivas do mesmo role
      if (typeof last.content === "string") {
        last.content += "\n" + msg.conteudo
      }
    } else {
      messages.push({ role, content: msg.conteudo })
    }
  }

  // Garantir que começa com "user"
  if (!messages.length || messages[0].role !== "user") {
    messages.unshift({ role: "user", content: novaMensagem })
  }

  // Garantir que termina com "user" (última msg do cliente)
  if (messages[messages.length - 1].role === "assistant") {
    messages.push({ role: "user", content: novaMensagem })
  }

  const response = await anthropic.messages.create({
    model:      "claude-haiku-4-5-20251001",
    max_tokens: 350,
    system:     SYSTEM_PROMPT,
    messages,
  })

  const fullText = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map(b => b.text)
    .join("")

  // Detectar marcador de lead qualificado
  const qualMatch = fullText.match(
    /\[LEAD_QUALIFICADO:\s*nome="([^"]+)",\s*interesse="([^"]+)",\s*cnh=(SIM|NAO)\]/i
  )

  // Remover marcador da mensagem visível
  const message = fullText
    .replace(/\[LEAD_QUALIFICADO:[^\]]+\]/gi, "")
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
