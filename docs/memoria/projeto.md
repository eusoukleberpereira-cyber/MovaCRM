# MovaCRM — Constituição do Projeto

## Visão
Sistema de gestão completo para locadoras de veículos, com atendimento via WhatsApp integrado e IA para primeiro contato com leads. Implantado individualmente para cada empresa cliente com cobrança por implementação + mensalidade de suporte.

## Público-alvo
Locadoras de veículos de pequeno e médio porte (referência: frotas de ~150 veículos). Múltiplos usuários por empresa com perfis distintos de acesso.

## Problema Resolvido
Locadoras gerenciam frota, contratos e clientes em planilhas ou sistemas genéricos, perdem prazos de vencimento e fazem cobranças manualmente pelo WhatsApp. O MovaCRM centraliza tudo e automatiza os pontos críticos.

## Modelo de Negócio
- Implementação: cobrança única por implantação
- Suporte: mensalidade recorrente
- Cada locadora tem sua própria instância (não é SaaS multi-tenant)

---

## Perfis de Acesso

| Perfil | Descrição |
|--------|-----------|
| Admin | Acesso total ao sistema |
| Atendente | Kanban, Clientes, Inbox de atendimento |
| Financeiro | Pagamentos, Contratos, Relatórios |
| Comercial | Kanban, Clientes, Propostas |

### Permissões por módulo

| Módulo | Admin | Atendente | Financeiro | Comercial |
|--------|-------|-----------|------------|-----------|
| Dashboard | ✅ | ✅ | ✅ | ✅ |
| Veículos | ✅ | ver | ver | ver |
| Clientes | ✅ | ✅ | ver | ✅ |
| Contratos | ✅ | ver | ✅ | ver |
| Pagamentos | ✅ | ❌ | ✅ | ❌ |
| Kanban | ✅ | ✅ | ❌ | ✅ |
| Atendimento/Inbox | ✅ | ✅ | ❌ | ✅ |
| WhatsApp/Z-API | ✅ | ❌ | ❌ | ❌ |
| Relatórios | ✅ | ❌ | ✅ | ❌ |
| Configurações | ✅ | ❌ | ❌ | ❌ |

---

## Estrutura de Páginas

```
1.  LOGIN & AUTENTICAÇÃO
2.  DASHBOARD (métricas: frota, vencimentos, inadimplência, receita)
3.  VEÍCULOS (lista, cadastro, status: disponível/alugado/manutenção)
4.  CLIENTES (lista, cadastro, histórico de contratos)
5.  CONTRATOS (criar, vincular cliente+veículo, valor, vencimento)
6.  PAGAMENTOS (registrar, histórico, painel de inadimplência)
7.  KANBAN (Lead → Qualificação → Proposta → Negociação → Fechado → Renovação)
8.  ATENDIMENTO/INBOX
    ├─ Todos os atendimentos
    ├─ Em espera (IA atendendo)
    ├─ Ativos (atendente humano)
    ├─ Resolvidos
    └─ Grupos (grupos WhatsApp — um por contrato)
9.  CONFIGURAÇÕES
    ├─ Dados da locadora (nome, logo)
    ├─ Gestão de usuários e permissões
    └─ Configuração Z-API (token + número WhatsApp)
```

---

## Entidades de Dados

### Veículo
- Placa, modelo, ano
- Status: disponível | alugado | manutenção

### Cliente
- Nome, CPF, WhatsApp
- Grupo do WhatsApp vinculado

### Contrato
- Cliente + Veículo vinculados
- Data de vencimento, valor mensal
- Status: ativo | encerrado

### Pagamento
- Contrato vinculado
- Data, valor, status (pago | pendente | atrasado)

### Atendimento
- Canal: WhatsApp
- Status: espera | ativo | resolvido
- Histórico de mensagens
- Vinculação ao Kanban (lead)

### Card Kanban
- Estágios: Lead → Qualificação → Proposta → Negociação → Fechado → Renovação
- Cliente vinculado (quando existir)
- Responsável (usuário)

---

## Fluxo da IA de Atendimento

```
1. Cliente envia mensagem no WhatsApp da locadora
2. Z-API recebe e envia para o sistema
3. IA Claude responde automaticamente (boas-vindas + coleta de dados)
4. Dados coletados conforme script padrão da empresa
5. Lead qualificado → card criado automaticamente no Kanban (coluna "Lead")
6. Atendente humano assume a conversa dentro do Inbox do CRM
```

## Fluxo de Disparos Automáticos

```
Cron job diário verifica contratos próximos do vencimento
→ Envia mensagem privada para o cliente (WhatsApp)
→ Envia mensagem no grupo do contrato
```

---

## Integrações

| Serviço | Uso |
|---------|-----|
| Z-API | Envio e recebimento de mensagens WhatsApp |
| Claude (Anthropic) | IA de atendimento e qualificação de leads |
| Supabase | Banco de dados PostgreSQL + Auth |

---

## Stack Definida

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js (App Router) |
| Backend | Next.js API Routes + Supabase |
| Banco de dados | Supabase (PostgreSQL) |
| Autenticação | Supabase Auth |
| Deploy | Vercel |
| Versionamento | GitHub |
| WhatsApp | Z-API |
| IA | Claude API (Anthropic) |
| Cron Jobs | Vercel Cron |
