import pg from 'pg'
const { Client } = pg

const SUPABASE_URL = 'https://ecovfdmqnwskqkbtaebb.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjb3ZmZG1xbndza3FrYnRhZWJiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDE0NjIzMiwiZXhwIjoyMDk1NzIyMjMyfQ.svlzTpmavG-SarqZn_QcOpo6o_kqeF5QTyxLpfoBaVQ'

// Tenta criar usuário sem metadata (trigger usa defaults)
console.log('Criando usuário sem metadata...')
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
    email_confirm: true
  })
})

const result = await res.json()
console.log('Resposta:', JSON.stringify(result, null, 2))

if (!res.ok) {
  // Se já existe, busca o usuário
  console.log('\nVerificando se usuário já existe...')
  const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?email=eusoukleberpereira@gmail.com`, {
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY
    }
  })
  const list = await listRes.json()
  console.log('Usuários encontrados:', JSON.stringify(list, null, 2))
}
