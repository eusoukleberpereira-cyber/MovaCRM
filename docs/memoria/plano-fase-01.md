# INSTRUÇÕES PARA ATLAS — FASE 01: FUNDAÇÃO

## Contexto
Iniciar o projeto MovaCRM do zero. O repositório GitHub já existe (vazio ou quase).
Supabase será criado do zero. Vercel já tem conta vinculada ao GitHub.

**Objetivo da fase:** sistema rodando com login funcional, banco configurado,
design tokens aplicados e GitFlow ativo.

---

## Pré-condições
- [ ] Acesso ao repositório: https://github.com/eusoukleberpereira-cyber/MovaCRM
- [ ] Email Supabase/Vercel: eusoukleberpereira@gmail.com
- [ ] Estar no diretório correto: C:\Users\klebe\MovaCRM

---

## PASSO 1 — Clonar repositório e verificar estado atual

```bash
cd C:\Users\klebe
git clone https://github.com/eusoukleberpereira-cyber/MovaCRM
cd MovaCRM
ls -la
```

Resultado esperado: pasta MovaCRM criada, verificar se tem arquivos ou está vazio.

---

## PASSO 2 — Criar projeto Next.js 15

```bash
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-git
```

Quando perguntar sobre Turbopack: **Yes**

Resultado esperado: projeto Next.js criado na raiz sem erros.

---

## PASSO 3 — Instalar dependências do projeto

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install @tanstack/react-query
npm install lucide-react
npm install clsx tailwind-merge
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-select @radix-ui/react-tabs
npm install date-fns
npm install react-hook-form @hookform/resolvers zod
```

Resultado esperado: todas as dependências instaladas sem erros críticos.

---

## PASSO 4 — Configurar GitFlow

```bash
git checkout -b dev
git push origin dev

git checkout -b hml
git push origin hml

git checkout dev
```

Resultado esperado: 3 branches no GitHub (main, dev, hml). Atlas SEMPRE trabalha em `dev`.

---

## PASSO 5 — Criar projeto no Supabase

Instruir Kleber (apenas desta vez, pois exige interface web):

```
[ATLAS]: Kleber, preciso que você crie o projeto no Supabase agora.
São 3 cliques:

1. Acesse: https://supabase.com e entre com eusoukleberpereira@gmail.com
2. Clique em "New Project"
3. Preencha:
   - Name: MovaCRM
   - Database Password: crie uma senha forte e me passe aqui
   - Region: South America (São Paulo) — mais perto = mais rápido
4. Clique "Create new project" e aguarde ~2 minutos
5. Quando terminar, vá em: Settings > API
   Me passe:
   - Project URL (começa com https://xxxx.supabase.co)
   - anon public key
   - service_role key (clique em "Reveal")
```

---

## PASSO 6 — Configurar variáveis de ambiente

Criar arquivo `.env.local` na raiz do projeto:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=SUA_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=SUA_SERVICE_ROLE_KEY

# Anthropic (Claude AI)
ANTHROPIC_API_KEY=

# Z-API (será configurado por locadora — variável global de base URL)
ZAPI_BASE_URL=https://api.z-api.io

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Criar também `.env.example` (sem valores reais, para commitar):

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
ZAPI_BASE_URL=https://api.z-api.io
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Garantir que `.env.local` está no `.gitignore`.

---

## PASSO 7 — Aplicar Design Tokens

### 7.1 — Adicionar fontes no layout.tsx

Arquivo: `src/app/layout.tsx`

```tsx
import { Bricolage_Grotesque, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google'

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['300', '400', '700', '800'],
})

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['300', '400', '500', '600', '700'],
})

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500'],
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${bricolage.variable} ${jakarta.variable} ${jetbrains.variable}`}>
      <body className="font-body bg-background text-text antialiased">
        {children}
      </body>
    </html>
  )
}
```

### 7.2 — Aplicar tokens no globals.css

Substituir conteúdo de `src/app/globals.css` pelo conteúdo do arquivo:
`docs/memoria/design-tokens.css`

(copiar o conteúdo completo do design-tokens.css)

### 7.3 — Configurar Tailwind para usar os tokens

Arquivo: `tailwind.config.ts`

```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary:    'var(--color-primary)',
        accent:     'var(--color-accent)',
        background: 'var(--color-background)',
        surface:    'var(--color-surface)',
        text:       'var(--color-text)',
        muted:      'var(--color-muted)',
        border:     'var(--color-border)',
        success:    'var(--color-success)',
        danger:     'var(--color-danger)',
        warning:    'var(--color-warning)',
      },
      fontFamily: {
        display: 'var(--font-display)',
        body:    'var(--font-body)',
        mono:    'var(--font-mono)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
    },
  },
  plugins: [],
}

export default config
```

---

## PASSO 8 — Configurar cliente Supabase

### 8.1 — Client-side

Criar `src/lib/supabase/client.ts`:

```ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### 8.2 — Server-side

Criar `src/lib/supabase/server.ts`:

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
```

### 8.3 — Middleware de autenticação

Criar `src/middleware.ts`:

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isAuthPage = request.nextUrl.pathname.startsWith('/login')
  const isPublicRoute = request.nextUrl.pathname === '/'

  if (!user && !isAuthPage && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

---

## PASSO 9 — Criar página de Login

Criar `src/app/login/page.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email ou senha incorretos.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="bg-surface rounded-lg shadow-md p-8 w-full max-w-md">
        <h1 className="font-display text-3xl font-bold text-primary mb-2">MovaCRM</h1>
        <p className="text-muted text-sm mb-8">Entre com suas credenciais para acessar</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-1">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              required
            />
          </div>

          {error && <p className="text-danger text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent hover:bg-accent/90 text-white font-semibold py-2 rounded-md transition-colors disabled:opacity-50"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

Criar `src/app/dashboard/page.tsx` (placeholder):

```tsx
export default function DashboardPage() {
  return (
    <div className="p-8">
      <h1 className="font-display text-2xl font-bold text-primary">Dashboard</h1>
      <p className="text-muted mt-2">Fase 01 completa. Em construção...</p>
    </div>
  )
}
```

---

## PASSO 10 — Criar Schema do Banco de Dados

No Supabase, acessar **SQL Editor** e executar o script abaixo:

```sql
-- ============================================
-- MOVACRM — SCHEMA COMPLETO v1.0
-- ============================================

-- Tabela de locadoras (cada instância tem uma)
CREATE TABLE locadoras (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  logo_url    TEXT,
  zapi_token  TEXT,
  zapi_instance TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Perfis de usuário (extensão do auth.users)
CREATE TABLE profiles (
  id          UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('admin','atendente','financeiro','comercial')),
  locadora_id UUID REFERENCES locadoras(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Veículos
CREATE TABLE veiculos (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  locadora_id UUID REFERENCES locadoras(id) ON DELETE CASCADE NOT NULL,
  placa       TEXT NOT NULL,
  modelo      TEXT NOT NULL,
  ano         INTEGER NOT NULL,
  status      TEXT NOT NULL DEFAULT 'disponivel' CHECK (status IN ('disponivel','alugado','manutencao')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Clientes
CREATE TABLE clientes (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  locadora_id         UUID REFERENCES locadoras(id) ON DELETE CASCADE NOT NULL,
  name                TEXT NOT NULL,
  cpf                 TEXT,
  whatsapp            TEXT NOT NULL,
  grupo_whatsapp_id   TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Contratos
CREATE TABLE contratos (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  locadora_id     UUID REFERENCES locadoras(id) ON DELETE CASCADE NOT NULL,
  cliente_id      UUID REFERENCES clientes(id) NOT NULL,
  veiculo_id      UUID REFERENCES veiculos(id) NOT NULL,
  valor_mensal    NUMERIC(10,2) NOT NULL,
  data_inicio     DATE NOT NULL,
  data_vencimento DATE NOT NULL,
  status          TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','encerrado')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Pagamentos
CREATE TABLE pagamentos (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contrato_id     UUID REFERENCES contratos(id) ON DELETE CASCADE NOT NULL,
  valor           NUMERIC(10,2) NOT NULL,
  data_pagamento  DATE,
  status          TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pago','pendente','atrasado')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Kanban cards
CREATE TABLE kanban_cards (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  locadora_id     UUID REFERENCES locadoras(id) ON DELETE CASCADE NOT NULL,
  estagio         TEXT NOT NULL DEFAULT 'lead' CHECK (estagio IN ('lead','qualificacao','proposta','negociacao','fechado','renovacao')),
  cliente_nome    TEXT NOT NULL,
  cliente_whatsapp TEXT,
  responsavel_id  UUID REFERENCES profiles(id),
  posicao         INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Atendimentos (conversas WhatsApp)
CREATE TABLE atendimentos (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  locadora_id     UUID REFERENCES locadoras(id) ON DELETE CASCADE NOT NULL,
  whatsapp_number TEXT NOT NULL,
  nome_contato    TEXT,
  status          TEXT NOT NULL DEFAULT 'espera' CHECK (status IN ('espera','ativo','resolvido')),
  atendente_id    UUID REFERENCES profiles(id),
  kanban_card_id  UUID REFERENCES kanban_cards(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Mensagens dos atendimentos
CREATE TABLE mensagens (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  atendimento_id  UUID REFERENCES atendimentos(id) ON DELETE CASCADE NOT NULL,
  tipo            TEXT NOT NULL CHECK (tipo IN ('entrada','saida')),
  conteudo        TEXT NOT NULL,
  remetente       TEXT NOT NULL CHECK (remetente IN ('cliente','ia','atendente')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Disparos de WhatsApp (histórico)
CREATE TABLE disparos (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  locadora_id     UUID REFERENCES locadoras(id) ON DELETE CASCADE NOT NULL,
  contrato_id     UUID REFERENCES contratos(id),
  tipo            TEXT NOT NULL CHECK (tipo IN ('vencimento_privado','vencimento_grupo')),
  status          TEXT NOT NULL DEFAULT 'enviado' CHECK (status IN ('enviado','erro')),
  mensagem        TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TRIGGER: atualizar updated_at automaticamente
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_kanban_cards_updated_at
  BEFORE UPDATE ON kanban_cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_atendimentos_updated_at
  BEFORE UPDATE ON atendimentos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- RLS — ROW LEVEL SECURITY
-- ============================================
ALTER TABLE locadoras    ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE veiculos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE contratos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagamentos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE kanban_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE atendimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensagens    ENABLE ROW LEVEL SECURITY;
ALTER TABLE disparos     ENABLE ROW LEVEL SECURITY;

-- Política base: usuário autenticado acessa apenas dados da sua locadora
CREATE POLICY "usuarios_propria_locadora" ON veiculos
  FOR ALL USING (
    locadora_id = (SELECT locadora_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "usuarios_propria_locadora" ON clientes
  FOR ALL USING (
    locadora_id = (SELECT locadora_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "usuarios_propria_locadora" ON contratos
  FOR ALL USING (
    locadora_id = (SELECT locadora_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "usuarios_propria_locadora" ON pagamentos
  FOR ALL USING (
    contrato_id IN (
      SELECT id FROM contratos
      WHERE locadora_id = (SELECT locadora_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "usuarios_propria_locadora" ON kanban_cards
  FOR ALL USING (
    locadora_id = (SELECT locadora_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "usuarios_propria_locadora" ON atendimentos
  FOR ALL USING (
    locadora_id = (SELECT locadora_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "usuarios_propria_locadora" ON mensagens
  FOR ALL USING (
    atendimento_id IN (
      SELECT id FROM atendimentos
      WHERE locadora_id = (SELECT locadora_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "usuarios_propria_locadora" ON disparos
  FOR ALL USING (
    locadora_id = (SELECT locadora_id FROM profiles WHERE id = auth.uid())
  );

-- Profiles: usuário vê apenas o próprio perfil (admin vê todos via service role)
CREATE POLICY "proprio_perfil" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "proprio_perfil_update" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- ============================================
-- TRIGGER: criar profile automaticamente ao registrar usuário
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'Usuário'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'atendente')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

Resultado esperado: todas as tabelas criadas sem erros, RLS ativo.

---

## PASSO 11 — Criar usuário admin inicial no Supabase

No Supabase > Authentication > Users > Add User:
- Email: eusoukleberpereira@gmail.com
- Password: (definir senha inicial)
- Email Confirm: ✅ (marcar como confirmado)

Depois no SQL Editor, criar a locadora e vincular ao admin:

```sql
-- Criar locadora padrão
INSERT INTO locadoras (name) VALUES ('Locadora Demo') RETURNING id;

-- Copiar o UUID retornado e usar abaixo:
-- UPDATE profiles SET role = 'admin', locadora_id = 'UUID_DA_LOCADORA'
-- WHERE email = 'eusoukleberpereira@gmail.com';
```

---

## PASSO 12 — Conectar Vercel ao projeto

No Vercel (vercel.com com eusoukleberpereira@gmail.com):
1. New Project → Import `eusoukleberpereira-cyber/MovaCRM`
2. Framework: Next.js (detecta automaticamente)
3. Branch de produção: `main`
4. Adicionar variáveis de ambiente (as mesmas do `.env.local`)
5. Deploy

---

## PASSO 13 — Commit e push da Fase 01

```bash
git add .
git commit -m "feat(foundation): setup Next.js 15, Supabase auth, design tokens e GitFlow"
git push origin dev
```

---

## Critério de Aceitação da Fase 01

✅ `npm run build` sem erros
✅ `npm run dev` roda sem erros
✅ Página de login carrega com as fontes corretas (Bricolage Grotesque)
✅ Login com email/senha funciona e redireciona para /dashboard
✅ Rota protegida: acessar /dashboard sem login redireciona para /login
✅ Todas as tabelas criadas no Supabase
✅ GitFlow: branches dev, hml, main existem no GitHub
✅ Vercel: deploy automático conectado ao main

---

## Em caso de erro
Parar imediatamente e reportar ao Hades com:
- Passo exato onde falhou
- Output completo do terminal (sem resumir)
- Mensagem de erro exata

---

## ✅ RELATÓRIO OBRIGATÓRIO AO CONCLUIR

Traga exatamente:
- **STATUS**: sucesso / erro
- **STEPS EXECUTADOS**: lista numerada
- **OUTPUT DO BUILD**: resultado do `npm run build`
- **ESTADO ATUAL**: resultado do `git status` e `git log --oneline -5`
- **ERROS ENCONTRADOS**: se houver, copie a mensagem exata
