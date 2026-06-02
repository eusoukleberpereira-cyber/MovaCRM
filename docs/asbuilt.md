# MovaCRM — As Built (Fonte de Verdade)

**Descrição:** CRM para locadoras de veículos com atendimento via WhatsApp, IA de qualificação de leads (Claude) e gestão completa de frota, contratos e pagamentos. Implantado individualmente por empresa.
**Stack:** Next.js + Supabase + Vercel + Z-API + Claude API (Anthropic)
**Última atualização:** 2026-05-31

---

## Roadmap de Implementação

### 🔵 FASE 01: FUNDAÇÃO
**Status:** `✅ Completa`
**Progresso:** 7/7 tarefas (100%)

#### Tarefas:
- [x] Setup projeto Next.js 16 (App Router + TypeScript + Tailwind v4)
- [x] Configurar repositório GitHub com GitFlow (dev, hml, main)
- [x] Criar projeto Supabase + configurar variáveis de ambiente
- [x] Conectar Vercel ao repositório (deploy automático via main)
- [x] Aplicar design tokens e fontes (Bricolage Grotesque + Plus Jakarta Sans)
- [x] Implementar autenticação com Supabase Auth (login por email/senha)
- [x] Criar database schema completo + RLS (10 tabelas, todos com RLS ON)

**Testável:** Login funcional em https://movacrm-three.vercel.app
**Notas:** Next.js 16 usa `proxy.ts` em vez de `middleware.ts`. Token GitHub no vault (~/.shark/vaults/movacrm/github_token.vault). Token Vercel no vault (~/.shark/vaults/movacrm/vercel_token.vault). URL produção: https://movacrm-three.vercel.app
**Último trabalho:** 2026-05-30 — Deploy produção bem-sucedido — dpl_CEb9FNrXGBk6ghDyFysumRhhbRMB

---

### 🔵 FASE 02: FROTA, CLIENTES & CONTRATOS
**Status:** `✅ Completa`
**Progresso:** 6/6 tarefas (100%)

#### Tarefas:
- [x] CRUD de Veículos (placa, modelo, ano, status)
- [x] CRUD de Clientes (nome, CPF, WhatsApp, grupo WhatsApp)
- [x] CRUD de Contratos (cliente + veículo + valor + vencimento)
- [x] Gestão de Pagamentos (registrar, histórico por contrato)
- [x] Painel de inadimplência (contratos atrasados)
- [x] Permissões por perfil nos módulos (admin, atendente, financeiro, comercial)

**Testável:** Sim — Cadastrar veículo, criar cliente, gerar contrato, registrar pagamento
**Notas:** Páginas implementadas: /dashboard/veiculos, /dashboard/clientes, /dashboard/contratos, /dashboard/pagamentos
**Último trabalho:** 2026-05-31 — Confirmado via estrutura de arquivos src/app/dashboard/

---

### 🔵 FASE 03: DASHBOARD
**Status:** `✅ Completa`
**Progresso:** 4/4 tarefas (100%)

#### Tarefas:
- [x] Cards de frota (total, disponíveis, alugados, em manutenção)
- [x] Cards de contratos vencendo nos próximos 7 dias
- [x] Cards de inadimplência (contratos atrasados)
- [x] Card de receita do mês (soma dos pagamentos recebidos)

**Testável:** Sim — Dashboard exibe dados reais do banco
**Notas:** Página implementada: /dashboard
**Último trabalho:** 2026-05-31 — Confirmado via estrutura de arquivos src/app/dashboard/

---

### 🔵 FASE 04: KANBAN COMERCIAL
**Status:** `✅ Completa`
**Progresso:** 4/4 tarefas (100%)

#### Tarefas:
- [x] Board Kanban com 6 colunas (Lead → Qualificação → Proposta → Negociação → Fechado → Renovação)
- [x] Cards com nome do cliente, responsável e data
- [x] Drag-and-drop entre colunas
- [x] Perfis com acesso ao Kanban: admin, atendente, comercial

**Testável:** Sim — Criar card, mover entre colunas, visualizar por perfil
**Notas:** Kanban é separado dos Contratos — não há vinculação automática. Página: /dashboard/kanban
**Último trabalho:** 2026-05-31 — Confirmado via estrutura de arquivos src/app/dashboard/

---

### 🔵 FASE 05: WHATSAPP — DISPAROS AUTOMÁTICOS
**Status:** `✅ Completa`
**Progresso:** 4/4 tarefas (100%)

#### Tarefas:
- [x] Configuração Z-API por instância (token + número no painel admin)
- [x] Cron job diário (Vercel Cron) — verifica contratos vencendo em X dias
- [x] Disparo de mensagem privada para o cliente
- [x] Disparo de mensagem no grupo do contrato

