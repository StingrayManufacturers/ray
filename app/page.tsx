"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import WaterBackground from "./components/WaterBackground";

type Role = "user" | "assistant";
type ChatMsg = { role: Role; content: string };

type Conversation = {
  id: string;
  title: string;
  messages: ChatMsg[];
  createdAt: number;
  updatedAt: number;
};

const STORAGE_KEY = "ray_conversations_v1";
const STORAGE_UI_KEY = "ray_sidebar_collapsed_v1";

function uid() {
  return Math.random().toString(36).slice(2) + "-" + Date.now().toString(36);
}

function titleFromFirstUserMessage(messages: ChatMsg[]) {
  const firstUser = messages.find((m) => m.role === "user")?.content?.trim() || "";
  if (!firstUser) return "New chat";
  const clean = firstUser.replace(/\s+/g, " ");
  return clean.length > 34 ? clean.slice(0, 34) + "..." : clean;
}

export default function Home() {
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const active = useMemo(
    () => convos.find((c) => c.id === activeId) || null,
    [convos, activeId]
  );

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const rawUI = localStorage.getItem(STORAGE_UI_KEY);
      if (rawUI) setSidebarCollapsed(rawUI === "1");

      if (raw) {
        const parsed = JSON.parse(raw) as Conversation[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          const sorted = [...parsed].sort((a, b) => b.updatedAt - a.updatedAt);
          setConvos(sorted);
          setActiveId(sorted[0].id);
          return;
        }
      }
    } catch {
      // ignore
    }

    const first: Conversation = {
      id: uid(),
      title: "New chat",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setConvos([first]);
    setActiveId(first.id);
  }, []);

  useEffect(() => {
    try {
      if (convos.length > 0) localStorage.setItem(STORAGE_KEY, JSON.stringify(convos));
    } catch {
      // ignore
    }
  }, [convos]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_UI_KEY, sidebarCollapsed ? "1" : "0");
    } catch {
      // ignore
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [activeId]);

  function newChat() {
    const c: Conversation = {
      id: uid(),
      title: "New chat",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setConvos((prev) => [c, ...prev]);
    setActiveId(c.id);
    setInput("");
  }

  function openChat(id: string) {
    setActiveId(id);
    setInput("");
  }

  function deleteChat(id: string) {
    setConvos((prev) => {
      const filtered = prev.filter((c) => c.id !== id);
      if (id === activeId) {
        if (filtered.length > 0) {
          setActiveId(filtered[0].id);
        } else {
          const c: Conversation = {
            id: uid(),
            title: "New chat",
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          setTimeout(() => {
            setConvos([c]);
            setActiveId(c.id);
          }, 0);
        }
      }
      return filtered;
    });
  }

  async function send() {
    const text = input.trim();
    if (!text || sending || !active) return;

    const nextMessages: ChatMsg[] = [...active.messages, { role: "user", content: text }];

    setConvos((prev) => {
      const updated = prev.map((c) => {
        if (c.id !== active.id) return c;
        const newTitle = c.title === "New chat" ? titleFromFirstUserMessage(nextMessages) : c.title;
        return { ...c, title: newTitle, messages: nextMessages, updatedAt: Date.now() };
      });
      return [...updated].sort((a, b) => b.updatedAt - a.updatedAt);
    });

    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });

      const contentType = res.headers.get("content-type") || "";
      let data: any = null;

      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const t = await res.text();
        throw new Error("API did not return JSON. It returned:\n" + t.slice(0, 250));
      }

      if (!res.ok) throw new Error(data?.error || "Request failed");

      const assistantMsg: ChatMsg = { role: "assistant", content: String(data.content || "") };

      setConvos((prev) => {
        const updated = prev.map((c) => {
          if (c.id !== active.id) return c;
          return { ...c, messages: [...nextMessages, assistantMsg], updatedAt: Date.now() };
        });
        return [...updated].sort((a, b) => b.updatedAt - a.updatedAt);
      });
    } catch (err: any) {
      const assistantMsg: ChatMsg = {
        role: "assistant",
        content: "Could not reach the AI service.\n" + (err?.message ? "Details: " + err.message : ""),
      };

      setConvos((prev) => {
        const updated = prev.map((c) => {
          if (c.id !== active.id) return c;
          return { ...c, messages: [...nextMessages, assistantMsg], updatedAt: Date.now() };
        });
        return [...updated].sort((a, b) => b.updatedAt - a.updatedAt);
      });
    } finally {
      setSending(false);
    }
  }

  const lastAssistant =
    active?.messages?.slice().reverse().find((m) => m.role === "assistant")?.content || "";

  return (
    <main className="relative min-h-screen overflow-hidden text-white">
      <WaterBackground />

      <style jsx global>{`
        @keyframes borderFlow {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
      `}</style>

      {/* Sidebar */}
      <aside
        data-no-ripple="true"
        className="fixed left-0 top-0 z-30 h-full"
        style={{
          width: sidebarCollapsed ? "84px" : "320px",
          transition: "width 180ms ease",
          background: "rgba(0,0,0,0.62)",
          borderRight: "1px solid rgba(255,255,255,0.10)",
          backdropFilter: "blur(10px)",
        }}
      >
        <div className="flex h-full flex-col p-3">
          {/* Company logo */}
          <div className="flex items-center gap-12 mb-3">
            <div
              className="relative rounded-2xl bg-white/10"
              style={{
                width: sidebarCollapsed ? 56 : 72,
                height: sidebarCollapsed ? 56 : 72,
                border: "1px solid rgba(255,255,255,0.12)",
                overflow: "hidden",
              }}
              title="Company"
            >
              <Image
                src="/images/company-logo.png"
                alt="Company logo"
                fill
                sizes="72px"
                style={{ objectFit: "contain", padding: "10px" }}
                priority
              />
            </div>

            {!sidebarCollapsed && (
              <div className="leading-tight">
                <div className="text-sm font-semibold text-white/90">RAY</div>
                <div className="text-[11px] text-white/55">Assistant</div>
              </div>
            )}
          </div>

          {/* Toggle + New Chat */}
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setSidebarCollapsed((v) => !v)}
              className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 hover:bg-white/15 transition"
              aria-label="Toggle sidebar"
              title="Toggle"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>

            {!sidebarCollapsed && (
              <button
                onClick={newChat}
                className="rounded-xl bg-cyan-300/90 px-3 py-2 text-xs font-semibold text-[#061a3a] hover:bg-cyan-200 transition"
                title="New Chat"
              >
                New Chat
              </button>
            )}
          </div>

          {sidebarCollapsed && (
            <button
              onClick={newChat}
              className="mt-3 grid h-10 w-10 place-items-center rounded-xl bg-cyan-300/90 text-[#061a3a] hover:bg-cyan-200 transition"
              aria-label="New Chat"
              title="New Chat"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          )}

          {!sidebarCollapsed && (
            <div className="mt-4 text-[11px] uppercase tracking-widest text-white/50">History</div>
          )}

          <div className="mt-2 flex-1 overflow-y-auto pr-1">
            {convos.map((c) => {
              const isActive = c.id === activeId;
              return (
                <div key={c.id} className="mb-2 flex items-center gap-2">
                  <button
                    onClick={() => openChat(c.id)}
                    className="flex-1 text-left rounded-xl px-3 py-2 transition"
                    style={{
                      background: isActive ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.10)",
                    }}
                    title={c.title}
                  >
                    {!sidebarCollapsed ? (
                      <div className="text-xs text-white/90">{c.title}</div>
                    ) : (
                      <div className="text-xs text-white/80 text-center">•</div>
                    )}
                  </button>

                  {!sidebarCollapsed && (
                    <button
                      onClick={() => deleteChat(c.id)}
                      className="grid h-9 w-9 place-items-center rounded-xl bg-white/6 hover:bg-white/12 transition"
                      style={{ border: "1px solid rgba(255,255,255,0.10)" }}
                      aria-label="Delete chat"
                      title="Delete"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path
                          d="M6 7h12M10 7V5h4v2m-7 0l1 14h8l1-14"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div
        className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col items-center px-4"
        style={{
          paddingLeft: sidebarCollapsed ? "104px" : "344px",
          transition: "padding-left 180ms ease",
        }}
      >
        <div className="mt-16 sm:mt-20 text-center select-none" data-no-ripple="true">
          <div className="relative mx-auto w-[240px] sm:w-[300px] md:w-[340px]">
            <div
              className="pointer-events-none absolute -inset-10 rounded-full"
              style={{
                background:
                  "radial-gradient(circle at 50% 35%, rgba(56,189,248,0.18) 0%, rgba(56,189,248,0.08) 35%, rgba(0,0,0,0) 70%)",
                filter: "blur(10px)",
              }}
            />

            <div
              className="relative w-full overflow-hidden"
              style={{ clipPath: "inset(6px round 999px)", borderRadius: "999px" }}
            >
              <video
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
                controls={false}
                tabIndex={-1}
                aria-hidden="true"
                className="block w-full h-auto"
                style={{
                  display: "block",
                  pointerEvents: "none",
                  userSelect: "none",
                  transform: "translateZ(0)",
                  backfaceVisibility: "hidden",
                  filter: "drop-shadow(0 18px 60px rgba(34,211,238,0.18))",
                }}
                poster="/media/ray-logo.png"
              >
                <source src="/media/ray-logo.webm" type="video/webm" />
                Your browser does not support the video tag.
              </video>
            </div>
          </div>

          <div
            className="mt-6 font-semibold text-white/92"
            style={{
              fontSize: "clamp(26px, 3vw, 52px)",
              lineHeight: 1.18,
              textShadow: "0 18px 60px rgba(0,0,0,0.55)",
              letterSpacing: "0.01em",
            }}
          >
            Welcome, What would you like to explore?
          </div>
        </div>

        <div className="w-full max-w-2xl" style={{ marginTop: "26vh" }} data-no-ripple="true">
          <div className="relative">
            <div
              className="absolute -inset-[2px] rounded-2xl"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, rgba(34,211,238,0.00), rgba(34,211,238,0.95), rgba(59,130,246,0.95), rgba(34,211,238,0.00))",
                backgroundSize: "200% 100%",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "0% 50%",
                animation: "borderFlow 3.2s linear infinite",
                filter: "drop-shadow(0 0 18px rgba(34,211,238,0.18))",
                WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                WebkitMaskComposite: "xor",
                maskComposite: "exclude",
                padding: "2px",
              }}
            />

            <div
              className="relative rounded-2xl bg-white/10 px-4 py-4"
              style={{ boxShadow: "0 35px 120px rgba(0,0,0,0.60)" }}
            >
              <div className="flex items-center gap-3">
                <input
                  ref={inputRef}
                  value={input}
                  disabled={sending}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") send();
                  }}
                  placeholder="What do you want to know?"
                  className="w-full bg-transparent text-sm text-white placeholder:text-white/60 outline-none"
                />
                <button
                  onClick={send}
                  disabled={sending || !input.trim()}
                  className="grid h-11 w-11 place-items-center rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Send"
                  style={{
                    background: "linear-gradient(135deg, rgba(34,211,238,0.95), rgba(59,130,246,0.90))",
                    boxShadow:
                      "0 18px 55px rgba(34,211,238,0.22), inset 0 0 0 1px rgba(255,255,255,0.18)",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-[#061a3a]" aria-hidden="true">
                    <path d="M5 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div className="mt-5 text-center text-xs text-white/70 whitespace-pre-wrap">
            {sending ? "RAY is thinking..." : lastAssistant}
          </div>
        </div>
      </div>
    </main>
  );
}