"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { ScoreboardSnapshot } from "@/lib/production/types";

type ScoreboardRow = Omit<ScoreboardSnapshot, "ranking"> & {
  ranking: unknown;
};

function normalizeScoreboard(row: ScoreboardRow): ScoreboardSnapshot {
  const ranking = Array.isArray(row.ranking)
    ? row.ranking.map((item, index) => {
        const record = item as Record<string, unknown>;

        return {
          employee_id: String(record.employee_id ?? ""),
          display_name: String(record.display_name ?? "Operador"),
          photo_url:
            typeof record.photo_url === "string" ? record.photo_url : null,
          units: Number(record.units ?? 0),
          position: Number(record.position ?? index + 1),
        };
      })
    : [];

  return {
    ...row,
    ranking,
  };
}

export function TvScoreboard() {
  const [scoreboard, setScoreboard] = useState<ScoreboardSnapshot | null>(null);
  const [status, setStatus] = useState("conectando");
  const [surgingIds, setSurgingIds] = useState<Set<string>>(new Set());
  const previousPositionsRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    let mounted = true;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    const supabase = createSupabaseBrowserClient();

    async function loadSnapshot() {
      try {
        if (supabase) {
          const { data, error } = await supabase
            .from("sector_live_scoreboard")
            .select(
              "sector_id, sector_name, sector_slug, production_day, ranking, total_units, updated_at",
            )
            .eq("sector_slug", "colagem")
            .maybeSingle();

          if (error) {
            throw error;
          }

          if (data && mounted) {
            applyScoreboard(normalizeScoreboard(data as ScoreboardRow));
            setStatus("ao vivo");
          }

          return;
        }

        const response = await fetch("/api/v1/scoreboard?sector=colagem", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = (await response.json()) as ScoreboardSnapshot;
        if (mounted) {
          applyScoreboard(data);
          setStatus("ao vivo");
        }
      } catch {
        if (mounted) {
          setStatus("aguardando dados");
        }
      }
    }

    function applyScoreboard(next: ScoreboardSnapshot) {
      const movers = new Set<string>();

      for (const item of next.ranking) {
        const previous = previousPositionsRef.current.get(item.employee_id);

        if (previous && item.position < previous) {
          movers.add(item.employee_id);
        }
      }

      previousPositionsRef.current = new Map(
        next.ranking.map((item) => [item.employee_id, item.position]),
      );

      setScoreboard(next);

      if (movers.size > 0) {
        setSurgingIds(movers);
        window.setTimeout(() => setSurgingIds(new Set()), 1500);
      }
    }

    void loadSnapshot();

    if (supabase) {
      const channel = supabase
        .channel("tv-colagem-scoreboard")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "sector_live_scoreboard",
            filter: "sector_slug=eq.colagem",
          },
          (payload) => {
            const row = payload.new as ScoreboardRow;
            applyScoreboard(normalizeScoreboard(row));
            setStatus("ao vivo");
          },
        )
        .subscribe((subscriptionStatus) => {
          if (subscriptionStatus === "SUBSCRIBED") {
            setStatus("ao vivo");
          }
        });

      pollTimer = setInterval(loadSnapshot, 15000);

      return () => {
        mounted = false;
        if (pollTimer) {
          clearInterval(pollTimer);
        }
        void supabase.removeChannel(channel);
      };
    }

    pollTimer = setInterval(loadSnapshot, 2500);

    return () => {
      mounted = false;
      if (pollTimer) {
        clearInterval(pollTimer);
      }
    };
  }, []);

  const maxUnits = useMemo(() => {
    return Math.max(1, ...(scoreboard?.ranking.map((item) => item.units) ?? [1]));
  }, [scoreboard]);

  const updatedAt = scoreboard?.updated_at
    ? new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(new Date(scoreboard.updated_at))
    : "--:--:--";

  return (
    <main className="tv-screen">
      <section className="tv-shell">
        <header className="tv-header">
          <div className="header-copy">
            <span className="brand-mark">LEY</span>
            <div>
              <p className="kicker">Produtividade Fabril</p>
              <h1 className="tv-title">Colagem</h1>
            </div>
          </div>

          <div className="header-stats">
            <div className="stat-block">
              <span className="stat-label">Dia</span>
              <span className="stat-value">
                {scoreboard?.production_day
                  ? new Intl.DateTimeFormat("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                    }).format(new Date(`${scoreboard.production_day}T12:00:00`))
                  : "--/--"}
              </span>
            </div>
            <div className="stat-block">
              <span className="stat-label">Total</span>
              <span className="stat-value">{scoreboard?.total_units ?? 0}</span>
            </div>
          </div>
        </header>

        <section className="race-track" aria-live="polite">
          {scoreboard && scoreboard.ranking.length > 0 ? (
            scoreboard.ranking.map((item) => {
              const fill = Math.max(8, Math.round((item.units / maxUnits) * 100));
              const initials = item.display_name
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();

              return (
                <article
                  className={`runner-row ${
                    surgingIds.has(item.employee_id) ? "is-surging" : ""
                  }`}
                  key={item.employee_id}
                >
                  <div className="position-badge">{item.position}</div>

                  <div className="runner-person">
                    <div className="runner-avatar">
                      {item.photo_url ? (
                        <Image
                          alt=""
                          height={78}
                          src={item.photo_url}
                          unoptimized
                          width={78}
                        />
                      ) : (
                        <span>{initials}</span>
                      )}
                    </div>
                    <h2 className="runner-name">{item.display_name}</h2>
                  </div>

                  <div className="track-lane">
                    <div
                      className="track-fill"
                      style={{ "--fill": `${fill}%` } as React.CSSProperties}
                    />
                    <span className="track-marker" />
                  </div>

                  <div className="runner-units">
                    <span className="units-number">{item.units}</span>
                    <span className="units-label">pecas</span>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="empty-state">Aguardando producao da Colagem</div>
          )}
        </section>

        <footer className="tv-footer">
          <span>
            <span className="pulse-dot" />
            {status}
          </span>
          <span>Atualizado {updatedAt}</span>
        </footer>
      </section>
    </main>
  );
}