**Testável:** Sim — Configurar Z-API, simular contrato vencendo, confirmar mensagem recebida
**Notas:** Cada locadora tem seu próprio número Z-API conectado. API: /api/cron/disparos
**Último trabalho:** 2026-05-31 — Confirmado via estrutura de arquivos src/app/api/

---

### 🔵 FASE 06: INBOX DE ATENDIMENTO
**Status:** `✅ Completa`
**Progresso:** 5/5 tarefas (100%)

#### Tarefas:
- [x] Webhook Z-API para receber mensagens no sistema
- [x] Interface de Inbox (abas: todos, espera, ativos, resolvidos)
- [x] Visualização de conversa em tempo real dentro do CRM
- [x] Atendente assume conversa (muda status de "espera" para "ativo")
- [x] Aba Grupos (grupos WhatsApp vinculados — um por contrato)

**Testável:** Sim — Enviar mensagem para o número, aparecer no inbox, atendente assumir
**Notas:** Todo atendimento acontece dentro do CRM. API: /api/webhook/zapi, /api/messages/send. Página: /dashboard/inbox
**Último trabalho:** 2026-05-31 — Confirmado via estrutura de arquivos src/app/

---

### 🔵 FASE 07: IA DE ATENDIMENTO (CLAUDE)
**Status:** `✅ Completa`
**Progresso:** 5/5 tarefas (100%)

#### Tarefas:
- [x] Integração Claude API (Anthropic) — configurar client + prompt base
- [x] Fluxo automático: nova mensagem → IA responde com boas-vindas + coleta dados
- [x] Script padrão de coleta (nome, interesse, prazo de locação, CNH)
- [x] Ao qualificar lead: criar card automaticamente no Kanban (coluna "Lead")
- [x] Handoff para atendente: IA sinaliza que conversa está pronta para humano

**Testável:** Sim — Cliente envia mensagem, IA responde, card aparece no Kanban
**Notas:** Script padrão fixo na v1. Lib: src/lib/ai/atendimento.ts
**Último trabalho:** 2026-05-31 — Confirmado via estrutura de arquivos src/lib/ai/

---

### 🔵 FASE 08: CONFIGURAÇÕES & GESTÃO DE USUÁRIOS
**Status:** `✅ Completa`
**Progresso:** 3/3 tarefas (100%)

#### Tarefas:
- [x] Tela de configurações da locadora (nome, logo)
- [x] Gestão de usuários (criar, editar, desativar) com atribuição de perfil
- [x] Página de configuração Z-API integrada às configurações

**Testável:** Sim — Admin cria usuário, usuário loga com perfil correto
**Notas:** API /api/users usa service role. Senha temporária gerada: `MovaCRM@{ano}!`. Admin não consegue remover a própria conta.
**Último trabalho:** 2026-05-31 — Commit a640d4e — feat(settings): gestão de usuários, dados da locadora e configurações em abas

---

### 🔵 FASE 09: PRODUÇÃO
**Status:** `✅ Completa`
**Progresso:** 4/4 tarefas (100%)

#### Tarefas:
- [x] QA completo com Ravena (todas as rotas, permissões, formulários, responsividade)
- [x] Auditoria de segurança com Kerberos (OWASP, RLS, secrets, SQL injection)
- [x] Merge hml → main com aprovação de Kleber
- [x] Deploy em produção + checklist final

**Testável:** Sim — Sistema completo funcionando em produção
**Notas:** Veredicto Ravena: APROVADO. Veredicto Kerberos: APROVADO. 3 fixes de segurança aplicados (cron trigger, webhook secret, CSP). Ação pendente: configurar ZAPI_WEBHOOK_SECRET na Vercel + atualizar URL do webhook na Z-API.
**Último trabalho:** 2026-06-02 — merge(hml->main) fa94f75 — deploy automático Vercel ativado

---

## Backups e Segurança

| Data | Tag | Tipo | Status |
|------|-----|------|--------|
| 2026-06-02 | backup-pre-main-20260602-1653 | Pré-Main (Produção) | ✅ |

## Histórico de Sessões

| Data | O que foi feito |
|------|----------------|
| 2026-05-30 | Especificação completa com Shiva. Roadmap criado pelo Hades. Fase 01 aguardando Atlas. |
| 2026-05-31 | Fase 08 completa — API de usuários (GET/POST/PATCH/DELETE), página de configurações com 3 abas (Locadora, Usuários, WhatsApp). Build OK. Push origin/dev. |
| 2026-05-31 | Fase 09 iniciada — asbuilt sincronizado: fases 02-07 marcadas como completas (implementação confirmada via estrutura de arquivos). |
| 2026-06-02 | Disparos alterados para grupos apenas (sem mensagem privada). Lógica semanal por dia_semana restaurada. Fix 406 Configurações. QA Ravena: APROVADO. Auditoria Kerberos: APROVADO (3 fixes: cron trigger, webhook secret, CSP). Merge hml→main. Deploy produção fa94f75. |
