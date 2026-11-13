-- Peak Link Groups. Run this once in the Supabase SQL editor before using group rooms.
-- Every statement is safe to run again.

-- Which accounts have Groups turned on, and their limits.
-- Nobody can write to this table from the browser: there is a "read your own row"
-- policy and nothing else, so rows are only added here (or later by Stripe).
create table if not exists group_plans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  max_rooms integer not null default 1,
  max_participants integer not null default 12,
  created_at timestamptz not null default now()
);

alter table group_plans enable row level security;

drop policy if exists "Users see only their own group plan" on group_plans;
create policy "Users see only their own group plan"
  on group_plans for select
  using (auth.uid() = user_id);

-- One row per standing group room. The link is https://app.getpeaklink.com/meet/<slug>.
create table if not exists group_rooms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null unique,
  daily_room_name text not null unique,
  room_url text not null,
  max_participants integer not null default 12,
  created_at timestamptz not null default now()
);

alter table group_rooms enable row level security;

drop policy if exists "Users see only their own group rooms" on group_rooms;
create policy "Users see only their own group rooms"
  on group_rooms for select
  using (auth.uid() = user_id);

-- To turn Groups on for one account, run the line below with that account's
-- sign-in email. Delete the row again to turn it off (their room stops admitting people).
--
-- insert into group_plans (user_id)
--   select id from auth.users where email = 'you@example.com'
--   on conflict (user_id) do nothing;
