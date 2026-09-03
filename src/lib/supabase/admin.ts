import { createClient } from "@supabase/supabase-js";

import { getPublicSupabaseUrl, getRequiredServerEnv } from "@/lib/env";

export function createSupabaseAdminClient() {
  return createClient(
    getPublicSupabaseUrl(),
    getRequiredServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
