import type { ProductionEventPayload } from "@/lib/production/types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ValidationResult =
  | {
      ok: true;
      payload: ProductionEventPayload & { occurred_at: string };
    }
  | {
      ok: false;
      message: string;
    };

export function validateProductionEventPayload(input: unknown): ValidationResult {
  if (!input || typeof input !== "object") {
    return { ok: false, message: "Payload deve ser um objeto JSON." };
  }

  const payload = input as Record<string, unknown>;
  const deviceId = payload.device_id;
  const deviceToken = payload.device_token;
  const inputGpio = payload.input_gpio;
  const eventId = payload.event_id;
  const occurredAt = payload.occurred_at ?? new Date().toISOString();

  if (typeof deviceId !== "string" || deviceId.trim().length < 3) {
    return { ok: false, message: "device_id invalido ou ausente." };
  }

  if (typeof deviceToken !== "string" || deviceToken.length < 8) {
    return { ok: false, message: "device_token invalido ou ausente." };
  }

  if (
    typeof inputGpio !== "number" ||
    !Number.isInteger(inputGpio) ||
    inputGpio < 0 ||
    inputGpio > 99
  ) {
    return { ok: false, message: "input_gpio deve ser um inteiro valido." };
  }

  if (typeof eventId !== "string" || !UUID_PATTERN.test(eventId)) {
    return { ok: false, message: "event_id deve ser um UUID valido." };
  }

  if (typeof occurredAt !== "string" || Number.isNaN(Date.parse(occurredAt))) {
    return { ok: false, message: "occurred_at deve ser uma data ISO valida." };
  }

  return {
    ok: true,
    payload: {
      device_id: deviceId.trim(),
      device_token: deviceToken,
      input_gpio: inputGpio,
      event_id: eventId,
      occurred_at: new Date(occurredAt).toISOString(),
    },
  };
}
