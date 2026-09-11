// Session helpers — wraps Supabase Auth.
import { queryClient } from "./queryClient";
import { supabase } from "./supabase";

// Call after every successful login to ensure stale data from a previous
// session is not rendered for the new user.
export function beginSession() {
  queryClient.clear();
}

// Call from every sign-out control. Signs out of Supabase Auth, clears
// the React Query cache, and hard-redirects to /login so all in-memory
// state is wiped.
export async function endSession(redirectTo = "/login") {
  try {
    await supabase.auth.signOut();
  } catch {
    // ignore
  } finally {
    queryClient.clear();
    window.location.assign(redirectTo);
  }
}

