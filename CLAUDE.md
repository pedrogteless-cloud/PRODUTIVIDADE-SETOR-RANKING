# CLAUDE.md

Guia rápido para trabalhar neste repositório com o Claude Code.

## O que é o projeto

MVP do placar de produtividade fabril em tempo real, setor Colagem (Fase 1A).
Um botão físico (ESP32) registra peças produzidas; a API grava o evento no
Supabase; o placar `/tv/colagem` atualiza sozinho via Supabase Realtime.

Stack: Next.js App Router, React, TypeScript, Supabase/Postgres, Supabase
Realtime, Vercel, firmware ESP32 (Arduino/PlatformIO). Detalhes de setup,
variáveis de ambiente e migrations estão no `README.md`.

## Estrutura principal

- `src/app/api/v1/production-events/route.ts` — recebe eventos do ESP32
  (`device_id` + `device_token`, idempotência por `event_id`, cooldown 5s).
- `src/app/api/v1/scoreboard/route.ts` — fallback HTTP do placar quando não
  há client Supabase no browser.
- `src/app/tv/colagem/page.tsx` + `tv-scoreboard.tsx` — placar ao vivo,
  assina `sector_live_scoreboard` via Supabase Realtime com fallback de
  polling.
- `src/app/dev/simulator/` — simulador de botão físico para testes locais
  sem hardware.
- `src/lib/production/` — normalização de payload, hash de token, escrita
  do evento, leitura do scoreboard.
- `supabase/migrations/` — schema, RPC transacional de evento, RLS/índices.
- `firmware/esp32-production-button/` — firmware do botão físico.

## Status registrado

### Fase 1A validada ponta a ponta (2026-09-04)

Fluxo completo testado rodando local contra o Supabase de produção
(`colagem-productivity`, ref `yyodsupmbyvtoauzvtny`):

```
/dev/simulator -> POST /api/v1/production-events -> Supabase (RPC) ->
Supabase Realtime -> /tv/colagem
```

O ranking em `/tv/colagem` anima sozinho conforme os eventos chegam, sem
recarregar a página. Considerar a Fase 1A (registro de evento + placar
realtime do setor Colagem) funcionalmente completa.

### Bug corrigido: erro de Supabase escondido como "sem dados" em `/tv/colagem`

`tv-scoreboard.tsx` fazia a consulta inicial ao Supabase dentro de um
`try/catch` que tratava **qualquer** falha (erro real de query, ex.:
`Invalid API key`) do mesmo jeito que "ainda não há linha no scoreboard":
setava `status = "aguardando dados"` silenciosamente. Isso escondia
problemas reais de configuração (chave/URL do Supabase erradas, RLS
bloqueando a leitura, etc.) atrás de um estado que parecia só "produção
ainda não começou hoje".

Corrigido para distinguir os três casos e reportar erro de consulta de
forma explícita (log + status visível, não silencioso). Ao mexer nesse
arquivo ou em qualquer tela que leia diretamente do Supabase no browser,
manter essa distinção — nunca tratar erro de query como "vazio".

## Convenções

- Sem testes automatizados ainda; validar localmente com
  `npm run dev` + `/dev/simulator` antes de mexer no fluxo de produção de
  evento ou no placar.
- `npm run typecheck` antes de subir mudanças em TypeScript.
- Nunca expor `SUPABASE_SERVICE_ROLE_KEY` no browser nem em variáveis
  `NEXT_PUBLIC_*`.
