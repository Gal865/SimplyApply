type Json = Record<string, unknown> | Array<Record<string, unknown>>;

function connection() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, key } : null;
}

export function supabaseConfigured() {
  return Boolean(connection());
}

export async function supabaseRequest<T = unknown>(path: string, init: RequestInit = {}) {
  const config = connection();
  if (!config) return null;

  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase request failed with ${response.status}`);
  }
  if (response.status === 204) return null;
  return (await response.json()) as T;
}

export function ownerEmail(request: Request) {
  const configuredOwner = process.env.APP_OWNER_EMAIL?.trim().toLowerCase();
  if (configuredOwner) return configuredOwner;

  if (process.env.VERCEL) {
    throw new Error("APP_OWNER_EMAIL must be configured on Vercel.");
  }

  return request.headers.get("oai-authenticated-user-email") || "local-preview@shortlist.app";
}

export async function upsertRows(table: string, rows: Json) {
  return supabaseRequest(table, {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=minimal",
      "Content-Profile": "public",
      "Accept-Profile": "public",
    },
    body: JSON.stringify(rows),
  });
}
