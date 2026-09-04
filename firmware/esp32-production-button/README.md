# Firmware ESP32 - Botoeira de Producao

Firmware Arduino/PlatformIO para o prototipo validado da area de Colagem.

## Hardware

- ESP32 DevKit / ESP32-WROOM-32
- Botoeira industrial NA/NO, uma por pessoa
- 9 botoes, cada um entre um GPIO e GND (`INPUT_PULLUP`):
  `4, 5, 13, 14, 16, 17, 18, 19, 27`
- Cada `input_gpio` recebido pela API precisa ter uma atribuicao ativa em
  `device_button_assignments` para o dispositivo `esp32-colagem-prototipo-01`,
  senao a API responde `no_assignment`.

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
