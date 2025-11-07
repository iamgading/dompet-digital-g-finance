"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { getSupabaseAdminClient, type Database } from "@/lib/supabase";
import { buildPocketAliases } from "@/lib/nlu/pocket-alias";
import { createEmptyState, step, type DialogState, type PocketOption } from "@/lib/assistant/dialog-manager";
import type { StepResult } from "@/lib/assistant/dialog-manager";
import type { ChatTurnDTO, AssistantSubmitResult } from "@/lib/assistant/types";
import { execPlan, undoByToken } from "@/app/assistant/assistant-exec";

type ChatRole = Database["public"]["Enums"]["ChatRole"];
type ChatTurnRow = Database["public"]["Tables"]["ChatTurn"]["Row"];
type ChatSessionRow = Database["public"]["Tables"]["ChatSession"]["Row"];

interface SessionRecord {
  id: string;
  state: DialogState;
}

interface AssistantPayload {
  options?: string[];
  undoToken?: string;
  undoExpiresAt?: string;
  plan?: unknown;
  execute?: boolean;
  type?: "question" | "confirmation" | "result" | "error";
}

function toDTO(row: ChatTurnRow): ChatTurnDTO {
  return {
    id: row.id,
    role: row.role,
    text: row.text,
    createdAt: new Date(row.createdAt ?? new Date().toISOString()).toISOString(),
    sessionId: row.sessionId ?? undefined,
    payload: (row.payload as unknown) ?? null,
  };
}

async function logTurn(params: {
  role: ChatRole;
  text: string;
  payload?: unknown;
  sessionId: string;
}): Promise<ChatTurnDTO> {
  const supabase = getSupabaseAdminClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("ChatTurn")
    .insert([
      {
        id: randomUUID(),
        role: params.role,
        text: params.text,
        payload: (params.payload ?? null) as Database["public"]["Tables"]["ChatTurn"]["Row"]["payload"],
        sessionId: params.sessionId,
        createdAt: nowIso,
      },
    ])
    .select()
    .single();

  if (error) {
    throw new Error(`Gagal menyimpan percakapan: ${error.message}`);
  }

  return toDTO(data);
}

function parseState(value: unknown): DialogState {
  if (!value || typeof value !== "object") {
    return createEmptyState();
  }
  const raw = value as Partial<DialogState>;
  return {
    ...createEmptyState(),
    ...raw,
  };
}

async function ensureSession(sessionId?: string): Promise<SessionRecord> {
  const supabase = getSupabaseAdminClient();
  if (sessionId) {
    const { data, error } = await supabase.from("ChatSession").select("*").eq("id", sessionId).maybeSingle();
    if (error) {
      throw new Error(`Gagal memuat sesi: ${error.message}`);
    }
    if (data) {
      return {
        id: data.id,
        state: parseState(data.state),
      };
    }
  }

  const state = createEmptyState();
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("ChatSession")
    .insert([
      {
        id: randomUUID(),
        state: state as unknown as Database["public"]["Tables"]["ChatSession"]["Row"]["state"],
        createdAt: nowIso,
        lastActiveAt: nowIso,
      },
    ])
    .select()
    .single();

  if (error) {
    throw new Error(`Gagal membuat sesi baru: ${error.message}`);
  }

  return {
    id: data.id,
    state,
  };
}

async function saveSessionState(sessionId: string, state: DialogState) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("ChatSession")
    .update({
      state: state as unknown as Database["public"]["Tables"]["ChatSession"]["Row"]["state"],
      lastActiveAt: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) {
    throw new Error(`Gagal menyimpan state sesi: ${error.message}`);
  }
}

