import { hashDeviceToken } from "@/lib/production/hash";
import type {
  ProductionEventPayload,
  ProductionEventResult,
} from "@/lib/production/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RpcResult = {
  status?: ProductionEventResult["status"];
  message?: string;
  event?: ProductionEventResult["event"];
  cooldown?: ProductionEventResult["cooldown"];
};

export async function recordProductionEvent(
  payload: ProductionEventPayload & { occurred_at: string },
): Promise<ProductionEventResult> {
  const supabase = createSupabaseAdminClient();
  const tokenHash = hashDeviceToken(payload.device_token);

  const { data, error } = await supabase.rpc("accept_production_event", {
    p_device_code: payload.device_id,
    p_event_id: payload.event_id,
    p_input_number: payload.input_gpio,
    p_occurred_at: payload.occurred_at,
    p_token_hash: tokenHash,
  });

  if (error) {
    console.error("production event rpc failed", error);

    return {
      status: "server_error",
      message: "Falha ao processar evento de producao.",
    };
  }

  const result = data as RpcResult | null;

  return {
    status: result?.status ?? "server_error",
    message: result?.message ?? "Resposta inesperada do banco.",
    event: result?.event,
    cooldown: result?.cooldown,
  };
}
