-- Mahjong Scorer schema.
--
-- Balances are never stored as a mutable running total that the app increments.
-- Every round writes one immutable transaction row per player, and a balance is
-- the sum of a player's transactions. `game_player_balances` exposes that sum so
-- the scoreboard is a single cheap read, and `reconcile_game` re-derives the
-- cached column if it ever drifts.
--
-- Run this once in the Supabase SQL editor.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- players ---

create table if not exists players (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  color        text not null default '#e9b949',
  created_at   timestamptz not null default now()
);

create unique index if not exists players_name_key on players (lower(name));

-- ------------------------------------------------------------------ games ---

create type game_status as enum ('active', 'finished');

create table if not exists games (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  rule_set_id       text not null default 'mcr',
  starting_balance  integer not null default 0,
  point_value       numeric not null default 1,
  status            game_status not null default 'active',
  prevalent_wind    text not null default 'east',
  dealer_seat       smallint not null default 0,
  round_number      integer not null default 1,
  -- Hand within the 16-hand game, 1 to 16. Drives seat rotation and the
  -- round wind; see src/engine/setup.ts.
  hand_number       integer not null default 1,
  -- Dice throws and break point for the hand about to be played.
  wall              jsonb,
  -- Points a hand must reach to be declared. The guide plays 8 for tournaments;
  -- home games usually play 0 or 1, so the default is 0.
  minimum_points    integer not null default 0,
  -- How this table throws for and counts the wall break: {throws, countFrom}.
  wall_rules        jsonb not null default '{"throws": 2, "countFrom": "right"}'::jsonb,
  -- Tiles each seat has entered for the hand in progress, keyed by seat number.
  -- Cleared when the hand advances.
  drafts            jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  ended_at          timestamptz
);

create table if not exists game_players (
  game_id      uuid not null references games (id) on delete cascade,
  player_id    uuid not null references players (id) on delete restrict,
  seat         smallint not null,
  seat_wind    text not null,
  cached_balance integer not null default 0,
  primary key (game_id, player_id)
);

create unique index if not exists game_players_seat_key on game_players (game_id, seat);

-- ----------------------------------------------------------------- rounds ---

create table if not exists rounds (
  id                  uuid primary key default gen_random_uuid(),
  game_id             uuid not null references games (id) on delete cascade,
  round_number        integer not null,
  prevalent_wind      text not null,
  dealer_seat         smallint not null,
  outcome             text not null default 'win',   -- win | draw
  winner_player_id    uuid references players (id),
  discarder_player_id uuid references players (id),
  self_draw           boolean not null default false,
  hand_points         integer not null default 0,
  bonus_points        integer not null default 0,
  total_points        integer not null default 0,
  -- The exact HandInput that was scored, so a round can be re-scored later.
  hand                jsonb,
  -- The ScoreBreakdown, kept verbatim so history shows the original reasoning
  -- even after the rule table changes.
  score               jsonb,
  payment             jsonb,
  photo_path          text,
  source              text not null default 'manual', -- manual | photo
  created_at          timestamptz not null default now(),
  voided_at           timestamptz,
  void_reason         text
);

create index if not exists rounds_game_idx on rounds (game_id, round_number desc);

-- ----------------------------------------------------------- transactions ---

create table if not exists transactions (
  id               uuid primary key default gen_random_uuid(),
  game_id          uuid not null references games (id) on delete cascade,
  round_id         uuid references rounds (id) on delete cascade,
  player_id        uuid not null references players (id) on delete restrict,
  amount           integer not null,
  transaction_type text not null,   -- win | payment | base | adjustment | reversal | opening
  created_at       timestamptz not null default now(),
  metadata         jsonb not null default '{}'::jsonb
);

create index if not exists transactions_game_idx on transactions (game_id, created_at);
create index if not exists transactions_player_idx on transactions (game_id, player_id);

-- --------------------------------------------------------------- balances ---

create or replace view game_player_balances as
select
  gp.game_id,
  gp.player_id,
  gp.seat,
  gp.seat_wind,
  p.name,
  p.color,
  g.starting_balance + coalesce(sum(t.amount), 0) as balance
from game_players gp
join games g on g.id = gp.game_id
join players p on p.id = gp.player_id
left join transactions t
  on t.game_id = gp.game_id and t.player_id = gp.player_id
group by gp.game_id, gp.player_id, gp.seat, gp.seat_wind, p.name, p.color, g.starting_balance;

-- Re-derives every cached balance for one game from the ledger.
create or replace function reconcile_game(p_game_id uuid)
returns void language sql as $$
  update game_players gp
  set cached_balance = b.balance
  from game_player_balances b
  where b.game_id = gp.game_id
    and b.player_id = gp.player_id
    and gp.game_id = p_game_id;
$$;

-- Voiding a round reverses its transactions instead of deleting them, so the
-- audit trail keeps both the original entry and the correction.
create or replace function void_round(p_round_id uuid, p_reason text)
returns void language plpgsql as $$
declare
  v_game uuid;
begin
  select game_id into v_game from rounds where id = p_round_id;
  if v_game is null then
    raise exception 'Round % does not exist', p_round_id;
  end if;

  insert into transactions (game_id, round_id, player_id, amount, transaction_type, metadata)
  select game_id, round_id, player_id, -amount, 'reversal',
         jsonb_build_object('reverses', id, 'reason', p_reason)
  from transactions
  where round_id = p_round_id and transaction_type <> 'reversal';

  update rounds set voided_at = now(), void_reason = p_reason where id = p_round_id;
  perform reconcile_game(v_game);
end;
$$;

-- ------------------------------------------------------------------- rls ---
-- The app has no user accounts: it is used by four people around one table and
-- authenticates with the anon key. These policies keep the tables open to that
-- key. Tighten them if you ever add sign-in.

alter table players       enable row level security;
alter table games         enable row level security;
alter table game_players  enable row level security;
alter table rounds        enable row level security;
alter table transactions  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['players', 'games', 'game_players', 'rounds', 'transactions'] loop
    execute format('drop policy if exists anon_all on %I', t);
    execute format(
      'create policy anon_all on %I for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- realtime --

-- Added after the first release; safe to run on an existing project.
alter table games add column if not exists hand_number integer not null default 1;
alter table games add column if not exists wall jsonb;
alter table games add column if not exists minimum_points integer not null default 0;
alter table games add column if not exists wall_rules jsonb not null
  default '{"throws": 2, "countFrom": "right"}'::jsonb;
alter table games add column if not exists drafts jsonb not null default '{}'::jsonb;

alter publication supabase_realtime add table rounds;
alter publication supabase_realtime add table transactions;
alter publication supabase_realtime add table game_players;
alter publication supabase_realtime add table games;

-- ---------------------------------------------------------------- storage --
-- Hand photos. Public-read so the round history can show them without signed
-- URLs; the app never puts anything but tile photos in this bucket.

insert into storage.buckets (id, name, public)
values ('hands', 'hands', true)
on conflict (id) do nothing;

drop policy if exists hands_read on storage.objects;
create policy hands_read on storage.objects
  for select to anon, authenticated using (bucket_id = 'hands');

drop policy if exists hands_write on storage.objects;
create policy hands_write on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'hands');
