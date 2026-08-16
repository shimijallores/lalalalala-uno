# UNO DUEL

UNO DUEL is a realtime two-player UNO table built with Vite, React, TypeScript, Supabase Realtime, and server-validated Edge Function commands. The browser never owns the match state and never receives the opponent's card identities.

## Local Setup

1. Install Node.js 20 or newer.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env.local` and set:

   ```text
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

   Only the public anonymous key belongs in browser configuration. Never put a Supabase service-role key in `.env.local`, Vite code, or `public/`.

4. Run the frontend:

   ```bash
   npm run dev
   ```

If the variables are missing, the app deliberately shows a configuration error and disables room actions. It does not use localStorage as a multiplayer fallback.

## Supabase Project

1. Create a Supabase project.
2. In **Authentication > Providers**, enable **Anonymous sign-ins**.
3. Apply the migration with the Supabase CLI:

   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push
   ```

4. Deploy the Edge Functions:

   ```bash
   supabase functions deploy create-room
   supabase functions deploy join-room
   supabase functions deploy get-game-view
   supabase functions deploy game-command
   ```

5. Set the server-only function secret. Do not expose this value to Vite:

   ```bash
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
   ```

   `SUPABASE_URL` is available to Supabase Functions automatically. The Edge Functions use the service role only on the server to read private state and commit an already validated command.

## Realtime and Security

The migration enables RLS and grants browser roles no direct table access. It also adds Realtime policies for private `room:{roomId}` and `player:{userId}` channels. The `commit_uno_command` security-definer RPC is executable only by `service_role`; it locks the room row, checks membership and expected state version, and records `client_action_id` receipts for idempotency.

The shared room channel broadcasts only a room ID and state version plus ephemeral emoji reactions. Each player channel receives only that player's `PrivateView`. Presence is tracked on `room:{roomId}` with a player key and is used for online/offline status. The migration's policies keep the room channel limited to room members and the player channel limited to the matching authenticated user. Reactions are never stored in the match state and disappear from the UI after three seconds.

The authoritative private state lives in `uno_private_states`. It contains the full draw pile, discard history, both hands, turn state, pending Wild/UNO state, and randomness-derived deal. Clients only receive a sanitized public view plus their own hand and legal actions.

The browser sends every command with:

- authenticated Supabase user ID from the anonymous session
- room ID
- expected state version
- unique `clientActionId`
- only the requested card/color payload

The Edge Function validates the player, turn, ownership, legality, Wild Draw Four restriction, UNO state, room capacity, and rematch state before the RPC commit. Stale commands are rejected and the browser fetches a fresh private view.

## Project Map

- `src/app/App.tsx`: connection, reconnect, command lifecycle, and screen flow
- `src/game/`: platform-neutral client rules, assets, types, and display reducer
- `src/game/emojis.ts`: dynamic emoji asset catalog from `uno-game-assets/emojis/`
- `shared/uno-engine.ts`: pure deck and rule engine shared with Edge Functions
- `src/realtime/SupabaseGateway.ts`: anonymous auth, Functions, Realtime, and Presence
- `src/realtime/MockGateway.ts`: in-memory test gateway only; never selected by production
- `src/components/`: landing, lobby, board, cards, controls, rules, and winner states
- `supabase/migrations/0001_uno_rooms.sql`: locked public/private schema and atomic commit RPC
- `supabase/functions/`: secure room/view/command boundaries
- `uno-game-assets/`: original supplied asset folder, preserved unchanged
- `public/assets/uno/`: served copy of the supplied assets at `/assets/uno/`

## Verification

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Deployment

Build the frontend with `npm run build`, then deploy the generated `dist/` directory to Vercel, Netlify, or another static host. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the host's build environment. Configure the Supabase service-role secret only in Supabase Edge Functions. Never commit `.env.local` or service credentials.
