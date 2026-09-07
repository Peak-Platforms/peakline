-- Run this in the Supabase SQL editor once, before first use.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tier text not null default 'basic', -- 'basic' (10 calls/mo) or 'unlimited'
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Users see only their own profile"
  on profiles for select
  using (auth.uid() = id);

-- Auto-create a Basic-tier profile row the moment someone signs up
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, tier) values (new.id, 'basic');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

create table if not exists calls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_name text not null,
  room_url text not null,
  created_at timestamptz not null default now()
);

alter table calls enable row level security;

-- Each professional can only see their own call history
create policy "Users see only their own calls"
  on calls for select
  using (auth.uid() = user_id);

-- Each professional can only insert calls under their own account
create policy "Users insert only their own calls"
  on calls for insert
  with check (auth.uid() = user_id);
