# Deploy Shortlist on Vercel

1. Push this repository to GitHub, GitLab, or Bitbucket and import it in Vercel.
2. Keep the detected framework set to **Next.js**. No custom build or output directory is needed.
3. Add the following environment variables to both Production and Preview:
   - `APP_USERNAME`
   - `APP_PASSWORD`
   - `APP_OWNER_EMAIL`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `JSEARCH_API_KEY`
   - `OPENROUTER_API_KEY`
   - `OPENROUTER_MODEL`
   - `PUBLIC_SITE_URL`
4. Mark passwords and API keys as Sensitive in Vercel.
5. Deploy. The browser will request the private username and password before loading the app.

Use `.env.example` as the variable-name checklist. Never commit `.env` files or the local `supabase/` folder.
