"use client";

import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  parseThemePreference,
  resolveTheme,
  type ThemePreference,
} from "../lib/theme";
import {
  parseStoredSession,
  shouldReplaceSession,
  type StoredSession,
} from "../lib/session";

type Phase = "idle" | "start" | "running" | "end" | "saving";

const STORAGE_KEY = "timeFri.activeSession.v1";
const THEME_STORAGE_KEY = "timeFri.theme.v1";

const themeOptions: Array<{
  value: ThemePreference;
  label: string;
  icon: string;
}> = [
  { value: "light", label: "浅色主题", icon: "☀" },
  { value: "dark", label: "深色主题", icon: "☾" },
  { value: "system", label: "跟随系统主题", icon: "▣" },
];

function formatElapsed(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function applyThemePreference(
  preference: ThemePreference,
  persist = false,
) {
  const root = document.documentElement;
  const systemPrefersDark = window.matchMedia(
    "(prefers-color-scheme: dark)",
  ).matches;

  root.dataset.themePreference = preference;
  root.dataset.theme = resolveTheme(preference, systemPrefersDark);

  if (persist) {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // The selected theme still applies when storage is unavailable.
    }
  }
}

export default function HomePage() {
  const [now, setNow] = useState<Date | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [session, setSession] = useState<StoredSession | null>(null);
  const [eventName, setEventName] = useState("");
  const [summary, setSummary] = useState("");
  const [eventError, setEventError] = useState("");
  const [summaryError, setSummaryError] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [isMutating, setIsMutating] = useState(false);
  const [themePreference, setThemePreference] =
    useState<ThemePreference>("system");
  const sessionRef = useRef<StoredSession | null>(null);
  const mutationInFlightRef = useRef(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setNow(new Date());
    });
    const timer = window.setInterval(() => setNow(new Date()), 1000);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    async function synchronizeSession() {
      if (mutationInFlightRef.current) return;

      try {
        const response = await fetch("/api/session", { cache: "no-store" });
        if (!response.ok) return;

        const body = (await response.json()) as { session?: unknown };
        const incoming =
          body.session === null ? null : parseStoredSession(body.session);
        if (body.session !== null && !incoming) return;
        if (!isActive || mutationInFlightRef.current) return;

        try {
          window.localStorage.removeItem(STORAGE_KEY);
        } catch {
          // Server state remains authoritative when browser storage is unavailable.
        }

        const current = sessionRef.current;
        if (!shouldReplaceSession(current, incoming)) return;

        sessionRef.current = incoming;
        setSession(incoming);
        setPhase((currentPhase) => {
          if (incoming) {
            return currentPhase === "end" && current?.id === incoming.id
              ? "end"
              : "running";
          }
          return currentPhase === "start" ? "start" : "idle";
        });
      } catch {
        // Keep the most recent server state and retry on the next poll.
      }
    }

    void synchronizeSession();
    const timer = window.setInterval(synchronizeSession, 3000);

    return () => {
      isActive = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const initialPreference = parseThemePreference(
      root.dataset.themePreference,
    );
    const frame = window.requestAnimationFrame(() => {
      setThemePreference(initialPreference);
      applyThemePreference(initialPreference);
    });

    function handleSystemThemeChange() {
      if (root.dataset.themePreference === "system") {
        applyThemePreference("system");
      }
    }

    mediaQuery.addEventListener("change", handleSystemThemeChange);
    return () => {
      window.cancelAnimationFrame(frame);
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
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

  async function confirmStart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = eventName.trim();

    if (!normalized) {
      setEventError("请输入事件名称");
      return;
    }

    const nextSession = {
      id: crypto.randomUUID(),
      eventName: normalized,
      startAt: Date.now(),
    };

    mutationInFlightRef.current = true;
    setIsMutating(true);
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextSession),
      });
      const body = (await response.json()) as { session?: unknown };
      const storedSession = parseStoredSession(body.session);

      if (!response.ok || !storedSession) {
        if (storedSession) {
          sessionRef.current = storedSession;
          setSession(storedSession);
          setPhase("running");
          displayToast("已同步正在记录的事件");
          return;
        }
        setEventError("启动失败，请检查服务器后重试");
        return;
      }

      sessionRef.current = storedSession;
      setSession(storedSession);
      setPhase("running");
    } catch {
      setEventError("启动失败，请检查网络后重试");
    } finally {
      mutationInFlightRef.current = false;
      setIsMutating(false);
    }
  }

  function openEndDialog() {
    setSummary("");
    setSummaryError("");
    setPhase("end");
  }

  function displayToast(message: string) {
    setToastMessage(message);
    setShowToast(true);
    window.setTimeout(() => setShowToast(false), 1800);
  }

  async function saveProgressEntry() {
    const normalized = summary.trim();
    const activeSession = session;

    if (!normalized) {
      setSummaryError("请输入本次记录内容");
      return;
    }

    if (!activeSession) {
      setSummaryError("没有正在记录的事件");
      setPhase("idle");
      return;
    }

    mutationInFlightRef.current = true;
    setIsMutating(true);
    try {
      const response = await fetch("/api/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: activeSession.id,
          content: normalized,
        }),
      });
      const body = (await response.json()) as { session?: unknown };
      const storedSession =
        body.session === null ? null : parseStoredSession(body.session);

      if (!response.ok || !storedSession) {
        if (body.session === null) {
          sessionRef.current = null;
          setSession(null);
          setPhase("idle");
          setSummaryError("当前事件已在其他浏览器结束");
          return;
        }
        if (storedSession) {
          sessionRef.current = storedSession;
          setSession(storedSession);
        }
        setSummaryError("保存失败，请稍后重试");
        return;
      }

      sessionRef.current = storedSession;
      setSession(storedSession);
      setSummary("");
      setSummaryError("");
      setPhase("running");
      displayToast("已保存本次记录");
    } catch {
      setSummaryError("保存失败，请检查网络后重试");
    } finally {
      mutationInFlightRef.current = false;
      setIsMutating(false);
    }
  }

  async function confirmEnd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = summary.trim();
    const activeSession = session;

    if (!activeSession) {
      setSummaryError("没有正在记录的事件");
      setPhase("idle");
      return;
    }

    if (!normalized && activeSession.entries.length === 0) {
      setSummaryError("请至少保存一条记录内容");
      return;
    }

    setPhase("saving");
    mutationInFlightRef.current = true;
    setIsMutating(true);

    try {
      const response = await fetch("/api/session/finish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: activeSession.id,
          finalEntry: normalized || undefined,
        }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { session?: unknown };
        const storedSession =
          body.session === null ? null : parseStoredSession(body.session);

        if (storedSession) {
          sessionRef.current = storedSession;
          setSession(storedSession);
          if (normalized && storedSession.entries.includes(normalized)) {
            setSummary("");
          }
        } else if (body.session === null) {
          sessionRef.current = null;
          setSession(null);
          setPhase("idle");
          setSummaryError("当前事件已在其他浏览器结束");
          return;
        }

        setSummaryError("写入 Flomo 失败，请检查 Webhook 配置或稍后重试");
        setPhase("end");
        return;
      }
    } catch {
      setSummaryError("写入 Flomo 失败，请检查 Webhook 配置或稍后重试");
      setPhase("end");
      return;
    } finally {
      mutationInFlightRef.current = false;
      setIsMutating(false);
    }

    sessionRef.current = null;
    setSession(null);
    setEventName("");
    setSummary("");
    setPhase("idle");
    displayToast("已写入 Flomo");
  }

  function handleSummaryShortcut(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      saveProgressEntry();
    }
  }

  function selectTheme(preference: ThemePreference) {
    applyThemePreference(preference, true);
    setThemePreference(preference);
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
        <div className="topbar-actions">
          <div className="theme-switcher" aria-label="主题设置" role="group">
            {themeOptions.map((option) => (
              <button
                className="theme-option"
                type="button"
                key={option.value}
                title={option.label}
                aria-label={option.label}
                aria-pressed={themePreference === option.value}
                onClick={() => selectTheme(option.value)}
              >
                <span aria-hidden="true">{option.icon}</span>
              </button>
            ))}
          </div>
          <div className={`status-dot ${isRunning ? "is-running" : ""}`}>
            <span aria-hidden="true" />
            {isRunning ? "记录中" : "空闲"}
          </div>
        </div>
      </header>

      <section className="clock-stage" aria-label="时间记录器">
        {session ? (
          <div className="running-session-hero">
            <p className="session-label">当前任务</p>
            <h1 className="session-name running-session-name" title={session.eventName}>
              {session.eventName}
            </h1>
            <p className="elapsed running-elapsed" aria-label={`已经持续 ${elapsed}`}>
              {elapsed}
            </p>
          </div>
        ) : (
          <>
            <p className="date-line">{dateText}</p>
            <h1 className="clock" aria-label={`当前时间 ${clockText}`}>
              {clockText}
            </h1>
          </>
        )}

        <div className={`session-area ${isRunning ? "has-session" : ""}`}>
          {session ? (
            <>
              <p className="date-line session-date-line">{dateText}</p>
              <p className="session-label">当前时间</p>
              <p className="clock session-clock" aria-label={`当前时间 ${clockText}`}>
                {clockText}
              </p>
              {session.entries.length > 0 && (
                <p className="entry-count">已记录 {session.entries.length} 条</p>
              )}
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
            disabled={isRunning || isMutating}
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
            记录
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
                <button
                  className="button button-primary"
                  type="submit"
                  disabled={isMutating}
                >
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
            <p className="dialog-kicker">记录当前进展</p>
            <h2 id="end-dialog-title">留下这段时间的内容</h2>

            <div className="session-summary">
              <span>{session.eventName}</span>
              <strong>{elapsed}</strong>
            </div>

            {session.entries.length > 0 && (
              <section
                className="entry-history"
                aria-labelledby="entry-history-title"
              >
                <p className="entry-history-title" id="entry-history-title">
                  已保存记录 · {session.entries.length} 条
                </p>
                <div className="entry-history-list">
                  {session.entries.map((entry, index) => (
                    <p
                      className="entry-history-item"
                      key={`${index}-${entry}`}
                    >
                      {entry}
                    </p>
                  ))}
                </div>
              </section>
            )}

            <form onSubmit={confirmEnd} noValidate>
              <label htmlFor="summary">记录内容</label>
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
                <span id="summary-hint">⌘ / Ctrl + Enter 保存记录</span>
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
                  onClick={saveProgressEntry}
                  disabled={phase === "saving" || isMutating}
                >
                  继续计时
                </button>
                <button
                  className="button button-primary"
                  type="submit"
                  disabled={phase === "saving" || isMutating}
                >
                  {phase === "saving" ? (
                    <>
                      <span className="spinner" aria-hidden="true" />
                      正在写入
                    </>
                  ) : (
                    "结束"
                  )}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      <div className={`toast ${showToast ? "is-visible" : ""}`} role="status">
        <span aria-hidden="true">✓</span>
        {toastMessage}
      </div>
    </main>
  );
}
