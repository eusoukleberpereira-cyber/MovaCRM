# INSTRUÇÕES PARA ATLAS — FASE 09: PRODUÇÃO

## Contexto
Fases 01-08 implementadas. O asbuilt.md está desatualizado (fases 02-07 existem no código mas não estão marcadas como completas).
Esta fase consolida tudo: atualiza a documentação, cria backup, merge dev→hml, chama Ravena para QA, Kerberos para segurança, e finaliza com merge hml→main.

## Objetivo
1. Atualizar asbuilt.md para refletir o estado real
2. Backup + merge dev → hml
3. QA com Ravena (rotas, permissões, formulários, responsividade)
4. Auditoria com Kerberos (OWASP, RLS, secrets, SQL injection)
5. Corrigir issues encontrados
6. Merge hml → main + confirmar deploy em produção

---

## PASSO 1 — Atualizar asbuilt.md

Atualizar todas as fases de 02 a 07 como completas no `docs/asbuilt.md`.

Substituir cada bloco de fase com status correto:

### Fase 02 — FROTA, CLIENTES & CONTRATOS
```
**Status:** `✅ Completa`
**Progresso:** 6/6 tarefas (100%)
Tarefas: todas [x]
**Último trabalho:** 2026-05-31 — Implementação confirmada via estrutura de arquivos
```

### Fase 03 — DASHBOARD
```
**Status:** `✅ Completa`
**Progresso:** 4/4 tarefas (100%)
Tarefas: todas [x]
**Último trabalho:** 2026-05-31 — Implementação confirmada via estrutura de arquivos
```

### Fase 04 — KANBAN COMERCIAL
```
**Status:** `✅ Completa`
**Progresso:** 4/4 tarefas (100%)
Tarefas: todas [x]
**Último trabalho:** 2026-05-31 — Implementação confirmada via estrutura de arquivos
```

### Fase 05 — WHATSAPP — DISPAROS AUTOMÁTICOS
```
**Status:** `✅ Completa`
**Progresso:** 4/4 tarefas (100%)
Tarefas: todas [x]
**Último trabalho:** 2026-05-31 — Implementação confirmada via estrutura de arquivos
```

### Fase 06 — INBOX DE ATENDIMENTO
```
**Status:** `✅ Completa`
**Progresso:** 5/5 tarefas (100%)
Tarefas: todas [x]
**Último trabalho:** 2026-05-31 — Implementação confirmada via estrutura de arquivos
```

### Fase 07 — IA DE ATENDIMENTO (CLAUDE)
```
**Status:** `✅ Completa`
**Progresso:** 5/5 tarefas (100%)
Tarefas: todas [x]
**Último trabalho:** 2026-05-31 — Implementação confirmada via estrutura de arquivos
```

Também atualizar o campo **Última atualização** no topo para `2026-05-31`.

Depois commitar:
```bash
git add docs/asbuilt.md
git commit -m "docs(asbuilt): sincroniza fases 02-07 com estado real do projeto"
git push origin dev
```

---

## PASSO 2 — Backup + Merge dev → hml

### 2.1 — Criar tag de backup
```bash
git checkout dev
git pull origin dev
$TIMESTAMP = Get-Date -Format "yyyyMMdd-HHmmss"
git tag -a "backup-pre-hml-$TIMESTAMP" -m "Backup antes de merge dev->hml — Fase 09"
git push origin --tags
```

### 2.2 — Merge dev → hml
```bash
git checkout hml
git pull origin hml
git merge dev --no-ff -m "merge(dev->hml): fase 09 - preparacao para producao"
git push origin hml
```

Resultado esperado: branch `hml` atualizada com tudo que está em `dev`.

---

## PASSO 3 — Chamar Ravena para QA

Após o merge, reportar ao Kleber:

```
[ATLAS]: ✅ Branch hml atualizada. Passando para RAVENA fazer o QA.

RAVENA, sua vez. Branch: hml
URL de homologação: https://movacrm-three.vercel.app (Vercel conectado ao main — QA deve ser feito localmente ou em preview)

Roteiro de testes obrigatórios:
- [ ] Login / Logout
- [ ] Dashboard — cards com dados reais
- [ ] Veículos — CRUD completo
- [ ] Clientes — CRUD completo
- [ ] Contratos — criar, editar, pagamento
- [ ] Kanban — criar card, drag-and-drop entre colunas
- [ ] Inbox — receber mensagem, assumir atendimento
- [ ] Configurações — salvar locadora, criar usuário, editar role, remover usuário
- [ ] WhatsApp — salvar Z-API, disparo manual, histórico
- [ ] Permissões por role (admin, atendente, financeiro, comercial)
- [ ] Responsividade mobile
```

