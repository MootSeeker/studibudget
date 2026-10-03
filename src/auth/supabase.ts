import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** null, wenn der Server nicht konfiguriert ist (siehe .env.example). */
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        // PKCE: Links aus E-Mails kommen mit ?code=… zurück und passen damit zum Hash-Routing.
        auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true },
      })
    : null
