insert into public.sectors (id, name, slug, active)
values ('fe355274-dcd6-4877-8720-5fa1fba57d93', 'Colagem', 'colagem', true)
on conflict (id) do update
set name = excluded.name,
    slug = excluded.slug,
    active = excluded.active;

insert into public.employees (id, name, display_name, active)
values
  ('4776abfd-e93f-4ce0-a9cf-db43a01de09d', 'Joao', 'Joao', true),
  ('5e8164a0-12e2-4b09-adbf-c9ff675663b1', 'Carlos', 'Carlos', true),
  ('6bcdfed3-881d-452f-9793-99dd369b677e', 'Marcos', 'Marcos', true),
  ('8a06c372-c6a4-4427-b6e5-cb2e817a3aa7', 'Jose', 'Jose', true)
on conflict (id) do update
set name = excluded.name,
    display_name = excluded.display_name,
    active = excluded.active;

insert into public.devices (id, device_code, name, sector_id, token_hash, active)
values
  (
    'abf5ebca-d318-43d1-98ab-0136282aff2e',
    'esp32-colagem-prototipo-01',
    'Prototipo Colagem 01',
    'fe355274-dcd6-4877-8720-5fa1fba57d93',
    encode(digest('TOKEN_SECRETO_DO_DISPOSITIVO', 'sha256'), 'hex'),
    true
  ),
  (
    '937cd6bc-9d54-4f2c-b117-77da1b63f56b',
    'SIMULATOR-COLAGEM',
    'Simulador (dev)',
    'fe355274-dcd6-4877-8720-5fa1fba57d93',
    encode(digest('dev-simulator-token', 'sha256'), 'hex'),
    true
  )
on conflict (device_code) do update
set name = excluded.name,
    sector_id = excluded.sector_id,
    token_hash = excluded.token_hash,
    active = excluded.active;

insert into public.device_button_assignments (
  device_id,
  input_number,
  employee_id,
  valid_from,
  valid_to
)
values
  (
    'abf5ebca-d318-43d1-98ab-0136282aff2e',
    27,
    '4776abfd-e93f-4ce0-a9cf-db43a01de09d',
    now(),
    null
  ),
  (
    '937cd6bc-9d54-4f2c-b117-77da1b63f56b',
    1,
    '4776abfd-e93f-4ce0-a9cf-db43a01de09d',
    now(),
    null
  ),
  (
    '937cd6bc-9d54-4f2c-b117-77da1b63f56b',
    2,
    '5e8164a0-12e2-4b09-adbf-c9ff675663b1',
    now(),
    null
  ),
  (
    '937cd6bc-9d54-4f2c-b117-77da1b63f56b',
    3,
    '6bcdfed3-881d-452f-9793-99dd369b677e',
    now(),
    null
  ),
  (
    '937cd6bc-9d54-4f2c-b117-77da1b63f56b',
    4,
    '8a06c372-c6a4-4427-b6e5-cb2e817a3aa7',
    now(),
    null
  )
on conflict do nothing;

select public.refresh_sector_live_scoreboard(
  'fe355274-dcd6-4877-8720-5fa1fba57d93',
  timezone('America/Fortaleza', now())::date
);
