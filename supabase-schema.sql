-- Run this in your Supabase SQL editor

create extension if not exists "uuid-ossp";

-- Rooms table
create table if not exists rooms (
  id uuid primary key default uuid_generate_v4(),
  code text unique not null,
  host_id text not null,
  status text not null default 'waiting', -- waiting | playing | finished
  is_public boolean default true,
  max_players int default 4,
  turn_timer int default 60,
  timeout_action text default 'skip', -- skip | nothing
  settings jsonb default '{}',
  created_at timestamptz default now()
);

-- Players table
create table if not exists players (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid references rooms(id) on delete cascade,
  player_id text not null,
  nickname text not null,
  score int default 0,
  rack jsonb default '[]',
  is_host boolean default false,
  is_connected boolean default true,
  joined_at timestamptz default now()
);

-- Game state table
create table if not exists game_state (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid references rooms(id) on delete cascade unique,
  board jsonb not null default '{}',
  tile_bag jsonb not null default '[]',
  current_turn text not null default '',
  turn_number int default 0,
  words_played jsonb default '[]',
  updated_at timestamptz default now()
);

-- Moves table (history)
create table if not exists moves (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid references rooms(id) on delete cascade,
  player_id text not null,
  player_nickname text not null,
  word text not null,
  score int not null,
  tiles_placed jsonb not null,
  created_at timestamptz default now()
);

-- Enable Row Level Security
alter table rooms enable row level security;
alter table players enable row level security;
alter table game_state enable row level security;
alter table moves enable row level security;

-- Public access policies (for a game, we allow anon access)
create policy "Public rooms read" on rooms for select using (true);
create policy "Public rooms insert" on rooms for insert with check (true);
create policy "Public rooms update" on rooms for update using (true);

create policy "Public players read" on players for select using (true);
create policy "Public players insert" on players for insert with check (true);
create policy "Public players update" on players for update using (true);
create policy "Public players delete" on players for delete using (true);

create policy "Public game_state read" on game_state for select using (true);
create policy "Public game_state insert" on game_state for insert with check (true);
create policy "Public game_state update" on game_state for update using (true);

create policy "Public moves read" on moves for select using (true);
create policy "Public moves insert" on moves for insert with check (true);

-- Enable realtime on all tables
alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table game_state;
alter publication supabase_realtime add table moves;
