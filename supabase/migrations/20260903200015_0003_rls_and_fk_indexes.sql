create index if not exists device_button_assignments_employee_idx
  on public.device_button_assignments(employee_id);

create index if not exists devices_sector_idx
  on public.devices(sector_id);

create index if not exists production_events_assignment_idx
  on public.production_events(assignment_id);

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'sectors'
      and policyname = 'bloqueia acesso publico a setores'
  ) then
    create policy "bloqueia acesso publico a setores"
      on public.sectors
      for all
      using (false)
      with check (false);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'employees'
      and policyname = 'bloqueia acesso publico a funcionarios'
  ) then
    create policy "bloqueia acesso publico a funcionarios"
      on public.employees
      for all
      using (false)
      with check (false);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'devices'
      and policyname = 'bloqueia acesso publico a dispositivos'
  ) then
    create policy "bloqueia acesso publico a dispositivos"
      on public.devices
      for all
      using (false)
      with check (false);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'device_button_assignments'
      and policyname = 'bloqueia acesso publico a atribuicoes'
  ) then
    create policy "bloqueia acesso publico a atribuicoes"
      on public.device_button_assignments
      for all
      using (false)
      with check (false);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'production_events'
      and policyname = 'bloqueia acesso publico a eventos'
  ) then
    create policy "bloqueia acesso publico a eventos"
      on public.production_events
      for all
      using (false)
      with check (false);
  end if;
end
$$;
