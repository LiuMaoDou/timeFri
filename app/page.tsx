"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";

type Phase = "idle" | "start" | "running" | "end" | "saving";

type ActiveSession = {
  id: string;
  eventName: string;
  startAt: number;
};

const STORAGE_KEY = "timeFri.activeSession.v1";

function formatElapsed(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function loadSession(): ActiveSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const value = JSON.parse(raw) as Partial<ActiveSession>;
    if (
      typeof value.id !== "string" ||
      typeof value.eventName !== "string" ||
      typeof value.startAt !== "number"
    ) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return value as ActiveSession;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export default function HomePage() {
  const [now, setNow] = useState<Date | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [eventName, setEventName] = useState("");
  const [summary, setSummary] = useState("");
  const [eventError, setEventError] = useState("");
  const [summaryError, setSummaryError] = useState("");
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setNow(new Date());
      const restored = loadSession();

      if (restored) {
        setSession(restored);
        setPhase("running");
      }
    });
    const timer = window.setInterval(() => setNow(new Date()), 1000);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (phase === "start") {
        setEventName("");
        setEventError("");
        setPhase(session ? "running" : "idle");
      }
      if (phase === "end") {
        setSummaryError("");
        setPhase("running");
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [phase, session]);

  const elapsed = useMemo(() => {
    if (!session || !now) return "00:00:00";
    return formatElapsed(now.getTime() - session.startAt);
  }, [now, session]);

  const clockText = now
    ? new Intl.DateTimeFormat("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(now)
    : "--:--:--";

  const dateText = now
    ? new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long",
      }).format(now)
    : "正在读取本地时间";

  function openStartDialog() {
    setEventName("");
    setEventError("");
    setPhase("start");
  }

  function confirmStart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = eventName.trim();

    if (!normalized) {
      setEventError("请输入事件名称");
      return;
    }

    const nextSession: ActiveSession = {
      id: crypto.randomUUID(),
      eventName: normalized,
      startAt: Date.now(),
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
    setSession(nextSession);
    setPhase("running");
  }

  function openEndDialog() {
    setSummary("");
    setSummaryError("");
    setPhase("end");
  }

  async function confirmEnd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = summary.trim();
    const activeSession = session;

    if (!normalized) {
      setSummaryError("请输入本次总结");
      return;
    }

    if (!activeSession) {
      setSummaryError("没有正在记录的事件");
      setPhase("idle");
      return;
    }

    setPhase("saving");
    const endAt = new Date();

    try {
      const response = await fetch("/api/flomo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventName: activeSession.eventName,
          summary: normalized,
          startAt: new Date(activeSession.startAt).toISOString(),
          endAt: endAt.toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error("Flomo write failed");
      }
    } catch {
      setSummaryError("写入 Flomo 失败，请检查 Webhook 配置或稍后重试");
      setPhase("end");
      return;
    }

    window.localStorage.removeItem(STORAGE_KEY);
    setSession(null);
    setEventName("");
    setSummary("");
    setPhase("idle");
    setShowToast(true);
    window.setTimeout(() => setShowToast(false), 1800);
  }

  function handleSummaryShortcut(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.currentTarget.form?.requestSubmit();
    }
  }

  const isRunning = Boolean(session);

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />

      <header className="topbar">
        <a className="brand" href="#" aria-label="timeFri 首页">
          time<span>Fri</span>
        </a>
        <div className={`status-dot ${isRunning ? "is-running" : ""}`}>
          <span aria-hidden="true" />
          {isRunning ? "记录中" : "空闲"}
        </div>
      </header>

      <section className="clock-stage" aria-label="时间记录器">
        <p className="date-line">{dateText}</p>
        <h1 className="clock" aria-label={`当前时间 ${clockText}`}>
          {clockText}
        </h1>

        <div className={`session-area ${isRunning ? "has-session" : ""}`}>
          {session ? (
            <>
              <p className="session-label">当前事件</p>
              <p className="session-name" title={session.eventName}>
                {session.eventName}
              </p>
              <p className="elapsed" aria-label={`已经持续 ${elapsed}`}>
                {elapsed}
              </p>
            </>
          ) : (
            <>
              <p className="session-label">准备好开始一段专注时间</p>
              <p className="idle-copy">记录开始，专注当下；记录结束，留下总结。</p>
            </>
          )}
        </div>

        <div className="controls" aria-label="计时控制">
          <button
            className="button button-primary"
            type="button"
            onClick={openStartDialog}
            disabled={isRunning}
          >
            <span className="button-icon" aria-hidden="true">▶</span>
            启动
          </button>
          <button
            className="button button-secondary"
            type="button"
            onClick={openEndDialog}
            disabled={!isRunning}
          >
            <span className="button-icon stop-icon" aria-hidden="true" />
            结束
          </button>
        </div>
      </section>

      <footer className="footer-line">
        <span>时间会过去，记录会留下。</span>
        <span>timeFri · focus quietly</span>
      </footer>

      {phase === "start" && (
        <div className="dialog-backdrop" role="presentation">
          <section
            className="dialog-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="start-dialog-title"
          >
            <button
              className="dialog-close"
              type="button"
              aria-label="关闭"
              onClick={() => setPhase("idle")}
            >
              ×
            </button>
            <p className="dialog-kicker">新的时间记录</p>
            <h2 id="start-dialog-title">现在要做什么？</h2>
            <p className="dialog-copy">为这段时间起一个清楚、简短的名称。</p>

            <form onSubmit={confirmStart} noValidate>
              <label htmlFor="event-name">事件名称</label>
              <input
                id="event-name"
                value={eventName}
                onChange={(event) => {
                  setEventName(event.target.value);
                  setEventError("");
                }}
                placeholder="例如：准备课程 PPT"
                maxLength={100}
                autoFocus
                aria-invalid={Boolean(eventError)}
                aria-describedby={eventError ? "event-error" : undefined}
              />
              {eventError && (
                <p className="field-error" id="event-error" role="alert">
                  {eventError}
                </p>
              )}
              <div className="dialog-actions">
                <button
                  className="button button-ghost"
                  type="button"
                  onClick={() => setPhase("idle")}
                >
                  取消
                </button>
                <button className="button button-primary" type="submit">
                  确认启动
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {(phase === "end" || phase === "saving") && session && (
        <div className="dialog-backdrop" role="presentation">
          <section
            className="dialog-card dialog-card-wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="end-dialog-title"
          >
            {phase !== "saving" && (
              <button
                className="dialog-close"
                type="button"
                aria-label="关闭"
                onClick={() => setPhase("running")}
              >
                ×
              </button>
            )}
            <p className="dialog-kicker">完成本次记录</p>
            <h2 id="end-dialog-title">为这段时间做个总结</h2>

            <div className="session-summary">
              <span>{session.eventName}</span>
              <strong>{elapsed}</strong>
            </div>

            <form onSubmit={confirmEnd} noValidate>
              <label htmlFor="summary">总结</label>
              <textarea
                id="summary"
                value={summary}
                onChange={(event) => {
                  setSummary(event.target.value);
                  setSummaryError("");
                }}
                onKeyDown={handleSummaryShortcut}
                placeholder="记录完成情况、结果或下一步……"
                maxLength={2000}
                rows={5}
                autoFocus
                disabled={phase === "saving"}
                aria-invalid={Boolean(summaryError)}
                aria-describedby={summaryError ? "summary-error" : "summary-hint"}
              />
              <div className="field-meta">
                <span id="summary-hint">⌘ / Ctrl + Enter 提交</span>
                <span>{summary.length}/2000</span>
              </div>
              {summaryError && (
                <p className="field-error" id="summary-error" role="alert">
                  {summaryError}
                </p>
              )}
              <div className="dialog-actions">
                <button
                  className="button button-ghost"
                  type="button"
                  onClick={() => setPhase("running")}
                  disabled={phase === "saving"}
                >
                  继续计时
                </button>
                <button
                  className="button button-primary"
                  type="submit"
                  disabled={phase === "saving"}
                >
                  {phase === "saving" ? (
                    <>
                      <span className="spinner" aria-hidden="true" />
                      正在写入
                    </>
                  ) : (
                    "确认并写入 Flomo"
                  )}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      <div className={`toast ${showToast ? "is-visible" : ""}`} role="status">
        <span aria-hidden="true">✓</span>
        已写入 Flomo
      </div>
    </main>
  );
}
