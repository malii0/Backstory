import { supabase } from "./supabase";

let refreshPromise: Promise<string | null> | null = null;

function refreshAccessTokenOnce(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = supabase.auth
      .refreshSession()
      .then(({ data, error }) => {
        if (error || !data.session?.access_token) {
          return null;
        }
        return data.session.access_token;
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function fetchWithAuth(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const headers = new Headers(init?.headers);

  const hadSession = Boolean(session?.access_token);
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  const response = await fetch(input, { ...init, headers });

  if (
    response.status === 401 &&
    hadSession &&
    (init?.body === undefined || typeof init.body === "string")
  ) {
    const newAccessToken = await refreshAccessTokenOnce();
    if (!newAccessToken) {
      return response;
    }

    const retryHeaders = new Headers(init?.headers);
    retryHeaders.set("Authorization", `Bearer ${newAccessToken}`);
    return fetch(input, { ...init, headers: retryHeaders });
  }

  return response;
}
