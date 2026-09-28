import type { SupabaseClient, User } from '@supabase/supabase-js';

export interface Env {
  ASSETS: Fetcher;
  // vars (wrangler.jsonc)
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY?: string;
  APP_ORIGIN: string;
  MEMBER_EMAIL_DOMAIN: string;
  SAFEGUARDING_EMAIL: string;
  EMAIL_FROM: string;
  BUNNY_LIBRARY_ID?: string;
  JAAS_APP_ID?: string;
  JAAS_KEY_ID?: string;
  // secrets (wrangler secret put …)
  SUPABASE_SERVICE_ROLE_KEY?: string;
  PAYSTACK_SECRET_KEY?: string;
  OPENAI_API_KEY?: string;
  BUNNY_TOKEN_KEY?: string;
  JAAS_PRIVATE_KEY?: string;
  RESEND_API_KEY?: string;
  ZOHO_FLOW_WEBHOOK_URL?: string;
}

export type Role = 'member' | 'parent' | 'mentor' | 'moderator' | 'admin' | 'owner';

export interface Profile {
  id: string;
  role: Role;
  full_name: string;
  display_name: string;
  email: string | null;
  circle_id: string | null;
  timed_out_until: string | null;
}

export type Vars = {
  admin: SupabaseClient;
  user: User;
  profile: Profile;
  /** A client that acts as the caller, so RLS applies. */
  asUser: SupabaseClient;
};

export type AppEnv = { Bindings: Env; Variables: Vars };
