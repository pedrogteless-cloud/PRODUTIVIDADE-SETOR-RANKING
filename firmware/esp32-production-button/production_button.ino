#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <esp_idf_version.h>
#include <esp_task_wdt.h>
#include <time.h>

const char *WIFI_SSID = "SUA_REDE_WIFI";
const char *WIFI_PASSWORD = "SUA_SENHA_WIFI";

const char *API_ENDPOINT =
  "https://SEU_DOMINIO.vercel.app/api/v1/production-events";
const char *DEVICE_ID = "esp32-colagem-prototipo-01";
const char *DEVICE_TOKEN = "TOKEN_SECRETO_DO_DISPOSITIVO";

// Cole aqui o certificado raiz do dominio em producao. Se ficar vazio, o
// firmware usa HTTPS sem validacao do certificado apenas para testes locais.
const char *ROOT_CA = "";

const unsigned long DEBOUNCE_MS = 50;
const unsigned long COOLDOWN_MS = 5000;
const unsigned long WIFI_RETRY_MS = 5000;
const unsigned long SEND_RETRY_BASE_MS = 1200;
const size_t EVENT_QUEUE_SIZE = 24;

struct ButtonInput {
  uint8_t gpio;
  int stableState;
  int lastReading;
  bool hasAcceptedClick;
  unsigned long lastDebounceAt;
  unsigned long lastAcceptedAt;
};

struct QueuedEvent {
  bool used;
  uint8_t inputGpio;
  String eventId;
  String occurredAt;
  uint8_t attempts;
  unsigned long nextTryAt;
};

struct SendResult {
  bool delivered;
  int httpCode;
};

ButtonInput buttons[] = {
  {4, HIGH, HIGH, false, 0, 0},
  {5, HIGH, HIGH, false, 0, 0},
  {13, HIGH, HIGH, false, 0, 0},
  {14, HIGH, HIGH, false, 0, 0},
  {16, HIGH, HIGH, false, 0, 0},
  {17, HIGH, HIGH, false, 0, 0},
  {18, HIGH, HIGH, false, 0, 0},
  {19, HIGH, HIGH, false, 0, 0},
  {27, HIGH, HIGH, false, 0, 0},
};

QueuedEvent eventQueue[EVENT_QUEUE_SIZE];
unsigned long lastWifiAttemptAt = 0;

void setup() {
  Serial.begin(115200);
  delay(300);

  for (ButtonInput &button : buttons) {
    pinMode(button.gpio, INPUT_PULLUP);
    button.stableState = digitalRead(button.gpio);
    button.lastReading = button.stableState;
  }

  setupWatchdog();
  connectWifi();
  setupClock();

  Serial.println("Sistema de produtividade Colagem iniciado.");
  Serial.print(sizeof(buttons) / sizeof(buttons[0]));
  Serial.println(" botoes com INPUT_PULLUP, debounce 50 ms e cooldown 5 s.");
}

void loop() {
  esp_task_wdt_reset();
  maintainWifi();
  readButtons();
  flushQueue();
  delay(5);
}

void setupWatchdog() {
#if ESP_IDF_VERSION_MAJOR >= 5
  esp_task_wdt_config_t config = {};
  config.timeout_ms = 15000;
  config.idle_core_mask = (1 << portNUM_PROCESSORS) - 1;
  config.trigger_panic = true;
  esp_task_wdt_init(&config);
#else
  esp_task_wdt_init(15, true);
#endif
  esp_task_wdt_add(NULL);
}

void connectWifi() {
  if (WiFi.status() == WL_CONNECTED) {
    return;
  }

  Serial.print("Conectando Wi-Fi");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long startAt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startAt < 12000) {
    esp_task_wdt_reset();
    Serial.print(".");
    delay(300);
  }

  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("Wi-Fi conectado: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("Wi-Fi indisponivel. Eventos ficarao em fila RAM.");
  }
}

void maintainWifi() {
  if (WiFi.status() == WL_CONNECTED) {
    return;
  }

  if (millis() - lastWifiAttemptAt < WIFI_RETRY_MS) {
    return;
  }

  lastWifiAttemptAt = millis();
  connectWifi();
}

void setupClock() {
  configTime(0, 0, "pool.ntp.org", "time.google.com", "time.cloudflare.com");

  unsigned long startAt = millis();
  while (!clockReady() && millis() - startAt < 10000) {
    esp_task_wdt_reset();
    delay(200);
  }

  Serial.println(clockReady() ? "Relogio NTP sincronizado." : "Relogio NTP pendente.");
}

bool clockReady() {
  time_t now = time(nullptr);
  return now > 1700000000;
}

void readButtons() {
  const unsigned long nowMs = millis();

  for (ButtonInput &button : buttons) {
    const int reading = digitalRead(button.gpio);

    if (reading != button.lastReading) {
      button.lastDebounceAt = nowMs;
      button.lastReading = reading;
    }

    if ((nowMs - button.lastDebounceAt) <= DEBOUNCE_MS) {
      continue;
    }

    if (reading == button.stableState) {
      continue;
    }

    button.stableState = reading;

    if (button.stableState == LOW) {
      handleButtonPress(button, nowMs);
    }
  }
}

