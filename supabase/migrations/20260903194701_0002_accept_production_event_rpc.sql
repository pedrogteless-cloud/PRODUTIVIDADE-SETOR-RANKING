alter table public.production_events
  add column if not exists assignment_id uuid references public.device_button_assignments(id);

create index if not exists production_events_assignment_cooldown_idx
  on public.production_events(device_id, input_number, assignment_id, occurred_at desc)
  where status = 'valid';

create or replace function public.refresh_sector_live_scoreboard(
  p_sector_id uuid,
  p_day date default timezone('America/Fortaleza', now())::date
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_start timestamptz;
  v_end timestamptz;
begin
  v_start := p_day::timestamp at time zone 'America/Fortaleza';
  v_end := (p_day + 1)::timestamp at time zone 'America/Fortaleza';

  with assigned_employees as (
    select distinct e.id, e.display_name, e.photo_url
    from public.employees e
    join public.device_button_assignments a on a.employee_id = e.id
    join public.devices d on d.id = a.device_id
    where d.sector_id = p_sector_id
      and d.active = true
      and e.active = true
      and a.valid_to is null
  ),
  counts as (
    select pe.employee_id, coalesce(sum(pe.quantity), 0)::integer as units
    from public.production_events pe
    where pe.sector_id = p_sector_id
      and pe.status = 'valid'
      and pe.occurred_at >= v_start
      and pe.occurred_at < v_end
    group by pe.employee_id
  ),
  ranked as (
    select
      ae.id as employee_id,
      ae.display_name,
      ae.photo_url,
      coalesce(c.units, 0)::integer as units,
      row_number() over (
        order by coalesce(c.units, 0) desc, ae.display_name asc
      )::integer as position
    from assigned_employees ae
    left join counts c on c.employee_id = ae.id
  )
  insert into public.sector_live_scoreboard (
    sector_id,
    sector_name,
    sector_slug,
    production_day,
    ranking,
    total_units,
    updated_at
  )
  select
    s.id,
    s.name,
    s.slug,
    p_day,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'employee_id', ranked.employee_id,
            'display_name', ranked.display_name,
            'photo_url', ranked.photo_url,
            'units', ranked.units,
            'position', ranked.position
          )
          order by ranked.position
        )
        from ranked
      ),
      '[]'::jsonb
    ),
    coalesce((select sum(ranked.units)::integer from ranked), 0),
    now()
  from public.sectors s
  where s.id = p_sector_id
  on conflict (sector_id) do update
    set sector_name = excluded.sector_name,
        sector_slug = excluded.sector_slug,
        production_day = excluded.production_day,
        ranking = excluded.ranking,
        total_units = excluded.total_units,
        updated_at = excluded.updated_at;
end;
$$;

