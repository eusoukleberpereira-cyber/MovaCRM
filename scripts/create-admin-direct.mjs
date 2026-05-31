import pg from 'pg'
const { Client } = pg

const client = new Client({
  connectionString: 'postgresql://postgres:mJtjYJWf3M53fucE@db.ecovfdmqnwskqkbtaebb.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
})

await client.connect()

// Verificar se usuário já existe
const { rows: existing } = await client.query(
  "SELECT id FROM auth.users WHERE email = 'eusoukleberpereira@gmail.com'"
)

let userId

if (existing.length > 0) {
  userId = existing[0].id
  console.log('⚠️ Usuário já existe. ID:', userId)
} else {
  // Inserir diretamente em auth.users (contorna o trigger problemático)
  const { rows } = await client.query(`
    INSERT INTO auth.users (
      id, instance_id, aud, role,
      email, encrypted_password,
      email_confirmed_at, email_change_confirm_status,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at,
      confirmation_token, recovery_token
    ) VALUES (
      gen_random_uuid(),
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'eusoukleberpereira@gmail.com',
      crypt('MovaCRM@2026', gen_salt('bf')),
      NOW(), 0,
      '{"provider": "email", "providers": ["email"]}',
      '{"name": "Kleber"}',
      NOW(), NOW(), NOW(),
      '', ''
    ) RETURNING id
  `)
  userId = rows[0].id
  console.log('✅ Usuário criado diretamente. ID:', userId)
}

// Criar locadora (verificar se já existe)
const { rows: locadoras } = await client.query("SELECT id FROM locadoras WHERE name = 'Locadora Demo'")
let locadoraId

if (locadoras.length > 0) {
  locadoraId = locadoras[0].id
  console.log('⚠️ Locadora já existe. ID:', locadoraId)
} else {
  const { rows: loc } = await client.query(
    "INSERT INTO locadoras (name) VALUES ('Locadora Demo') RETURNING id"
  )
  locadoraId = loc[0].id
  console.log('✅ Locadora criada. ID:', locadoraId)
}

// Criar/atualizar profile
await client.query(`
  INSERT INTO profiles (id, name, email, role, locadora_id)
  VALUES ($1, 'Kleber', 'eusoukleberpereira@gmail.com', 'admin', $2)
  ON CONFLICT (id) DO UPDATE SET role = 'admin', locadora_id = $2, name = 'Kleber'
`, [userId, locadoraId])
console.log('✅ Profile: admin | Locadora Demo')

await client.end()

console.log('\n─────────────────────────────────────────')
console.log('✅ ACESSO AO MOVACRM:')
console.log('URL:   https://movacrm-three.vercel.app/login')
console.log('Email: eusoukleberpereira@gmail.com')
console.log('Senha: MovaCRM@2026')
console.log('Perfil: Admin (acesso total)')
console.log('─────────────────────────────────────────')