async function loadPockets(): Promise<PocketOption[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("Pocket")
    .select("id,name")
    .eq("isActive", true)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Gagal memuat daftar pocket: ${error.message}`);
  }

  return (data ?? []) as PocketOption[];
}

function assistantPayloadFromStep(result: StepResult): AssistantPayload {
  const payload: AssistantPayload = {
    type: result.execute ? "confirmation" : "question",
    execute: result.execute,
  };
  if (result.options && result.options.length > 0) {
    payload.options = result.options;
  }
  if (result.plan) {
    payload.plan = result.plan;
  }
  return payload;
}

function formatExecutionMessage(details: unknown, plan: NonNullable<StepResult["plan"]>): string {
  if (!plan || !details || typeof details !== "object") {
    return "Instruksi selesai dijalankan.";
  }

  if (plan.kind === "income") {
    const result = details as {
      transaction: { amount: number };
      pocket: { name: string; balance: number };
    };
    return `Pemasukan sebesar Rp${result.transaction.amount.toLocaleString("id-ID")} dicatat ke ${result.pocket.name}. Saldo pocket sekarang Rp${result.pocket.balance.toLocaleString("id-ID")}.`;
  }

  if (plan.kind === "expense") {
    const result = details as {
      transaction: { amount: number };
      pocket: { name: string; balance: number };
    };
    return `Pengeluaran Rp${result.transaction.amount.toLocaleString("id-ID")} dari ${result.pocket.name} berhasil dicatat. Saldo pocket sekarang Rp${result.pocket.balance.toLocaleString("id-ID")}.`;
  }

  const transfer = details as {
    fromPocket: { name: string; balance: number };
    toPocket: { name: string; balance: number };
  };
  return `Transfer dari ${transfer.fromPocket.name} ke ${transfer.toPocket.name} selesai. Saldo terbaru: ${transfer.fromPocket.name} Rp${transfer.fromPocket.balance.toLocaleString("id-ID")} · ${transfer.toPocket.name} Rp${transfer.toPocket.balance.toLocaleString("id-ID")}.`;
}

export async function initializeAssistantSession() {
  const session = await ensureSession(undefined);
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("ChatTurn")
    .select("*")
    .eq("sessionId", session.id)
    .order("createdAt", { ascending: true });

  if (error) {
    throw new Error(`Gagal memuat riwayat percakapan: ${error.message}`);
  }

  return {
    sessionId: session.id,
    history: (data ?? []).map(toDTO),
  };
}

export async function getChatHistory(sessionId: string): Promise<ChatTurnDTO[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("ChatTurn")
    .select("*")
    .eq("sessionId", sessionId)
    .order("createdAt", { ascending: true });

  if (error) {
    throw new Error(`Gagal memuat riwayat percakapan: ${error.message}`);
  }

  return (data ?? []).map(toDTO);
}

export async function submitAssistantMessage(input: { sessionId?: string; text: string }): Promise<AssistantSubmitResult> {
  const text = input.text?.trim();
  if (!text) {
    return { success: false, error: "Pesan tidak boleh kosong." };
  }

  const session = await ensureSession(input.sessionId);
  const pockets = await loadPockets();
  const aliases = await buildPocketAliases();

  const userTurn = await logTurn({
    role: "user",
    text,
    sessionId: session.id,
  });

  const stepResult = step({
    text,
    state: session.state,
    pockets,
    aliases,
  });

  await saveSessionState(session.id, stepResult.state);

  const assistantTurns: ChatTurnDTO[] = [];
  const assistantPrompt = await logTurn({
    role: "assistant",
    text: stepResult.message,
    payload: assistantPayloadFromStep(stepResult),
    sessionId: session.id,
  });
  assistantTurns.push(assistantPrompt);

  if (stepResult.execute && stepResult.plan) {
    const execution = await execPlan(stepResult.plan);
    if (!execution.success) {
      const errorTurn = await logTurn({
        role: "assistant",
        text: `Terjadi kesalahan saat mengeksekusi: ${execution.error}`,
        payload: {
          type: "error",
        },
        sessionId: session.id,
      });
      assistantTurns.push(errorTurn);
      stepResult.state.step = "confirm";
      stepResult.state.confirmed = false;
      await saveSessionState(session.id, stepResult.state);
      return {
        success: false,
        error: execution.error,
        sessionId: session.id,
        turns: [userTurn, assistantPrompt, errorTurn],
      };
    }

    const successMessage = formatExecutionMessage(execution.details, stepResult.plan);
    const resultTurn = await logTurn({
      role: "assistant",
      text: successMessage,
      payload: {
        type: "result",
        undoToken: execution.undoToken,
        undoExpiresAt: execution.undoExpiresAt,
      },
      sessionId: session.id,
    });
    assistantTurns.push(resultTurn);

    const resetState = createEmptyState();
    await saveSessionState(session.id, resetState);
  }

  revalidatePath("/assistant");

  return {
    success: true,
    sessionId: session.id,
    turns: [userTurn, ...assistantTurns],
  };
}

export async function performUndo(input: { sessionId: string; undoToken: string }) {
  const session = await ensureSession(input.sessionId);
  const result = await undoByToken(input.undoToken);
  if (!result.success) {
    const turn = await logTurn({
      role: "assistant",
      text: `Undo gagal: ${result.error}`,
      payload: { type: "error" },
      sessionId: session.id,
    });
    return {
      success: false,
      error: result.error,
      turn,
    };
  }

  const turn = await logTurn({
    role: "assistant",
    text: "Transaksi berhasil di-undo. Saldo pocket telah dikembalikan.",
    payload: { type: "result" },
    sessionId: session.id,
  });

  revalidatePath("/assistant");
  return {
    success: true,
    turn,
  };
}
