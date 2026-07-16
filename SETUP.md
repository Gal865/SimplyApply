# Connect Shortlist

Shortlist uses server-side environment variables. Never paste a service-role key, job API key, or OpenRouter key into the website itself or commit one to Git.

## 1. Create the Supabase tables

1. Open your Supabase project.
2. Open **SQL Editor** and choose **New query**.
3. Copy all of `supabase/schema.sql` into the editor and run it once.
4. Open **Project Settings → API**.
5. Copy the **Project URL** and the server-only **service_role** key.

Use them as:

```text
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

The service-role key bypasses row-level security. It belongs only in server environment settings.

## 2. Connect the job feed

The current adapter uses JSearch through RapidAPI because LinkedIn and Indeed do not provide unrestricted public job-search APIs.

1. Subscribe to JSearch in RapidAPI.
2. Copy your RapidAPI application key.
3. Save it as:

```text
JSEARCH_API_KEY=YOUR_RAPIDAPI_KEY
```

## 3. Connect OpenRouter

1. Create an API key in OpenRouter under **Settings → Keys**.
2. Choose an OpenRouter model and copy its exact model ID from the model page.
3. Save both values:

```text
OPENROUTER_API_KEY=YOUR_OPENROUTER_KEY
OPENROUTER_MODEL=YOUR_MODEL_ID
```

Cover letters are generated during job refresh, before jobs appear in the interface. Six job results means up to six model calls per refresh.

## 4. Add keys locally

Copy `.env.example` to a new ignored file named `.env.local`, replace the placeholder values, and restart the development server.

## 5. Add keys to the published Sites app

Open the Shortlist project in **Sites**, open its environment-variable settings, and add the same five names and values. Save them as secrets where the interface offers that option, then redeploy the current version.

## What is not active yet

The app refreshes jobs manually. No daily scheduler is installed. Until a real scheduler is added, the interface deliberately says that automation is not connected.
