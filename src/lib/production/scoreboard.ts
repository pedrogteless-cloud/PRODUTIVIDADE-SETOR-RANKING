import { createClient } from "@supabase/supabase-js";

import { getPublicSupabaseKey, getPublicSupabaseUrl } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ScoreboardSnapshot } from "@/lib/production/types";

type ScoreboardRow = {
  sector_id: string;
  sector_name: string;
  sector_slug: string;
  production_day: string;
  ranking: unknown;
  total_units: number;
  updated_at: string;
};

function normalizeRanking(ranking: unknown): ScoreboardSnapshot["ranking"] {
  if (!Array.isArray(ranking)) {
    return [];
  }

  return ranking.map((item, index) => {
    const row = item as Partial<ScoreboardSnapshot["ranking"][number]>;

    return {
      employee_id: String(row.employee_id ?? ""),
      display_name: String(row.display_name ?? "Operador"),
      photo_url: row.photo_url ?? null,
      units: Number(row.units ?? 0),
      position: Number(row.position ?? index + 1),
    };
  });
}

export async function getScoreboardSnapshot(
  sectorSlug = "colagem",
): Promise<ScoreboardSnapshot | null> {
  const publicKey = getPublicSupabaseKey();
  const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createSupabaseAdminClient()
    : createClient(getPublicSupabaseUrl(), publicKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });

  const { data, error } = await supabase
    .from("sector_live_scoreboard")
    .select(
      "sector_id, sector_name, sector_slug, production_day, ranking, total_units, updated_at",
    )
    .eq("sector_slug", sectorSlug)
    .maybeSingle<ScoreboardRow>();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    ...data,
    ranking: normalizeRanking(data.ranking),
  };
}
