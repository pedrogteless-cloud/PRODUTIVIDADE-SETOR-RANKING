# Sistema de Gerenciamento de Produtividade Fabril - Colagem

MVP funcional do placar de producao em tempo real da area de Colagem.

## Stack

- Next.js App Router
- React
- TypeScript
- Supabase/Postgres
- Supabase Realtime
- Vercel
- Firmware ESP32 Arduino/PlatformIO

## Funcionalidades do MVP

- API `POST /api/v1/production-events` para eventos do ESP32
- Autenticacao por `device_id` + `device_token`
- Hash SHA-256 do token armazenado no banco
- Idempotencia por `event_id`
- Cooldown server-side de 5 segundos
- Resolucao de funcionario no backend por dispositivo + input
- Placar `/tv/colagem` com atualizacao realtime
- Simulador `/dev/simulator`
- Firmware de producao em `firmware/esp32-production-button`

## Banco Supabase

O projeto Supabase conectado usado durante o desenvolvimento foi:

- `colagem-productivity`
- Project ref: `yyodsupmbyvtoauzvtny`
- Regiao: `sa-east-1`

As tabelas atuais:

- `sectors`
- `employees`
- `devices`
- `device_button_assignments`
- `production_events`
- `sector_live_scoreboard`

O payload externo usa `device_id` e `input_gpio`. No banco estes campos sao persistidos como `devices.device_code` e `input_number`.

## Migrations

As migrations ficam em `supabase/migrations`.

- `20260903170231_0001_init.sql`: schema base observado no projeto Supabase existente.
- `20260903194701_0002_accept_production_event_rpc.sql`: adiciona `assignment_id`, RPC transacional, refresh do placar e grants.

Para aplicar em um projeto novo:

```bash
supabase link --project-ref yyodsupmbyvtoauzvtny
supabase db push
supabase db query < supabase/seeds/seed_colagem.sql
```

Se preferir configurar tokens de teste manualmente:

```sql
update public.devices
set token_hash = encode(digest('dev-simulator-token', 'sha256'), 'hex')
where device_code = 'SIMULATOR-COLAGEM';

update public.devices
set token_hash = encode(digest('TOKEN_SECRETO_DO_DISPOSITIVO', 'sha256'), 'hex')
where device_code = 'esp32-colagem-prototipo-01';
```

Em producao, troque os tokens por valores longos e aleatorios.

## Variaveis de ambiente

Copie `.env.example` para `.env.local` e preencha:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_SIMULATOR_DEVICE_ID=SIMULATOR-COLAGEM
NEXT_PUBLIC_SIMULATOR_DEVICE_TOKEN=dev-simulator-token
NEXT_PUBLIC_SIMULATOR_INPUT_GPIO=1
```

Nunca exponha `SUPABASE_SERVICE_ROLE_KEY` no browser nem em variaveis `NEXT_PUBLIC_`.

## Rodar local

```bash
npm install
npm run dev
```

Abra:

- TV: `http://localhost:3000/tv/colagem`
- Simulador: `http://localhost:3000/dev/simulator`

## Testes manuais da API

Evento valido:

```bash
curl -i http://localhost:3000/api/v1/production-events \
  -H 'Content-Type: application/json' \
  -d '{
    "device_id": "SIMULATOR-COLAGEM",
    "device_token": "dev-simulator-token",
    "input_gpio": 1,
    "event_id": "11111111-1111-4111-8111-111111111111",
    "occurred_at": "2026-09-03T12:00:00Z"
  }'
```

Mesmo `event_id` novamente deve retornar `duplicate`.

Outro `event_id` no mesmo input antes de 5 segundos deve retornar `cooldown`.

Token invalido deve retornar `unauthorized`.

Input sem atribuicao deve retornar `no_assignment`.

## ESP32

O firmware fica em:

```text
firmware/esp32-production-button
```

Ele preserva a logica fisica validada:

- GPIO 27
- `INPUT_PULLUP`
- Debounce 50 ms
- Cooldown 5 s
- UUID por evento
- Mesmo UUID em retries
- Fila em RAM
- Watchdog
- Base preparada para multiplos botoes

Antes de gravar no ESP32, edite no firmware:

- Wi-Fi
- `API_ENDPOINT`
- `DEVICE_ID`
- `DEVICE_TOKEN`
- `ROOT_CA`

O ESP32 nunca envia `employee_id`; a associacao fica no backend.
