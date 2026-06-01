"use client"

import { useState, useEffect, useRef } from "react"
import { Upload, FileText, Trash2, Download, Loader2, ImageIcon } from "lucide-react"

type Documento = {
  id: string
  nome_arquivo: string
  tipo: string
  storage_path: string
  tamanho_bytes: number
  mime_type: string
  created_at: string
}

const TIPO_OPTIONS = [
  { value: "frente_cnh",           label: "Frente da CNH" },
  { value: "verso_cnh",            label: "Verso da CNH" },
  { value: "comprovante_endereco", label: "Comprovante de Endereço" },
  { value: "identidade",           label: "Identidade (RG)" },
  { value: "outro",                label: "Outro" },
]

const TIPO_BADGE: Record<string, string> = {
  frente_cnh:           "bg-green-100 text-green-700",
  verso_cnh:            "bg-emerald-100 text-emerald-700",
  comprovante_endereco: "bg-purple-100 text-purple-700",
  identidade:           "bg-yellow-100 text-yellow-700",
  outro:                "bg-gray-100 text-gray-500",
}

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ClienteDocumentos({ clienteId }: { clienteId: string }) {
  const [docs,      setDocs]      = useState<Documento[]>([])
  const [loading,   setLoading]   = useState(true)
  const [uploading, setUploading] = useState(false)
  const [tipo,      setTipo]      = useState("outro")
  const [dragOver,  setDragOver]  = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`/api/clientes/${clienteId}/documentos`)
      .then(r => r.json())
      .then(data => { setDocs(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [clienteId])

  async function upload(file: File) {
    if (file.size > 20 * 1024 * 1024) { alert("Arquivo excede 20MB"); return }
    setUploading(true)
    const fd = new FormData()
    fd.append("file", file)
    fd.append("tipo", tipo)
    const res  = await fetch(`/api/clientes/${clienteId}/documentos`, { method: "POST", body: fd })
    const data = await res.json()
    if (res.ok) setDocs(prev => [data, ...prev])
    else alert(data.error ?? "Erro ao enviar arquivo")
    setUploading(false)
  }

  async function handleDelete(docId: string) {
    if (!confirm("Remover este documento?")) return
    await fetch(`/api/clientes/${clienteId}/documentos`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ docId }),
    })
    setDocs(prev => prev.filter(d => d.id !== docId))
  }

  async function handleDownload(doc: Documento) {
    const res = await fetch(`/api/clientes/${clienteId}/documentos/url?path=${encodeURIComponent(doc.storage_path)}`)
    const { url } = await res.json()
    if (url) window.open(url, "_blank")
  }

  return (
    <div className="space-y-4">
      {/* Upload zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) upload(f) }}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${dragOver ? "border-accent bg-accent/5" : "border-border hover:border-accent/50"}`}
      >
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = "" }}
        />
        {uploading ? (
          <div className="flex items-center justify-center gap-2 text-sm text-muted">
            <Loader2 size={16} className="animate-spin" /> Enviando...
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload size={20} className="text-muted" />
            <p className="text-sm text-text">Solte o arquivo ou clique para selecionar</p>
            <p className="text-xs text-muted">JPEG, PNG ou PDF — até 20MB</p>
          </div>
        )}
      </div>

      {/* Tipo do arquivo */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted">Tipo do documento:</span>
        <select
          value={tipo}
          onChange={e => setTipo(e.target.value)}
          className="border border-border rounded-md px-2 py-1 text-sm bg-surface text-text focus:outline-none focus:ring-2 focus:ring-accent"
        >
          {TIPO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 size={16} className="animate-spin text-muted" />
        </div>
      ) : docs.length === 0 ? (
        <p className="text-sm text-muted text-center py-6">Nenhum documento enviado ainda.</p>
      ) : (
        <div className="space-y-2">
          {docs.map(doc => (
            <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background">
              <div className="text-muted shrink-0">
                {doc.mime_type?.startsWith("image/") ? <ImageIcon size={14} /> : <FileText size={14} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{doc.nome_arquivo}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${TIPO_BADGE[doc.tipo] ?? TIPO_BADGE.outro}`}>
                    {TIPO_OPTIONS.find(o => o.value === doc.tipo)?.label ?? doc.tipo}
                  </span>
                  <span className="text-xs text-muted">{fmt(doc.tamanho_bytes)}</span>
                  <span className="text-xs text-muted">{new Date(doc.created_at).toLocaleDateString("pt-BR")}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => handleDownload(doc)} title="Baixar"
                  className="w-7 h-7 rounded flex items-center justify-center text-muted hover:text-text hover:bg-border transition-colors">
                  <Download size={13} />
                </button>
                <button onClick={() => handleDelete(doc.id)} title="Remover"
                  className="w-7 h-7 rounded flex items-center justify-center text-muted hover:text-red-500 hover:bg-red-50 transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
