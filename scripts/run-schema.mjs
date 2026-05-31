import pg from 'pg'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const { Client } = pg
const __dirname = dirname(fileURLToPath(import.meta.url))

const client = new Client({
  connectionString: 'postgresql://postgres:mJtjYJWf3M53fucE@db.ecovfdmqnwskqkbtaebb.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
})

const sql = readFileSync(join(__dirname, '../docs/memoria/schema.sql'), 'utf8')

try {
  await client.connect()
  console.log('✅ Conectado ao Supabase PostgreSQL')
  await client.query(sql)
  console.log('✅ Schema criado com sucesso — 10 tabelas, RLS e triggers')
} catch (err) {
  console.error('❌ Erro:', err.message)
  process.exit(1)
} finally {
  await client.end()
}
