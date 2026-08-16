create extension if not exists pgcrypto;

do $$ begin
  create type public.uno_room_status as enum ('waiting', 'active', 'finished');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.uno_rooms (
  id uuid primary key default gen_random_uuid(),
  room_code text not null unique check (room_code ~ '^[A-Z2-9]{6,8}$'),
  host_player_id uuid not null,
  status public.uno_room_status not null default 'waiting',
  state_version integer not null default 1,
  current_player_id uuid,
  current_color text,
  top_discard jsonb,
  draw_pile_count integer not null default 0,
  scores jsonb not null default '{}'::jsonb,
  turn_phase text not null default 'waiting',
  last_action jsonb,
  rematch_requested_by uuid,
  opponent_disconnected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.uno_room_players (
  room_id uuid not null references public.uno_rooms(id) on delete cascade,
  player_id uuid not null,
  display_name text not null check (char_length(display_name) between 1 and 20),
  slot smallint not null check (slot in (1, 2)),
  is_host boolean not null default false,
  is_online boolean not null default true,
  rematch_accepted boolean not null default false,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (room_id, player_id),
  unique (room_id, slot)
);

create table if not exists public.uno_private_states (
  room_id uuid primary key references public.uno_rooms(id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.uno_command_receipts (
  room_id uuid not null references public.uno_rooms(id) on delete cascade,
  player_id uuid not null,
  client_action_id uuid not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key (room_id, player_id, client_action_id)
);

create index if not exists uno_rooms_code_idx on public.uno_rooms(room_code);
create index if not exists uno_room_players_player_idx on public.uno_room_players(player_id);

alter table public.uno_rooms enable row level security;
alter table public.uno_room_players enable row level security;
alter table public.uno_private_states enable row level security;
alter table public.uno_command_receipts enable row level security;

-- All reads and writes go through the authenticated Edge Functions. No browser role
-- can select the private state or mutate the public room row directly.
revoke all on public.uno_rooms from anon, authenticated;
revoke all on public.uno_room_players from anon, authenticated;
revoke all on public.uno_private_states from anon, authenticated;
revoke all on public.uno_command_receipts from anon, authenticated;

create or replace function public.is_uno_room_member(topic text, member_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.uno_room_players
    where room_id = nullif(split_part(topic, ':', 2), '')::uuid
      and player_id = member_id
  );
$$;

revoke all on function public.is_uno_room_member(text, uuid) from public, anon;
grant execute on function public.is_uno_room_member(text, uuid) to authenticated;

-- Realtime payloads are private channels. A room member may receive the
-- sanitized room update; a player may receive only their own private view.
create policy "UNO members can receive room updates"
on realtime.messages for select
to authenticated
using (
  realtime.topic() like 'room:%'
  and public.is_uno_room_member(realtime.topic(), auth.uid())
);

create policy "UNO players can receive their own private view"
on realtime.messages for select
to authenticated
using (realtime.topic() = 'player:' || auth.uid()::text);

create or replace function public.commit_uno_command(
  p_room_id uuid,
  p_player_id uuid,
  p_expected_version integer,
  p_client_action_id uuid,
  p_private_state jsonb,
  p_public_view jsonb,
  p_private_view jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_room public.uno_rooms;
  existing_response jsonb;
begin
  select response into existing_response
  from public.uno_command_receipts
  where room_id = p_room_id
    and player_id = p_player_id
    and client_action_id = p_client_action_id;

  if existing_response is not null then
    return existing_response;
  end if;

  select * into current_room
  from public.uno_rooms
  where id = p_room_id
  for update;

  if current_room.id is null then
    return jsonb_build_object('error', true, 'code', 'room_not_found', 'message', 'That room is no longer available.');
  end if;

  if not exists (
    select 1 from public.uno_room_players
    where room_id = p_room_id and player_id = p_player_id
  ) then
    return jsonb_build_object('error', true, 'code', 'not_a_player', 'message', 'You are not a player in this room.');
  end if;

  if current_room.state_version <> p_expected_version then
    return jsonb_build_object('error', true, 'code', 'stale_version', 'stateVersion', current_room.state_version, 'message', 'This table changed while you were playing.');
  end if;

  update public.uno_private_states
  set state = p_private_state, updated_at = now()
  where room_id = p_room_id;

  update public.uno_rooms
  set status = (p_public_view->>'status')::public.uno_room_status,
      state_version = current_room.state_version + 1,
      current_player_id = nullif(p_public_view->>'currentPlayerId', '')::uuid,
      current_color = nullif(p_public_view->>'currentColor', ''),
      top_discard = p_public_view->'topDiscard',
      draw_pile_count = coalesce((p_public_view->>'drawPileCount')::integer, 0),
      scores = coalesce(p_public_view->'scores', '{}'::jsonb),
      turn_phase = coalesce(p_public_view->>'turnPhase', 'playing'),
      last_action = p_public_view->'lastAction',
      rematch_requested_by = nullif(p_public_view->>'rematchRequestedBy', '')::uuid,
      opponent_disconnected_at = nullif(p_public_view->>'opponentDisconnectedAt', '')::timestamptz,
      updated_at = now()
  where id = p_room_id;

  insert into public.uno_command_receipts(room_id, player_id, client_action_id, response)
  values (p_room_id, p_player_id, p_client_action_id, p_private_view);

  return p_private_view;
end;
$$;

revoke all on function public.commit_uno_command(uuid, uuid, integer, uuid, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.commit_uno_command(uuid, uuid, integer, uuid, jsonb, jsonb, jsonb) to service_role;
