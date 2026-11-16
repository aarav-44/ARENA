# ARENA Tournament App

A responsive Next.js + Supabase sports tournament app with public live scores, a winners page, owner email/password login, database persistence and realtime updates.

## 1. Create the database
1. Create a project at https://supabase.com.
2. Open **SQL Editor** in the Supabase dashboard.
3. Paste and run `supabase/schema.sql`.

## 2. Create the owner account
1. In Supabase, open **Authentication → Users**.
2. Add the owner user with the email and password you want.
3. Copy that user's UUID.
4. In SQL Editor, run `insert into public.arena_owners (user_id) values ('PASTE-OWNER-UUID-HERE');`.
5. Keep public sign-ups disabled. Only add trusted owner IDs to `arena_owners`.

Row-level security checks the owner allowlist, so merely having a Supabase login does not grant editing access.

## 3. Configure the app
1. Copy `.env.example` to `.env.local`.
2. In Supabase **Project Settings → API**, copy the Project URL and anon/public key into `.env.local`.
3. Never put the `service_role` key in a browser app or commit secrets.

## 4. Run locally
Install Node.js 20 or newer, then:
```bash
npm install
npm run dev
```
Open http://localhost:3000.

## 5. Publish it
1. Push this project to a private or public GitHub repository.
2. Import the repository into https://vercel.com.
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as Vercel environment variables.
4. Deploy. Your Vercel URL is the shareable public viewer link.

## Important security note
This starter grants edit access to any authenticated Supabase user. Keep sign-ups disabled and only create the owner account yourself. For production use with multiple staff accounts, implement a database-backed owner allowlist and RLS checks against it. Add rate limits and audit logging if needed.

## Features
- Two-team scoreboard with increment/decrement and reset
- Team and tournament name editing
- Eight sport winner records
- Public read-only viewing
- Owner email/password login
- Persistent Supabase database
- Realtime refresh for viewers
- Responsive layout