create or replace function public.accept_production_event(
  p_device_code text,
  p_token_hash text,
  p_input_number integer,
  p_event_id uuid,
  p_occurred_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_assignment record;
  v_day date;
  v_device record;
  v_existing record;
  v_inserted record;
  v_last record;
  v_retry_after integer;
begin
  select
    d.id,
    d.device_code,
    d.name,
    d.sector_id,
    d.token_hash,
    s.name as sector_name,
    s.slug as sector_slug
  into v_device
  from public.devices d
  join public.sectors s on s.id = d.sector_id
  where d.device_code = p_device_code
    and d.active = true
    and s.active = true;

  if v_device.id is null or v_device.token_hash <> p_token_hash then
    return jsonb_build_object(
      'status', 'unauthorized',
      'message', 'Dispositivo ou token invalido.'
    );
  end if;

  select pe.*
  into v_existing
  from public.production_events pe
  where pe.event_id = p_event_id
  limit 1;

  if v_existing.id is not null then
    return jsonb_build_object(
      'status', 'duplicate',
      'message', 'Evento ja recebido anteriormente.',
      'event', jsonb_build_object(
        'event_id', v_existing.event_id,
        'device_id', v_device.device_code,
        'input_gpio', v_existing.input_number,
        'employee_id', v_existing.employee_id,
        'sector_id', v_existing.sector_id,
        'sector_name', v_device.sector_name,
        'occurred_at', v_existing.occurred_at
      )
    );
  end if;

  select
    a.id as assignment_id,
    a.employee_id,
    e.display_name as employee_name
  into v_assignment
  from public.device_button_assignments a
  join public.employees e on e.id = a.employee_id
  where a.device_id = v_device.id
    and a.input_number = p_input_number
    and a.valid_from <= p_occurred_at
    and (a.valid_to is null or a.valid_to > p_occurred_at)
    and e.active = true
  order by a.valid_from desc
  limit 1;

  if v_assignment.assignment_id is null then
    return jsonb_build_object(
      'status', 'no_assignment',
      'message', 'Nenhum funcionario ativo associado a este input.'
    );
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      v_device.id::text || ':' || p_input_number::text || ':' || v_assignment.assignment_id::text,
      0
    )
  );

  select pe.*
  into v_existing
  from public.production_events pe
  where pe.event_id = p_event_id
  limit 1;

  if v_existing.id is not null then
    return jsonb_build_object(
      'status', 'duplicate',
      'message', 'Evento ja recebido anteriormente.',
      'event', jsonb_build_object(
        'event_id', v_existing.event_id,
        'device_id', v_device.device_code,
        'input_gpio', v_existing.input_number,
        'employee_id', v_existing.employee_id,
        'employee_name', v_assignment.employee_name,
        'sector_id', v_existing.sector_id,
        'sector_name', v_device.sector_name,
        'occurred_at', v_existing.occurred_at
      )
    );
  end if;

  select pe.occurred_at
  into v_last
  from public.production_events pe
  where pe.device_id = v_device.id
    and pe.input_number = p_input_number
    and pe.status = 'valid'
    and pe.occurred_at <= p_occurred_at
    and pe.occurred_at > p_occurred_at - interval '5 seconds'
    and (
      pe.assignment_id = v_assignment.assignment_id
      or (
        pe.assignment_id is null
        and pe.employee_id = v_assignment.employee_id
      )
    )
  order by pe.occurred_at desc
  limit 1;

  if v_last.occurred_at is not null then
    v_retry_after := greatest(
      1,
      ceil(5 - extract(epoch from (p_occurred_at - v_last.occurred_at)))::integer
    );

    return jsonb_build_object(
      'status', 'cooldown',
      'message', 'Clique ignorado pelo cooldown de 5 segundos.',
      'cooldown', jsonb_build_object(
        'seconds', 5,
        'retry_after_seconds', v_retry_after,
        'last_event_at', v_last.occurred_at
      )
    );
  end if;

  insert into public.production_events (
    event_id,
    device_id,
    input_number,
    employee_id,
    sector_id,
    assignment_id,
    quantity,
    event_type,
    status,
    occurred_at,
    metadata
  )
  values (
    p_event_id,
    v_device.id,
    p_input_number,
    v_assignment.employee_id,
    v_device.sector_id,
    v_assignment.assignment_id,
    1,
    'production_unit',
    'valid',
    p_occurred_at,
    jsonb_build_object('source', 'api_v1', 'device_code', v_device.device_code)
  )
  on conflict (event_id) do nothing
  returning *
  into v_inserted;

  if v_inserted.id is null then
    select pe.*
    into v_existing
    from public.production_events pe
    where pe.event_id = p_event_id
    limit 1;

    return jsonb_build_object(
      'status', 'duplicate',
      'message', 'Evento ja recebido anteriormente.',
      'event', jsonb_build_object(
        'event_id', v_existing.event_id,
        'device_id', v_device.device_code,
        'input_gpio', v_existing.input_number,
        'employee_id', v_existing.employee_id,
        'employee_name', v_assignment.employee_name,
        'sector_id', v_existing.sector_id,
        'sector_name', v_device.sector_name,
        'occurred_at', v_existing.occurred_at
      )
    );
  end if;

  update public.devices
  set last_seen_at = now()
  where id = v_device.id;

  v_day := timezone('America/Fortaleza', p_occurred_at)::date;
  perform public.refresh_sector_live_scoreboard(v_device.sector_id, v_day);

  return jsonb_build_object(
    'status', 'accepted',
    'message', 'Evento aceito.',
    'event', jsonb_build_object(
      'event_id', v_inserted.event_id,
      'device_id', v_device.device_code,
      'input_gpio', v_inserted.input_number,
      'employee_id', v_assignment.employee_id,
      'employee_name', v_assignment.employee_name,
      'sector_id', v_device.sector_id,
      'sector_name', v_device.sector_name,
      'occurred_at', v_inserted.occurred_at
    )
  );
end;
$$;

revoke execute on function public.refresh_sector_live_scoreboard(uuid, date) from public, anon, authenticated;
revoke execute on function public.accept_production_event(text, text, integer, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.refresh_sector_live_scoreboard(uuid, date) to service_role;
grant execute on function public.accept_production_event(text, text, integer, uuid, timestamptz) to service_role;

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
