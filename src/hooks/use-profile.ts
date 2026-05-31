"use client"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export type Profile = {
  id: string
  name: string
  email: string
  role: "admin" | "atendente" | "financeiro" | "comercial"
  locadora_id: string
}

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()
      setProfile(data)
      setLoading(false)
    }
    load()
  }, [])

  return { profile, loading }
}
