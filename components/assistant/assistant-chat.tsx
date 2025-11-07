"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Mic, Send, Undo2, Play, ArrowLeft } from "lucide-react";

import type { ChatTurnDTO, AssistantSubmitResult } from "@/lib/assistant/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AssistantChatProps {
  initialSessionId: string;
  initialTurns: ChatTurnDTO[];
  onSend: (input: { sessionId?: string; text: string }) => Promise<AssistantSubmitResult>;
  onUndo: (input: { sessionId: string; undoToken: string }) => Promise<{ success: boolean; error?: string; turn?: ChatTurnDTO }>;
  onNavigateDashboard?: () => void;
}

interface AssistantPayload {
  options?: string[];
  undoToken?: string;
  undoExpiresAt?: string;
  execute?: boolean;
  type?: "question" | "confirmation" | "result" | "error";
}

function formatTime(value: string) {
  try {
    return new Intl.DateTimeFormat("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function withinUndoWindow(payload: AssistantPayload | null | undefined): boolean {
  if (!payload?.undoToken || !payload.undoExpiresAt) return false;
  const expires = Date.parse(payload.undoExpiresAt);
  if (Number.isNaN(expires)) return false;
  return Date.now() < expires;
}

export function AssistantChat({ initialSessionId, initialTurns, onSend, onUndo, onNavigateDashboard }: AssistantChatProps) {
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [turns, setTurns] = useState<ChatTurnDTO[]>(initialTurns);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const listRef = useRef<HTMLDivElement | null>(null);

  const chatTurns = useMemo(
    () =>
      turns.map((turn) => ({
        ...turn,
        payload: (turn.payload ?? null) as AssistantPayload | null,
      })),
    [turns],
  );

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [chatTurns]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) {
      setError("Pesan tidak boleh kosong.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result: AssistantSubmitResult = await onSend({ sessionId, text: trimmed });
      if (!result.success) {
        setError(result.error ?? "Terjadi kesalahan.");
        return;
      }
      if (result.sessionId) {
        setSessionId(result.sessionId);
      }
      setTurns((prev) => [...prev, ...(result.turns ?? [])]);
      setMessage("");
      setInfo(null);
    });
  };

  const handleQuickOption = (option: string) => {
    setMessage(option);
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const result: AssistantSubmitResult = await onSend({ sessionId, text: option });
      if (!result.success) {
        setError(result.error ?? "Terjadi kesalahan.");
        return;
      }
      if (result.sessionId) {
        setSessionId(result.sessionId);
      }
      setTurns((prev) => [...prev, ...(result.turns ?? [])]);
      setMessage("");
      setInfo(null);
    });
  };

  const handleUndo = (token: string) => {
    startTransition(async () => {
      const result = await onUndo({ sessionId, undoToken: token });
      if (!result.success) {
        setInfo(result.error ?? "Undo gagal dijalankan.");
        return;
      }
      if (result.turn) {
        setTurns((prev) => [...prev, result.turn!]);
      }
      setTurns((prev) =>
        prev.map((turn) => {
          const payload = (turn.payload ?? null) as AssistantPayload | null;
          if (payload?.undoToken === token) {
            return {
              ...turn,
              payload: {
                ...payload,
                undoToken: undefined,
                undoExpiresAt: undefined,
              },
            };
          }
          return turn;
        }),
      );
      setInfo("Transaksi berhasil di-undo.");
    });
  };

  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-6xl flex-col gap-6 px-6 py-12 lg:flex-row">
      <section className="flex flex-1 flex-col overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br from-white/70 via-white/60 to-cyan-100/40 shadow-xl backdrop-blur dark:border-white/10 dark:from-slate-900/80 dark:via-slate-900/70 dark:to-slate-900/60">
        <header className="flex flex-col gap-4 border-b border-white/40 px-6 py-6 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  if (onNavigateDashboard) {
                    onNavigateDashboard();
                  } else {
                    window.location.href = "/";
                  }
                }}
                className="h-10 rounded-full px-3 text-slate-600 hover:text-cyan-600 dark:text-slate-300 dark:hover:text-cyan-300"
              >
                <ArrowLeft className="h-4 w-4" />
                Dashboard
              </Button>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-white">AI Assistant</h1>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Diskusikan rencana finansialmu. Aku bantu lengkapi datanya dan jalankan transaksi jika siap.
            </p>
          </div>
          {info ? <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs text-cyan-700 dark:text-cyan-300">{info}</span> : null}
        </header>
        <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
          {chatTurns.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-300">
              Belum ada percakapan. Mulai dengan mengetik perintah finansial di kolom sebelah.
            </div>
          ) : (
            chatTurns.map((turn) => {
              const isUser = turn.role === "user";
              const payload = turn.payload;
              const showUndo = !isUser && withinUndoWindow(payload);
              return (
                <div key={turn.id} className={cn("flex", isUser ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[82%] rounded-3xl border px-5 py-4 shadow-sm",
                      isUser
                        ? "border-cyan-200/70 bg-gradient-to-r from-cyan-500/20 to-sky-500/20 text-slate-900 dark:border-cyan-500/40 dark:from-cyan-500/20 dark:to-sky-500/10 dark:text-cyan-100"
                        : "border-slate-200/70 bg-white/95 text-slate-800 backdrop-blur dark:border-slate-700/50 dark:bg-slate-800/80 dark:text-slate-100",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">
                      <span>{isUser ? "Kamu" : "Assistant"}</span>
                      <time>{formatTime(turn.createdAt)}</time>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{turn.text}</p>
                    {!isUser && payload?.options && payload.options.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {payload.options.map((option) => (
                          <Button
                            key={option}
                            size="sm"
                            variant="outline"
                            className="rounded-full border-cyan-500/40 text-cyan-600 hover:bg-cyan-500/10 dark:border-cyan-400/40 dark:text-cyan-200 dark:hover:bg-cyan-500/10"
                            type="button"
                            onClick={() => handleQuickOption(option)}
                          >
                            {option}
                          </Button>
                        ))}
                      </div>
                    ) : null}
                    {!isUser && showUndo && payload?.undoToken ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="rounded-full px-4"
                          disabled={isPending}
                          onClick={() => handleUndo(payload.undoToken!)}
                        >
                          <Undo2 className="mr-2 h-4 w-4" />
                          Undo
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <aside className="flex w-full flex-col rounded-3xl border border-white/20 bg-white/80 p-6 shadow-xl backdrop-blur dark:border-white/10 dark:bg-slate-900/80 lg:max-w-sm">
        <form className="flex h-full flex-col gap-4" onSubmit={handleSubmit}>
          <label className="flex-1">
            <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Ketik perintah atau pertanyaanmu
            </span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Contoh: “Tambah pemasukan 2 juta ke Tabungan”"
              className="min-h-[160px] w-full resize-none rounded-2xl border border-slate-200/70 bg-white/95 p-4 text-sm text-slate-800 shadow-inner outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400 dark:border-slate-700/60 dark:bg-slate-900/90 dark:text-slate-100"
              disabled={isPending}
            />
          </label>
          {error ? <p className="text-sm text-rose-500 dark:text-rose-300">{error}</p> : null}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              variant="secondary"
              disabled
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300/80 bg-slate-100/70 text-slate-500 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-400"
            >
              <Mic className="h-4 w-4" />
              Mic (segera)
            </Button>
            <Button
              type="submit"
              className="flex-1 rounded-2xl bg-gradient-to-r from-cyan-500 to-sky-500 text-sm font-semibold text-white shadow-lg transition hover:from-cyan-600 hover:to-sky-600 focus-visible:ring-offset-2 disabled:opacity-70 dark:from-cyan-500/90 dark:to-sky-500/90"
              disabled={isPending}
            >
              <Send className="mr-2 h-4 w-4" />
              Kirim
            </Button>
          </div>
        </form>
      </aside>
    </div>
  );
}
