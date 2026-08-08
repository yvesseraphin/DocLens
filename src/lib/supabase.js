import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.warn('DocLens: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not set. Google OAuth will not work.');
}

export const supabase = createClient(
  SUPABASE_URL  || 'https://placeholder.supabase.co',
  SUPABASE_ANON || 'placeholder',
);

export async function signInWithGoogle() {
  // Do NOT include a hash fragment in redirectTo — Supabase appends its own
  // #access_token=... hash and a URL can only have one fragment. Passing a hash
  // here causes the tokens to be silently dropped on redirect.
  const redirectTo = window.location.origin + window.location.pathname;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  });
  if (error) throw new Error(error.message);
}
