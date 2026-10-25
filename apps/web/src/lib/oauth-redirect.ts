/** Supabase may return an OAuth code to the site root; passport codes stay public. */
export function oauthCallbackTarget(path: string, search: string) {
  if (path !== "/" && path !== "/login") return null;
  const code = new URLSearchParams(search).get("code");
  if (!code || code.startsWith("D1-")) return null;
  return `/auth/callback${search.startsWith("?") ? search : "?" + search}`;
}
