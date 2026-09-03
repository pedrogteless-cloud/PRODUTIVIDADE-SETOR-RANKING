import { recordProductionEvent } from "@/lib/production/record-event";
import { validateProductionEventPayload } from "@/lib/production/validation";
import type { ProductionEventStatus } from "@/lib/production/types";

export const dynamic = "force-dynamic";

const RESPONSE_STATUS: Record<ProductionEventStatus, number> = {
  accepted: 201,
  duplicate: 200,
  cooldown: 202,
  unauthorized: 401,
  no_assignment: 409,
  invalid_payload: 400,
  server_error: 500,
};

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      {
        status: "invalid_payload",
        message: "Corpo da requisicao deve ser JSON valido.",
      },
      400,
    );
  }

  const validation = validateProductionEventPayload(body);

  if (!validation.ok) {
    return jsonResponse(
      {
        status: "invalid_payload",
        message: validation.message,
      },
      400,
    );
  }

  const result = await recordProductionEvent(validation.payload);

  return jsonResponse(result, RESPONSE_STATUS[result.status] ?? 500);
}

function jsonResponse(payload: unknown, status: number) {
  return Response.json(payload, {
    status,
    headers: corsHeaders(),
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  };
}
