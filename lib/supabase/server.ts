import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type ServerClientOptions = {
  useServiceRole?: boolean;
};

export function getServerSupabase(options: ServerClientOptions = {}): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  const key = options.useServiceRole ? serviceRoleKey : anonKey;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required when useServiceRole is true.");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

