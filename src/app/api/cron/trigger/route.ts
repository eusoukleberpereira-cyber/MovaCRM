import { NextRequest, NextResponse } from "next/server"
import { createClient as createClientSSR } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  const supabase = await createClientSSR()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const baseUrl = request.nextUrl.origin
  const res = await fetch(`${baseUrl}/api/cron/disparos`, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
