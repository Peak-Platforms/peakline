-- Run this once in the Supabase SQL editor before turning on the Starter plan.
-- Every statement is safe to run again.

-- profiles.tier can now be 'basic' (3 calls/mo), 'starter' (200 min/mo) or 'unlimited'.
alter table profiles add column if not exists stripe_customer_id text;
alter table profiles add column if not exists stripe_subscription_id text;

-- Saved call length, filled in once a call has ended (used for Starter minutes).
alter table calls add column if not exists daily_room_name text;
alter table calls add column if not exists duration_seconds integer;