---

## PASSO 4 — Chamar Kerberos para Auditoria

Após Ravena aprovar, reportar ao Kleber:

```
[ATLAS]: ✅ QA aprovado por Ravena. Passando para KERBEROS.

KERBEROS, sua vez. Checklist obrigatório:
- SQL Injection nas API routes
- XSS nos inputs
- RLS — consultor não acessa dados de outra locadora
- Secrets expostos no código ou git history
- Headers HTTP (CSP, HSTS)
- /api/users — 403 para não-admins
- /api/cron/disparos — apenas com Authorization header correto
- .env não commitado
- Dependências com CVEs críticos (npm audit)
```

---

## PASSO 5 — Corrigir issues

Se Ravena ou Kerberos apontarem issues:
1. Atlas corrige em `dev`
2. Faz commit + push
3. Merge `dev → hml` novamente
4. Repete validação

Se não houver issues: avançar direto para Passo 6.

---

## PASSO 6 — Backup crítico + Merge hml → main

### 6.1 — Backup pré-produção (CRÍTICO)
```bash
git checkout hml
git pull origin hml
$TIMESTAMP = Get-Date -Format "yyyyMMdd-HHmmss"
git tag -a "backup-pre-prod-$TIMESTAMP" -m "BACKUP CRITICO antes de producao — MovaCRM"
git push origin --tags
```

### 6.2 — Aguardar confirmação explícita de Kleber

Após o backup:
```
[ATLAS]: 🔴 AGUARDANDO CONFIRMAÇÃO EXPLÍCITA DE KLEBER

ESTE É O ÚLTIMO PASSO ANTES DE PRODUÇÃO.

Verificações:
- ✅ Ravena aprovou QA
- ✅ Kerberos aprovou segurança
- ✅ Backup crítico criado: backup-pre-prod-[TIMESTAMP]
- ✅ Build sem erros

❌ NÃO POSSO PROSSEGUIR SEM: "CONFIRMAR PRODUÇÃO" de Kleber.
```

### 6.3 — Merge hml → main (apenas após confirmação)
```bash
git checkout main
git pull origin main
git merge hml --no-ff -m "merge(hml->main): deploy producao MovaCRM v1.0"
git push origin main
```

Resultado esperado: Vercel detecta push no main e inicia deploy automático.

---

## PASSO 7 — Verificar deploy em produção

```bash
# Aguardar ~2 minutos e verificar
curl -I https://movacrm-three.vercel.app
```

Resultado esperado: `HTTP/2 200`

Reportar:
```
[ATLAS]: ✅ PRODUÇÃO NO AR

URL: https://movacrm-three.vercel.app
Status: HTTP 200 ✅
Deploy: Vercel confirmado

MovaCRM v1.0 em produção.
```

---

## PASSO 8 — Atualizar asbuilt.md (fase final)

Atualizar Fase 09 no asbuilt.md como completa e adicionar entrada no histórico de sessões.

```bash
git add docs/asbuilt.md
git commit -m "docs(asbuilt): fase 09 completa - movacrm v1.0 em producao"
git push origin main
```

---

## Critério de Aceitação da Fase 09

✅ asbuilt.md sincronizado com estado real
✅ Branch hml atualizada com todo o dev
✅ Ravena aprovou QA (sem bugs críticos)
✅ Kerberos aprovou segurança (sem vulnerabilidades críticas)
✅ Deploy produção HTTP 200 em https://movacrm-three.vercel.app
✅ Backup pré-prod criado com tag

## Em caso de erro
Parar e reportar ao Hades com output completo.

## ✅ RELATÓRIO OBRIGATÓRIO
- STATUS: sucesso / erro
- STEPS EXECUTADOS
- OUTPUT DO TERMINAL
- URL DE PRODUÇÃO RESPONDENDO
- ERROS ENCONTRADOS
