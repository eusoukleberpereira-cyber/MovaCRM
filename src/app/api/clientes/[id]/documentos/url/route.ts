import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await params
  const path = req.nextUrl.searchParams.get("path")
  if (!path) return NextResponse.json({ error: "path obrigatório" }, { status: 400 })

  const supabase = await createClient()
  const { data } = await supabase.storage
    .from("documentos")
    .createSignedUrl(path, 60 * 60)

  return NextResponse.json({ url: data?.signedUrl ?? null })
}
