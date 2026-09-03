export type ProductionEventPayload = {
  device_id: string;
  device_token: string;
  input_gpio: number;
  event_id: string;
  occurred_at?: string;
};

export type ProductionEventStatus =
  | "accepted"
  | "duplicate"
  | "cooldown"
  | "unauthorized"
  | "no_assignment"
  | "invalid_payload"
  | "server_error";

export type ProductionEventResult = {
  status: ProductionEventStatus;
  message: string;
  event?: {
    event_id: string;
    device_id: string;
    input_gpio: number;
    employee_id?: string;
    employee_name?: string;
    sector_id?: string;
    sector_name?: string;
    occurred_at?: string;
  };
  cooldown?: {
    seconds: number;
    retry_after_seconds: number;
    last_event_at: string;
  };
};

export type ScoreboardRankingItem = {
  employee_id: string;
  display_name: string;
  photo_url: string | null;
  units: number;
  position: number;
};

export type ScoreboardSnapshot = {
  sector_id: string;
  sector_name: string;
  sector_slug: string;
  production_day: string;
  ranking: ScoreboardRankingItem[];
  total_units: number;
  updated_at: string;
};
