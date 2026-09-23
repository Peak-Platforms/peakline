import { createClient } from '@supabase/supabase-js';

// Service-role client — bypasses RLS. Only use this for narrowly-scoped,
// server-side lookups (like resolving a public call link). Never import
// this into anything that runs in the browser.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}