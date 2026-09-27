import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  // Calling still fails gracefully at call time (see callSession.ts), this
  // warning just makes the missing setup obvious in the console instead of
  // a cryptic network error the first time someone taps the video icon.
  console.warn(
    "[PArA] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. Calling will not work until comm has its own Supabase project wired up. See PARA-BACKEND-SETUP.md."
  );
}

export const supabase = createClient(url ?? "https://placeholder.supabase.co", anonKey ?? "placeholder");
