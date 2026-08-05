-- Global Digital Ranking CRM schema
-- Run this once in Supabase Dashboard > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  email text not null,
  company text not null,
  website text not null,
  service text not null,
  message text,
  status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'proposal', 'won', 'lost')),
  priority text not null default 'warm' check (priority in ('hot', 'warm', 'cold')),
  notes text,
  next_follow_up date,
  last_contacted_at timestamptz,
  source text not null default 'website',
  consent boolean not null default false
);

alter table public.leads add column if not exists consent boolean not null default false;

create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_status_idx on public.leads (status);
create index if not exists leads_priority_idx on public.leads (priority);

alter table public.leads enable row level security;

-- The Vercel API uses the service-role key server-side, so no public table policy is needed.
-- Do not expose the service-role key in browser code.

create or replace function public.touch_lead_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists leads_updated_at on public.leads;
create trigger leads_updated_at
before update on public.leads
for each row execute function public.touch_lead_updated_at();
