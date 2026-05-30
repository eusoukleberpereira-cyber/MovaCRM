-- ============================================
-- MOVACRM — SCHEMA COMPLETO v1.0
-- ============================================

CREATE TABLE locadoras (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name          TEXT NOT NULL,
  logo_url      TEXT,
  zapi_token    TEXT,
  zapi_instance TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE profiles (
  id          UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('admin','atendente','financeiro','comercial')),
  locadora_id UUID REFERENCES locadoras(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE veiculos (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  locadora_id UUID REFERENCES locadoras(id) ON DELETE CASCADE NOT NULL,
  placa       TEXT NOT NULL,
  modelo      TEXT NOT NULL,
  ano         INTEGER NOT NULL,
  status      TEXT NOT NULL DEFAULT 'disponivel' CHECK (status IN ('disponivel','alugado','manutencao')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE clientes (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  locadora_id       UUID REFERENCES locadoras(id) ON DELETE CASCADE NOT NULL,
  name              TEXT NOT NULL,
  cpf               TEXT,
  whatsapp          TEXT NOT NULL,
  grupo_whatsapp_id TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TABLE pagamentos (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contrato_id    UUID REFERENCES contratos(id) ON DELETE CASCADE NOT NULL,
  valor          NUMERIC(10,2) NOT NULL,
  data_pagamento DATE,
  status         TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pago','pendente','atrasado')),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE kanban_cards (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  locadora_id      UUID REFERENCES locadoras(id) ON DELETE CASCADE NOT NULL,
  estagio          TEXT NOT NULL DEFAULT 'lead' CHECK (estagio IN ('lead','qualificacao','proposta','negociacao','fechado','renovacao')),
  cliente_nome     TEXT NOT NULL,
  cliente_whatsapp TEXT,
  responsavel_id   UUID REFERENCES profiles(id),
  posicao          INTEGER DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TABLE mensagens (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  atendimento_id UUID REFERENCES atendimentos(id) ON DELETE CASCADE NOT NULL,
  tipo           TEXT NOT NULL CHECK (tipo IN ('entrada','saida')),
  conteudo       TEXT NOT NULL,
  remetente      TEXT NOT NULL CHECK (remetente IN ('cliente','ia','atendente')),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE disparos (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  locadora_id UUID REFERENCES locadoras(id) ON DELETE CASCADE NOT NULL,
  contrato_id UUID REFERENCES contratos(id),
  tipo        TEXT NOT NULL CHECK (tipo IN ('vencimento_privado','vencimento_grupo')),
  status      TEXT NOT NULL DEFAULT 'enviado' CHECK (status IN ('enviado','erro')),
  mensagem    TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TRIGGERS: atualizar updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_kanban_cards_updated_at
  BEFORE UPDATE ON kanban_cards FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_atendimentos_updated_at
  BEFORE UPDATE ON atendimentos FOR EACH ROW EXECUTE FUNCTION update_updated_at();

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

CREATE POLICY "usuarios_propria_locadora" ON veiculos
  FOR ALL USING (locadora_id = (SELECT locadora_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "usuarios_propria_locadora" ON clientes
  FOR ALL USING (locadora_id = (SELECT locadora_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "usuarios_propria_locadora" ON contratos
  FOR ALL USING (locadora_id = (SELECT locadora_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "usuarios_propria_locadora" ON kanban_cards
  FOR ALL USING (locadora_id = (SELECT locadora_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "usuarios_propria_locadora" ON atendimentos
  FOR ALL USING (locadora_id = (SELECT locadora_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "usuarios_propria_locadora" ON disparos
  FOR ALL USING (locadora_id = (SELECT locadora_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "usuarios_propria_locadora" ON pagamentos
  FOR ALL USING (
    contrato_id IN (
      SELECT id FROM contratos
      WHERE locadora_id = (SELECT locadora_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "usuarios_propria_locadora" ON mensagens
  FOR ALL USING (
    atendimento_id IN (
      SELECT id FROM atendimentos
      WHERE locadora_id = (SELECT locadora_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "proprio_perfil" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "proprio_perfil_update" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- ============================================
-- TRIGGER: criar profile ao registrar usuário
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
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
