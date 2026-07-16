import { supabaseConfigured } from "../../../lib/supabase-rest";

export async function GET() {
  return Response.json({
    supabase: supabaseConfigured(),
    jobs: Boolean(process.env.JSEARCH_API_KEY),
    openrouter: Boolean(process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_MODEL),
    automation: false,
  });
}
