create extension if not exists pgcrypto;

create table if not exists public.sectors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  display_name text not null,
  photo_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  device_code text not null unique,
  name text not null,
  sector_id uuid not null references public.sectors(id),
  token_hash text not null,
  active boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.device_button_assignments (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id),
  input_number integer not null,
  employee_id uuid not null references public.employees(id),
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  created_at timestamptz not null default now(),
  constraint valid_range check (valid_to is null or valid_to > valid_from)
);

create unique index if not exists device_button_assignments_active_uidx
  on public.device_button_assignments(device_id, input_number)
  where valid_to is null;

create index if not exists device_button_assignments_lookup_idx
  on public.device_button_assignments(device_id, input_number, valid_from, valid_to);

create table if not exists public.production_events (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique,
  device_id uuid not null references public.devices(id),
  input_number integer not null,
  employee_id uuid not null references public.employees(id),
  sector_id uuid not null references public.sectors(id),
  quantity integer not null default 1,
  event_type text not null default 'production_unit',
  status text not null default 'valid' check (status in ('valid', 'cancelled')),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by text,
  cancel_reason text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists production_events_sector_day_idx
  on public.production_events(sector_id, occurred_at)
  where status = 'valid';

create index if not exists production_events_employee_idx
  on public.production_events(employee_id, occurred_at)
  where status = 'valid';

create index if not exists production_events_device_input_cooldown_idx
  on public.production_events(device_id, input_number, occurred_at desc)
  where status = 'valid';

create table if not exists public.sector_live_scoreboard (
  sector_id uuid primary key references public.sectors(id),
  sector_name text not null,
  sector_slug text not null,
  production_day date not null,
  ranking jsonb not null default '[]'::jsonb,
  total_units integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.sectors enable row level security;
alter table public.employees enable row level security;
alter table public.devices enable row level security;
alter table public.device_button_assignments enable row level security;
alter table public.production_events enable row level security;
alter table public.sector_live_scoreboard enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'sector_live_scoreboard'
      and policyname = 'leitura publica do placar ao vivo'
  ) then
    create policy "leitura publica do placar ao vivo"
      on public.sector_live_scoreboard
      for select
      using (true);
  end if;
end
$$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_rel pr
      join pg_publication p on p.oid = pr.prpubid
      where p.pubname = 'supabase_realtime'
        and pr.prrelid = 'public.sector_live_scoreboard'::regclass
    ) then
    alter publication supabase_realtime add table public.sector_live_scoreboard;
  end if;
end
$$;
