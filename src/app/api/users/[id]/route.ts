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

async function verifyTarget(targetId: string, locadoraId: string) {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("locadora_id")
    .eq("id", targetId)
    .single()
  return data?.locadora_id === locadoraId
}

// PATCH — atualizar role
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await getCallerAdmin()
    if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { id } = await params
    const { role } = await request.json()

    if (!await verifyTarget(id, caller.locadora_id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await supabaseAdmin
      .from("profiles")
      .update({ role })
      .eq("id", id)

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE — remover usuário
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await getCallerAdmin()
    if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { id } = await params

    if (id === caller.id) {
      return NextResponse.json({ error: "Não é possível remover sua própria conta" }, { status: 400 })
    }

    if (!await verifyTarget(id, caller.locadora_id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await supabaseAdmin.auth.admin.deleteUser(id)

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
