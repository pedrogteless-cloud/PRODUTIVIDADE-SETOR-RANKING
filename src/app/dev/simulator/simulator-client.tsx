"use client";

import { CheckCircle2, CopyPlus, Play, RotateCcw, Send } from "lucide-react";
import { useMemo, useState } from "react";

type ApiResult = {
  status?: string;
  message?: string;
  [key: string]: unknown;
};

const defaultDeviceId =
  process.env.NEXT_PUBLIC_SIMULATOR_DEVICE_ID ?? "SIMULATOR-COLAGEM";
const defaultToken = process.env.NEXT_PUBLIC_SIMULATOR_DEVICE_TOKEN ?? "";
const defaultInput = Number(process.env.NEXT_PUBLIC_SIMULATOR_INPUT_GPIO ?? 1);

function makePayload(deviceId: string, token: string, inputGpio: number) {
  return {
    device_id: deviceId,
    device_token: token,
    input_gpio: inputGpio,
    event_id: crypto.randomUUID(),
    occurred_at: new Date().toISOString(),
  };
}

export function SimulatorClient() {
  const [deviceId, setDeviceId] = useState(defaultDeviceId);
  const [deviceToken, setDeviceToken] = useState(defaultToken);
  const [inputGpio, setInputGpio] = useState(defaultInput);
  const [payload, setPayload] = useState(() =>
    makePayload(defaultDeviceId, defaultToken, defaultInput),
  );
  const [result, setResult] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(false);

  const prettyPayload = useMemo(
    () => JSON.stringify(payload, null, 2),
    [payload],
  );

  function refreshPayload() {
    setPayload(makePayload(deviceId, deviceToken, inputGpio));
    setResult(null);
  }

  async function sendPayload(nextPayload = payload) {
    setLoading(true);

    try {
      const response = await fetch("/api/v1/production-events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(nextPayload),
      });

      const data = (await response.json()) as ApiResult;

      setResult({
        http_status: response.status,
        ...data,
      });
    } catch (error) {
      setResult({
        status: "network_error",
        message: error instanceof Error ? error.message : "Falha de rede.",
      });
    } finally {
      setLoading(false);
    }
  }

  function sendFreshClick() {
    const nextPayload = makePayload(deviceId, deviceToken, inputGpio);
    setPayload(nextPayload);
    void sendPayload(nextPayload);
  }

  return (
    <main className="sim-screen">
      <section className="sim-shell">
        <header className="sim-header">
          <div>
            <p className="kicker">MVP Colagem</p>
            <h1 className="sim-title">Simulador de botoeira</h1>
          </div>
          <a className="api-link" href="/tv/colagem">
            Abrir TV
          </a>
        </header>

        <section className="sim-grid">
          <form
            className="form-panel"
            onSubmit={(event) => {
              event.preventDefault();
              void sendPayload();
            }}
          >
            <div className="field-stack">
              <div className="field">
                <label htmlFor="device-id">Dispositivo</label>
                <input
                  id="device-id"
                  value={deviceId}
                  onChange={(event) => setDeviceId(event.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="device-token">Token</label>
                <input
                  id="device-token"
                  type="password"
                  value={deviceToken}
                  onChange={(event) => setDeviceToken(event.target.value)}
                />
              </div>

              <div className="quick-inputs">
                <div className="field">
                  <label htmlFor="input-gpio">GPIO/Input</label>
                  <input
                    id="input-gpio"
                    min={0}
                    max={99}
                    type="number"
                    value={inputGpio}
                    onChange={(event) =>
                      setInputGpio(Number(event.target.value))
                    }
                  />
                </div>

                <div className="field">
                  <label htmlFor="quick-input">Atalho</label>
                  <select
                    id="quick-input"
                    value={inputGpio}
                    onChange={(event) =>
                      setInputGpio(Number(event.target.value))
                    }
                  >
                    <option value={1}>Input 1</option>
                    <option value={2}>Input 2</option>
                    <option value={3}>Input 3</option>
                    <option value={4}>Input 4</option>
                    <option value={27}>GPIO 27</option>
                  </select>
                </div>
              </div>

              <div className="field">
                <label htmlFor="payload">Payload</label>
                <textarea
                  id="payload"
                  value={prettyPayload}
                  onChange={(event) => {
                    try {
                      const parsed = JSON.parse(event.target.value) as typeof payload;
                      setPayload(parsed);
                    } catch {
                      setPayload((current) => current);
                    }
                  }}
                />
              </div>
            </div>

            <div className="sim-toolbar">
              <button className="primary-button" type="button" onClick={sendFreshClick}>
                <Send size={18} />
                Clique novo
              </button>
              <button className="secondary-button" type="submit" disabled={loading}>
                <Play size={18} />
                Enviar payload
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => void sendPayload()}
                disabled={loading}
              >
                <CopyPlus size={18} />
                Reenviar ultimo
              </button>
              <button
                aria-label="Gerar payload"
                className="icon-button"
                type="button"
                onClick={refreshPayload}
                title="Gerar payload"
              >
                <RotateCcw size={18} />
              </button>
            </div>
          </form>

          <aside className="response-panel">
            <div className="response-head">
              <strong>Resposta</strong>
              <span className={`status-pill ${result?.status ?? ""}`}>
                {loading ? "enviando" : result?.status ?? "pronto"}
              </span>
            </div>
            <pre className="response-json">
              {result
                ? JSON.stringify(result, null, 2)
                : JSON.stringify(
                    {
                      endpoint: "POST /api/v1/production-events",
                      device_id: deviceId,
                      input_gpio: inputGpio,
                    },
                    null,
                    2,
                  )}
            </pre>
          </aside>
        </section>
      </section>
    </main>
  );
}
