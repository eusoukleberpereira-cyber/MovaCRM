import pg from 'pg'
const { Client } = pg

const client = new Client({
  connectionString: 'postgresql://postgres:mJtjYJWf3M53fucE@db.ecovfdmqnwskqkbtaebb.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
})

await client.connect()

// Adicionar política de INSERT para profiles (o trigger precisa disso)
await client.query(`
  CREATE POLICY "allow_trigger_insert" ON profiles
    FOR INSERT WITH CHECK (true)
`)
console.log('✅ Política INSERT adicionada ao profiles')

// Também garantir que service_role tem acesso total
await client.query(`
  CREATE POLICY "service_role_all" ON profiles
    FOR ALL TO service_role USING (true) WITH CHECK (true)
`)
console.log('✅ Política service_role adicionada ao profiles')

await client.end()
console.log('\nTente criar o usuário novamente.')