void handleButtonPress(ButtonInput &button, unsigned long nowMs) {
  if (button.hasAcceptedClick && (nowMs - button.lastAcceptedAt) < COOLDOWN_MS) {
    Serial.println("Clique ignorado pelo cooldown local.");
    return;
  }

  button.hasAcceptedClick = true;
  button.lastAcceptedAt = nowMs;

  if (!enqueueEvent(button.gpio)) {
    Serial.println("Fila RAM cheia. Evento descartado.");
    return;
  }

  Serial.print("Clique aceito localmente no GPIO ");
  Serial.println(button.gpio);
}

bool enqueueEvent(uint8_t inputGpio) {
  for (QueuedEvent &event : eventQueue) {
    if (!event.used) {
      event.used = true;
      event.inputGpio = inputGpio;
      event.eventId = generateUuidV4();
      event.occurredAt = isoNowUtc();
      event.attempts = 0;
      event.nextTryAt = 0;
      return true;
    }
  }

  return false;
}

void flushQueue() {
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }

  for (QueuedEvent &event : eventQueue) {
    if (!event.used || millis() < event.nextTryAt) {
      continue;
    }

    if (event.occurredAt == "1970-01-01T00:00:00Z") {
      setupClock();

      if (!clockReady()) {
        event.nextTryAt = millis() + WIFI_RETRY_MS;
        continue;
      }

      event.occurredAt = isoNowUtc();
    }

    SendResult result = sendEvent(event);

    if (result.delivered) {
      event.used = false;
      continue;
    }

    event.attempts++;
    uint8_t exponent = event.attempts;
    if (exponent > 5) {
      exponent = 5;
    }

    unsigned long backoff = SEND_RETRY_BASE_MS;
    for (uint8_t index = 0; index < exponent; index++) {
      backoff *= 2;
    }
    if (backoff > 30000) {
      backoff = 30000;
    }
    event.nextTryAt = millis() + backoff;
  }
}

SendResult sendEvent(const QueuedEvent &event) {
  WiFiClientSecure client;

  if (strlen(ROOT_CA) > 0) {
    client.setCACert(ROOT_CA);
  } else {
    client.setInsecure();
  }

  HTTPClient https;
  if (!https.begin(client, API_ENDPOINT)) {
    return {false, -1};
  }

  https.addHeader("Content-Type", "application/json");
  const String body = buildJsonBody(event);
  const int httpCode = https.POST(body);
  const String response = https.getString();
  https.end();

  Serial.print("Evento ");
  Serial.print(event.eventId);
  Serial.print(" HTTP ");
  Serial.println(httpCode);

  if (response.length() > 0) {
    Serial.println(response);
  }

  if (httpCode == 200 || httpCode == 201 || httpCode == 202) {
    return {true, httpCode};
  }

  if (httpCode == 400 || httpCode == 401 || httpCode == 409) {
    return {true, httpCode};
  }

  return {false, httpCode};
}

String buildJsonBody(const QueuedEvent &event) {
  String body = "{";
  body += "\"device_id\":\"" + String(DEVICE_ID) + "\",";
  body += "\"device_token\":\"" + String(DEVICE_TOKEN) + "\",";
  body += "\"input_gpio\":" + String(event.inputGpio) + ",";
  body += "\"event_id\":\"" + event.eventId + "\",";
  body += "\"occurred_at\":\"" + event.occurredAt + "\"";
  body += "}";
  return body;
}

String isoNowUtc() {
  time_t now = time(nullptr);

  if (!clockReady()) {
    return "1970-01-01T00:00:00Z";
  }

  struct tm timeinfo;
  gmtime_r(&now, &timeinfo);

  char buffer[25];
  strftime(buffer, sizeof(buffer), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
  return String(buffer);
}

String generateUuidV4() {
  uint8_t bytes[16];
  for (uint8_t index = 0; index < sizeof(bytes); index += 4) {
    uint32_t value = esp_random();
    bytes[index] = value & 0xff;
    bytes[index + 1] = (value >> 8) & 0xff;
    bytes[index + 2] = (value >> 16) & 0xff;
    bytes[index + 3] = (value >> 24) & 0xff;
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  char uuid[37];
  snprintf(
    uuid,
    sizeof(uuid),
    "%02x%02x%02x%02x-%02x%02x-%02x%02x-%02x%02x-%02x%02x%02x%02x%02x%02x",
    bytes[0],
    bytes[1],
    bytes[2],
    bytes[3],
    bytes[4],
    bytes[5],
    bytes[6],
    bytes[7],
    bytes[8],
    bytes[9],
    bytes[10],
    bytes[11],
    bytes[12],
    bytes[13],
    bytes[14],
    bytes[15]
  );

  return String(uuid);
}
