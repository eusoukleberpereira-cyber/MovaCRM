import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("cliente_documentos")
    .select("id, nome_arquivo, tipo, storage_path, tamanho_bytes, mime_type, created_at")
    .eq("cliente_id", id)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const admin   = createServiceRoleClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  const tipo = (formData.get("tipo") as string) || "outro"

  if (!file) return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 })
  if (file.size > 20 * 1024 * 1024)
    return NextResponse.json({ error: "Arquivo excede 20MB" }, { status: 400 })

  const allowed = ["image/jpeg", "image/png", "application/pdf"]
  if (!allowed.includes(file.type))
    return NextResponse.json({ error: "Formato inválido. Use JPEG, PNG ou PDF." }, { status: 400 })

  const path = `${id}/${Date.now()}-${file.name.replace(/\s+/g, "_")}`
  const arrayBuffer = await file.arrayBuffer()

  const { error: uploadError } = await admin.storage
    .from("documentos")
    .upload(path, arrayBuffer, { contentType: file.type, upsert: false })

  if (uploadError)
    return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data, error: dbError } = await admin
    .from("cliente_documentos")
    .insert({
      cliente_id:   id,
      nome_arquivo: file.name,
      tipo,
      storage_path: path,
      tamanho_bytes: file.size,
      mime_type:    file.type,
      uploaded_by:  user.id,
    })
    .select()
    .single()

  if (dbError) {
    await admin.storage.from("documentos").remove([path])
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { docId } = await req.json()
  if (!docId) return NextResponse.json({ error: "docId obrigatório" }, { status: 400 })

  const admin = createServiceRoleClient()

  const { data: doc } = await admin
    .from("cliente_documentos")
    .select("storage_path")
    .eq("id", docId)
    .eq("cliente_id", id)
    .single()

  if (!doc) return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 })

  await admin.storage.from("documentos").remove([doc.storage_path])
  await admin.from("cliente_documentos").delete().eq("id", docId)

  return NextResponse.json({ ok: true })
}
