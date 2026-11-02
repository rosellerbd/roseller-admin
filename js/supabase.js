import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://brxcewayxayqfgyrekqh.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_7iKas9NU72vt3OUhaqqW-w_TLwLrY9O';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  accessToken: async () => {
    const a = window.RosellerAuth;
    if (!a || !a.currentUser) return null;
    try { return await a.currentUser.getIdToken(false); } catch { return null; }
  }
});

window.RosellerSupabase = supabase;