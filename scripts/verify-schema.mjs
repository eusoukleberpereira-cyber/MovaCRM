import pg from 'pg'
const { Client } = pg

const client = new Client({
  connectionString: 'postgresql://postgres:mJtjYJWf3M53fucE@db.ecovfdmqnwskqkbtaebb.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
})

await client.connect()

const { rows } = await client.query(`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
  ORDER BY table_name
`)

console.log('Tabelas criadas:')
rows.forEach(r => console.log(' ✅', r.table_name))

const { rows: rls } = await client.query(`
  SELECT tablename, rowsecurity FROM pg_tables
  WHERE schemaname = 'public' ORDER BY tablename
`)

console.log('\nRLS ativo:')
rls.forEach(r => console.log(` ${r.rowsecurity ? '✅' : '❌'}`, r.tablename, r.rowsecurity ? '(RLS ON)' : '(RLS OFF)'))

await client.end()
