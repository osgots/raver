# Raver — Vercel deployment

## Fastest method (Vercel CLI)

1. Extract this project folder.
2. Open PowerShell/Terminal inside the extracted `raver-live` folder.
3. Make sure Node.js 20+ is installed:
   `node -v`
4. Install Vercel CLI:
   `npm install -g vercel`
5. Login:
   `vercel login`
6. Deploy and create/link the project:
   `vercel`
   - Set up and deploy? **Y**
   - Scope: choose your account
   - Link to existing project? **N** (unless you already created Raver)
   - Project name: **raver**
   - Directory: **./**
   - Modify settings? **N**
7. Open Vercel Dashboard → project **raver** → Settings → Security.
8. Enable **Secure Backend Access with OIDC Federation** if it is not already enabled.
9. Open the Vercel **AI Gateway** dashboard once and ensure AI Gateway is available for the same account/project.
10. Deploy production:
    `vercel --prod`

If the project name `raver` is available, the production URL will be:
`https://raver.vercel.app`

## Test the real AI

After production deploy:
1. Open the production URL.
2. Open Raver Customer Service → AI Support.
3. Ask: `What is this site for?`
4. Then ask a follow-up such as: `Who can see phone numbers?`

The second reply should use the first message as conversation context. If the endpoint reports AI is unavailable, verify OIDC under Project Settings → Security and inspect the Function log for `/api/support`.

## Local AI development

Plainly opening `index.html` is not a Vercel server, so `/api/support` cannot run locally by itself.

For a proper local preview:
1. In the project folder run `vercel link`.
2. Run `vercel env pull` to pull the temporary OIDC development token.
3. Run `vercel dev`.
4. Open the localhost URL printed by Vercel.

Alternatively create an AI Gateway API key in Vercel and store it only in `.env.local` as:
`AI_GATEWAY_API_KEY=...`
Never paste that key into `index.html`.
