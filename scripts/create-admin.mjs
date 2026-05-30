import pg from 'pg'
const { Client } = pg

const client = new Client({
  connectionString: 'postgresql://postgres:mJtjYJWf3M53fucE@db.ecovfdmqnwskqkbtaebb.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
})

const SUPABASE_URL = 'https://ecovfdmqnwskqkbtaebb.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjb3ZmZG1xbndza3FrYnRhZWJiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDE0NjIzMiwiZXhwIjoyMDk1NzIyMjMyfQ.svlzTpmavG-SarqZn_QcOpo6o_kqeF5QTyxLpfoBaVQ'

// 1. Criar usuário admin via Supabase Auth Admin API
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
  process.exit(1)
}
console.log('✅ Usuário criado. ID:', user.id)

// 2. Criar locadora Demo
await client.connect()
const { rows } = await client.query(
  "INSERT INTO locadoras (name) VALUES ('Locadora Demo') RETURNING id"
)
const locadoraId = rows[0].id
console.log('✅ Locadora criada. ID:', locadoraId)

// 3. Atualizar profile com role admin e locadora_id
await client.query(
  "UPDATE profiles SET role = 'admin', locadora_id = $1 WHERE id = $2",
  [locadoraId, user.id]
)
console.log('✅ Profile atualizado: role=admin, locadora vinculada')

await client.end()

console.log('\n─────────────────────────────')
console.log('ACESSO AO MOVACRM:')
console.log('URL:   https://movacrm-three.vercel.app/login')
console.log('Email: eusoukleberpereira@gmail.com')
console.log('Senha: MovaCRM@2026')
console.log('─────────────────────────────')
