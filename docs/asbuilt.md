# MovaCRM — As Built (Fonte de Verdade)

**Descrição:** CRM para locadoras de veículos com atendimento via WhatsApp, IA de qualificação de leads (Claude) e gestão completa de frota, contratos e pagamentos. Implantado individualmente por empresa.
**Stack:** Next.js + Supabase + Vercel + Z-API + Claude API (Anthropic)
**Última atualização:** 2026-05-30

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
**Status:** `⏳ Aguardando`
**Progresso:** 0/6 tarefas (0%)

#### Tarefas:
- [ ] CRUD de Veículos (placa, modelo, ano, status)
- [ ] CRUD de Clientes (nome, CPF, WhatsApp, grupo WhatsApp)
- [ ] CRUD de Contratos (cliente + veículo + valor + vencimento)
- [ ] Gestão de Pagamentos (registrar, histórico por contrato)
- [ ] Painel de inadimplência (contratos atrasados)
- [ ] Permissões por perfil nos módulos (admin, atendente, financeiro, comercial)

**Testável:** Sim — Cadastrar veículo, criar cliente, gerar contrato, registrar pagamento
**Notas:** —
**Último trabalho:** —

---

### 🔵 FASE 03: DASHBOARD
**Status:** `⏳ Aguardando`
**Progresso:** 0/4 tarefas (0%)

#### Tarefas:
- [ ] Cards de frota (total, disponíveis, alugados, em manutenção)
- [ ] Cards de contratos vencendo nos próximos 7 dias
- [ ] Cards de inadimplência (contratos atrasados)
- [ ] Card de receita do mês (soma dos pagamentos recebidos)

**Testável:** Sim — Dashboard exibe dados reais do banco
**Notas:** —
**Último trabalho:** —

---

### 🔵 FASE 04: KANBAN COMERCIAL
**Status:** `⏳ Aguardando`
**Progresso:** 0/4 tarefas (0%)

#### Tarefas:
- [ ] Board Kanban com 6 colunas (Lead → Qualificação → Proposta → Negociação → Fechado → Renovação)
- [ ] Cards com nome do cliente, responsável e data
- [ ] Drag-and-drop entre colunas
- [ ] Perfis com acesso ao Kanban: admin, atendente, comercial

**Testável:** Sim — Criar card, mover entre colunas, visualizar por perfil
**Notas:** Kanban é separado dos Contratos — não há vinculação automática
**Último trabalho:** —

---

### 🔵 FASE 05: WHATSAPP — DISPAROS AUTOMÁTICOS
**Status:** `⏳ Aguardando`
**Progresso:** 0/4 tarefas (0%)

#### Tarefas:
- [ ] Configuração Z-API por instância (token + número no painel admin)
- [ ] Cron job diário (Vercel Cron) — verifica contratos vencendo em X dias
- [ ] Disparo de mensagem privada para o cliente
- [ ] Disparo de mensagem no grupo do contrato

**Testável:** Sim — Configurar Z-API, simular contrato vencendo, confirmar mensagem recebida
**Notas:** Cada locadora tem seu próprio número Z-API conectado
**Último trabalho:** —

---

### 🔵 FASE 06: INBOX DE ATENDIMENTO
**Status:** `⏳ Aguardando`
**Progresso:** 0/5 tarefas (0%)

#### Tarefas:
- [ ] Webhook Z-API para receber mensagens no sistema
- [ ] Interface de Inbox (abas: todos, espera, ativos, resolvidos)
- [ ] Visualização de conversa em tempo real dentro do CRM
- [ ] Atendente assume conversa (muda status de "espera" para "ativo")
- [ ] Aba Grupos (grupos WhatsApp vinculados — um por contrato)

**Testável:** Sim — Enviar mensagem para o número, aparecer no inbox, atendente assumir
**Notas:** Todo atendimento acontece dentro do CRM, não no WhatsApp pessoal
**Último trabalho:** —

---

### 🔵 FASE 07: IA DE ATENDIMENTO (CLAUDE)
**Status:** `⏳ Aguardando`
**Progresso:** 0/5 tarefas (0%)

#### Tarefas:
- [ ] Integração Claude API (Anthropic) — configurar client + prompt base
- [ ] Fluxo automático: nova mensagem → IA responde com boas-vindas + coleta dados
- [ ] Script padrão de coleta (nome, interesse, prazo de locação, CNH)
- [ ] Ao qualificar lead: criar card automaticamente no Kanban (coluna "Lead")
- [ ] Handoff para atendente: IA sinaliza que conversa está pronta para humano

**Testável:** Sim — Cliente envia mensagem, IA responde, card aparece no Kanban
**Notas:** Script padrão fixo na v1. Configuração por empresa fica no SHOULD HAVE.
**Último trabalho:** —

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
**Status:** `⏳ Aguardando`
**Progresso:** 0/4 tarefas (0%)

#### Tarefas:
- [ ] QA completo com Ravena (todas as rotas, permissões, formulários, responsividade)
- [ ] Auditoria de segurança com Kerberos (OWASP, RLS, secrets, SQL injection)
- [ ] Merge hml → main com aprovação de Kleber
- [ ] Deploy em produção + checklist final

**Testável:** Sim — Sistema completo funcionando em produção
**Notas:** Nenhum merge para main sem Ravena + Kerberos aprovarem
**Último trabalho:** —

---

## Backups e Segurança

| Data | Tag | Tipo | Status |
|------|-----|------|--------|
| — | — | — | — |

## Histórico de Sessões

| Data | O que foi feito |
|------|----------------|
| 2026-05-30 | Especificação completa com Shiva. Roadmap criado pelo Hades. Fase 01 aguardando Atlas. |
| 2026-05-31 | Fase 08 completa — API de usuários (GET/POST/PATCH/DELETE), página de configurações com 3 abas (Locadora, Usuários, WhatsApp). Build OK. Push origin/dev. |
