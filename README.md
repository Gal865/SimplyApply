# Shortlist

Shortlist is a private daily job desk. It searches a connected job-data provider for LinkedIn and Indeed listings, ranks them around a saved search profile, and uses OpenRouter to draft a cover letter grounded in resume text.

## Connect the services

1. Copy `.env.example` to `.env.local` and add the server-side values.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Subscribe to JSearch on RapidAPI and add its key as `JSEARCH_API_KEY`.
4. Add an OpenRouter key and the model id you want to use.

The Supabase service-role key and both provider keys must remain server-side. The browser calls only this app's API routes.

## Run locally

```powershell
$env:WRANGLER_LOG_PATH='.wrangler/wrangler.log'
npx.cmd vinext dev
```

The interface uses preview jobs and a safe template letter until the provider keys are connected.
