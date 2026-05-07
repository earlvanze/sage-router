-- Incremental self-serve SaaS tables for Sage Router hosted accounts.
-- Secrets are not stored here. Generated API keys must be stored only as hashes.

create table if not exists public.sage_router_customers (
  id text primary key,
  user_id text not null unique,
  email text,
  plan text not null default 'free',
  status text not null default 'inactive',
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at_epoch bigint not null,
  updated_at_epoch bigint not null
);

create index if not exists sage_router_customers_stripe_customer_idx
  on public.sage_router_customers (stripe_customer_id)
  where stripe_customer_id is not null;

create table if not exists public.sage_router_api_keys (
  id text primary key,
  customer_id text not null references public.sage_router_customers(id) on delete cascade,
  user_id text not null,
  name text not null default 'Default',
  prefix text not null,
  api_key_hash text not null unique,
  status text not null default 'active',
  plan text,
  created_at_epoch bigint not null,
  last_used_at_epoch bigint,
  revoked_at_epoch bigint
);

create index if not exists sage_router_api_keys_customer_idx
  on public.sage_router_api_keys (customer_id, created_at_epoch desc);

create table if not exists public.sage_router_payment_intents (
  id text primary key,
  kind text not null,
  customer_id text references public.sage_router_customers(id) on delete set null,
  user_id text,
  status text not null default 'pending',
  asset text,
  network text,
  amount text,
  address text,
  metadata jsonb not null default '{}'::jsonb,
  event_type text,
  event_id text,
  created_at_epoch bigint not null,
  updated_at_epoch bigint not null
);

alter table public.sage_router_customers enable row level security;
alter table public.sage_router_api_keys enable row level security;
alter table public.sage_router_payment_intents enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='sage_router_customers' and policyname='service role manages sage router customers') then
    create policy "service role manages sage router customers" on public.sage_router_customers for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='sage_router_api_keys' and policyname='service role manages sage router api keys') then
    create policy "service role manages sage router api keys" on public.sage_router_api_keys for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='sage_router_payment_intents' and policyname='service role manages sage router payment intents') then
    create policy "service role manages sage router payment intents" on public.sage_router_payment_intents for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
  end if;
end $$;
