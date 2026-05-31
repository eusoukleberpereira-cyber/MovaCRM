import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createClient as createClientSSR } from "@/lib/supabase/server"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getCallerAdmin() {
  const supabase = await createClientSSR()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: caller } = await supabaseAdmin
    .from("profiles")
    .select("id, role, locadora_id")
    .eq("id", user.id)
    .single()

  if (caller?.role !== "admin") return null
  return caller
}

// GET — listar usuários da locadora
export async function GET() {
  try {
    const caller = await getCallerAdmin()
    if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { data: users } = await supabaseAdmin
      .from("profiles")
      .select("id, name, email, role, created_at")
      .eq("locadora_id", caller.locadora_id)
      .order("name")

    return NextResponse.json(users ?? [])
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST — criar novo usuário
export async function POST(request: NextRequest) {
  try {
    const caller = await getCallerAdmin()
    if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { name, email, role } = await request.json()

    if (!name || !email || !role) {
      return NextResponse.json({ error: "name, email e role são obrigatórios" }, { status: 400 })
    }

    const tempPassword = `MovaCRM@${new Date().getFullYear()}!`

    const { data: newUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password:      tempPassword,
      email_confirm: true,
      user_metadata: { name, role },
    })

    if (authErr) {
      return NextResponse.json({ error: authErr.message }, { status: 422 })
    }

    // Upsert profile (trigger pode ter criado com role padrão)
    await supabaseAdmin
      .from("profiles")
      .upsert({
        id:          newUser.user.id,
        name,
        email,
        role,
        locadora_id: caller.locadora_id,
      })

    return NextResponse.json({
      ok:            true,
      user_id:       newUser.user.id,
      temp_password: tempPassword,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
