# Firmware ESP32 - Botoeira de Producao

Firmware Arduino/PlatformIO para o prototipo validado da area de Colagem.

## Hardware (prototipo atual)

- ESP32 DevKit / ESP32-WROOM-32
- Botoeira industrial NA/NO
- 1 botao entre GPIO 27 e GND, `INPUT_PULLUP`

## Escalar para o setor completo

O array `buttons[]` aceita varios GPIOs; para cada botao novo:

1. Acrescente a linha no array (ex.: `{4, HIGH, HIGH, false, 0, 0}`).
2. Cabeie o botao entre esse GPIO e o GND comum.
3. Crie a atribuicao do GPIO para o funcionario em
   `device_button_assignments`, senao a API responde `no_assignment`.

GPIOs seguros no WROOM-32 para botao com pull-up interno:
`4, 5, 13, 14, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33`.
Evite `0, 2, 12, 15` (strapping) e `34-39` (sem pull-up interno).

## Logica preservada

- Debounce local: 50 ms
- Cooldown local: 5 s
- Primeiro clique valido aceito
- Reclique antes de 5 s ignorado
- Novo clique apos 5 s aceito
- Fila em RAM para retry com o mesmo `event_id`

## Configuracao

Edite `production_button.ino`:

- `WIFI_SSID`
- `WIFI_PASSWORD`
- `API_ENDPOINT`
- `DEVICE_ID`
- `DEVICE_TOKEN`
- `ROOT_CA` para validacao TLS em producao

O firmware envia:

```json
{
  "device_id": "esp32-colagem-prototipo-01",
  "device_token": "TOKEN_SECRETO_DO_DISPOSITIVO",
  "input_gpio": 27,
  "event_id": "uuid-v4",
  "occurred_at": "2026-09-03T12:00:00Z"
}
```

O ESP32 nao envia `employee_id`; a API resolve o funcionario ativo no backend.
