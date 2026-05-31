import pg from 'pg'
const { Client } = pg

const client = new Client({
  connectionString: 'postgresql://postgres:mJtjYJWf3M53fucE@db.ecovfdmqnwskqkbtaebb.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
})

const SUPABASE_URL = 'https://ecovfdmqnwskqkbtaebb.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjb3ZmZG1xbndza3FrYnRhZWJiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDE0NjIzMiwiZXhwIjoyMDk1NzIyMjMyfQ.svlzTpmavG-SarqZn_QcOpo6o_kqeF5QTyxLpfoBaVQ'

await client.connect()

// 1. Desabilitar trigger temporariamente para criar o usuário sem conflito
console.log('Desabilitando trigger temporariamente...')
await client.query('ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created')

// 2. Criar usuário admin via Supabase Auth API
console.log('Criando usuário admin...')
const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'apikey': SERVICE_ROLE_KEY
  },
  body: JSON.stringify({
    email: 'eusoukleberpereira@gmail.com',
    password: 'MovaCRM@2026',
    email_confirm: true,
    user_metadata: { name: 'Kleber', role: 'admin' }
  })
})

const user = await res.json()
if (!res.ok) {
  console.error('❌ Erro ao criar usuário:', user)
  await client.query('ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created')
  await client.end()
  process.exit(1)
}
console.log('✅ Usuário criado. ID:', user.id)

// 3. Reabilitar trigger
await client.query('ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created')
console.log('✅ Trigger reabilitado')

// 4. Criar locadora Demo
const { rows } = await client.query(
  "INSERT INTO locadoras (name) VALUES ('Locadora Demo') RETURNING id"
)
const locadoraId = rows[0].id
console.log('✅ Locadora criada. ID:', locadoraId)

// 5. Inserir profile manualmente (trigger estava desabilitado)
await client.query(
  `INSERT INTO profiles (id, name, email, role, locadora_id)
   VALUES ($1, 'Kleber', 'eusoukleberpereira@gmail.com', 'admin', $2)
   ON CONFLICT (id) DO UPDATE SET role = 'admin', locadora_id = $2, name = 'Kleber'`,
  [user.id, locadoraId]
)
console.log('✅ Profile criado: admin | Locadora Demo')

await client.end()

console.log('\n─────────────────────────────────────────')
console.log('✅ ACESSO AO MOVACRM CONFIGURADO:')
console.log('URL:   https://movacrm-three.vercel.app/login')
console.log('Email: eusoukleberpereira@gmail.com')
console.log('Senha: MovaCRM@2026')
console.log('Perfil: Admin (acesso total)')
console.log('─────────────────────────────────────────')
