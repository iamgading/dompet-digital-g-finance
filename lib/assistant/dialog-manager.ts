import { format } from "node:util";

import { parseIndoCommand } from "@/lib/nlu/id-parser";
import type { PocketAlias } from "@/lib/nlu/pocket-alias-utils";
import { generatePocketAliasesFromName } from "@/lib/nlu/pocket-alias-utils";

export type DialogIntent = "income_to_pocket" | "expense_from_pocket" | "transfer_between_pockets";

export type DialogStep =
  | "init"
  | "ask-amount"
  | "ask-pocket"
  | "ask-pocket-from"
  | "ask-pocket-to"
  | "ask-note"
  | "confirm"
  | "executed";

export interface PocketOption {
  id: string;
  name: string;
}

export interface DialogState {
  intent: DialogIntent | null;
  amount?: number;
  pocket?: PocketOption;
  pocketFrom?: PocketOption;
  pocketTo?: PocketOption;
  note?: string | null;
  step: DialogStep;
  confirmed: boolean;
  noteAsked?: boolean;
}

export type ExecutionPlan =
  | {
      kind: "income";
      payload: { amount: number; pocketId: string; note?: string | null };
    }
  | {
      kind: "expense";
      payload: { amount: number; pocketId: string; note?: string | null };
    }
  | {
      kind: "transfer";
      payload: {
        amount: number;
        fromId: string;
        toId: string;
        note?: string | null;
      };
    };

export interface StepContext {
  text: string;
  state: DialogState;
  pockets: PocketOption[];
  aliases: PocketAlias[];
}

export interface StepResult {
  state: DialogState;
  message: string;
  options?: string[];
  execute?: boolean;
  plan?: ExecutionPlan;
}

const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const affirmativeTokens = new Set(["ya", "iya", "y", "yes", "lanjut", "lanjutkan", "oke", "ok", "sip", "jalan", "jalankan"]);
const negativeTokens = new Set(["tidak", "ga", "gak", "nggak", "enggak", "no", "batal", "cancel", "tidak jadi"]);
const skipTokens = new Set(["skip", "tidak", "ga", "gak", "nggak", "enggak", "kosongkan", "tanpa", "tidak ada"]);

export function createEmptyState(): DialogState {
  return {
    intent: null,
    step: "init",
    confirmed: false,
  };
}

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function isAffirmative(text: string): boolean {
  return affirmativeTokens.has(text.toLowerCase());
}

function isNegative(text: string): boolean {
  return negativeTokens.has(text.toLowerCase());
}

function shouldSkip(text: string): boolean {
  const trimmed = text.toLowerCase().trim();
  return skipTokens.has(trimmed) || trimmed === "" || trimmed === "-";
}

function resolvePocket(
  input: string,
  pockets: PocketOption[],
  aliases: PocketAlias[],
  excludeId?: string,
): PocketOption | null {
  const normalized = input.toLowerCase().trim();
  if (!normalized) return null;

  const direct = pockets.find((item) => item.name.toLowerCase() === normalized && item.id !== excludeId);
  if (direct) {
    return direct;
  }

  for (const entry of aliases) {
    if (excludeId && excludeId === entry.id) continue;
    if (entry.name.toLowerCase() === normalized) {
      return pockets.find((item) => item.id === entry.id) ?? null;
    }
    for (const alias of entry.aliases ?? []) {
      if (alias.toLowerCase() === normalized) {
        return pockets.find((item) => item.id === entry.id) ?? null;
      }
    }
  }

  return null;
}

function resolvePocketFromEntities(
  value: string | undefined,
  pockets: PocketOption[],
  aliases: PocketAlias[],
  excludeId?: string,
): PocketOption | undefined {
  if (!value) return undefined;
  return resolvePocket(value, pockets, aliases, excludeId) ?? undefined;
}

function formatSummary(state: DialogState): string {
  if (!state.intent) {
    return "Belum ada rencana transaksi.";
  }

  const amountText = state.amount ? currencyFormatter.format(state.amount) : "Rp0";
  switch (state.intent) {
    case "income_to_pocket":
      return format(
        "Tambahkan pemasukan %s ke %s%s?",
        amountText,
        state.pocket?.name ?? "(pocket belum ditentukan)",
        state.note ? ` dengan catatan “${state.note}”` : "",
      );
    case "expense_from_pocket":
      return format(
        "Catat pengeluaran %s dari %s%s?",
        amountText,
        state.pocket?.name ?? "(pocket belum ditentukan)",
        state.note ? ` dengan catatan “${state.note}”` : "",
      );
    case "transfer_between_pockets":
      return format(
        "Transfer %s dari %s ke %s%s?",
        amountText,
        state.pocketFrom?.name ?? "(asal belum ditentukan)",
        state.pocketTo?.name ?? "(tujuan belum ditentukan)",
        state.note ? ` dengan catatan “${state.note}”` : "",
      );
  }
}

function requiredFields(intent: DialogIntent): Array<keyof DialogState> {
  if (intent === "income_to_pocket") {
    return ["amount", "pocket"];
  }
  if (intent === "expense_from_pocket") {
    return ["amount", "pocket"];
  }
  return ["amount", "pocketFrom", "pocketTo"];
}

function mapParserResult(state: DialogState, text: string, pockets: PocketOption[], aliases: PocketAlias[]) {
  const parseResult = parseIndoCommand(text, {
    pockets: aliases,
  });

  if (parseResult.intent && !state.intent) {
    state.intent = parseResult.intent;
  }

  const entities = parseResult.entities ?? {};

  if (typeof entities.amount === "number" && entities.amount > 0) {
    state.amount = entities.amount;
  }

  if (!state.pocket && entities.pocket) {
    const pocket = resolvePocketFromEntities(entities.pocket, pockets, aliases);
    if (pocket) {
      state.pocket = pocket;
    }
  }

  if (!state.pocketFrom && entities.pocketFrom) {
    const pocket = resolvePocketFromEntities(entities.pocketFrom, pockets, aliases);
    if (pocket) {
      state.pocketFrom = pocket;
    }
  }

  if (!state.pocketTo && entities.pocketTo) {
    const pocket = resolvePocketFromEntities(entities.pocketTo, pockets, aliases, state.pocketFrom?.id);
    if (pocket) {
      state.pocketTo = pocket;
    }
  }

  if (!state.note && entities.note) {
    state.note = normalize(entities.note);
    state.noteAsked = true;
  }
}

function handleAmountAnswer(text: string, state: DialogState): boolean {
  const parsed = parseIndoCommand(text);
  if (parsed.entities.amount && parsed.entities.amount > 0) {
    state.amount = parsed.entities.amount;
    return true;
  }
  return false;
}

function handlePocketAnswer(
  text: string,
  state: DialogState,
  pockets: PocketOption[],
  aliases: PocketAlias[],
  target: "pocket" | "pocketFrom" | "pocketTo",
): boolean {
  const excludeId =
    target === "pocketFrom"
      ? state.pocketTo?.id
      : target === "pocketTo"
        ? state.pocketFrom?.id
        : undefined;
  const resolved = resolvePocket(text, pockets, aliases, excludeId);
  if (resolved) {
    state[target] = resolved;
    return true;
  }
  return false;
}

function handleNoteAnswer(text: string, state: DialogState) {
  if (shouldSkip(text)) {
    state.note = null;
  } else {
    state.note = normalize(text);
  }
  state.noteAsked = true;
}

function ensurePocketAliases(pockets: PocketOption[]): PocketAlias[] {
  return pockets.map((pocket) => ({
    id: pocket.id,
    name: pocket.name,
    aliases: generatePocketAliasesFromName(pocket.name),
  }));
}

function collectOptions(pockets: PocketOption[], excludeIds: string[] = []): string[] {
  return pockets.filter((pocket) => !excludeIds.includes(pocket.id)).map((pocket) => pocket.name);
}

function buildExecutionPlan(state: DialogState): ExecutionPlan | null {
  if (!state.intent || !state.amount) return null;

  if (state.intent === "income_to_pocket") {
    if (!state.pocket) return null;
    return {
      kind: "income",
      payload: {
        amount: state.amount,
        pocketId: state.pocket.id,
        note: state.note ?? undefined,
      },
    };
  }

  if (state.intent === "expense_from_pocket") {
    if (!state.pocket) return null;
    return {
      kind: "expense",
      payload: {
        amount: state.amount,
        pocketId: state.pocket.id,
        note: state.note ?? undefined,
      },
    };
  }

  if (!state.pocketFrom || !state.pocketTo) return null;

  return {
    kind: "transfer",
    payload: {
      amount: state.amount,
      fromId: state.pocketFrom.id,
      toId: state.pocketTo.id,
      note: state.note ?? undefined,
    },
  };
}

function enforceTransferConstraints(state: DialogState): string | null {
  if (state.intent !== "transfer_between_pockets") return null;
  if (state.pocketFrom && state.pocketTo && state.pocketFrom.id === state.pocketTo.id) {
    state.pocketTo = undefined;
    return "Pocket tujuan tidak boleh sama dengan pocket asal. Pilih tujuan lain.";
  }
  return null;
}

function nextQuestion(state: DialogState, pockets: PocketOption[]): { message: string; step: DialogStep; options?: string[] } {
  if (!state.intent) {
    return {
      message: "Kamu ingin mencatat pemasukan, pengeluaran, atau transfer antar pocket?",
      step: "init",
    };
  }

  const missing = requiredFields(state.intent).filter((field) => state[field] === undefined || state[field] === null);

  if (missing.includes("amount")) {
    return {
      message: "Nominalnya berapa?",
      step: "ask-amount",
    };
  }

  if (state.intent === "transfer_between_pockets") {
    if (!state.pocketFrom) {
      return {
        message: "Dana akan diambil dari pocket mana?",
        step: "ask-pocket-from",
        options: collectOptions(pockets),
      };
    }
    if (!state.pocketTo) {
      return {
        message: "Pocket tujuan transfernya apa?",
        step: "ask-pocket-to",
        options: collectOptions(pockets, state.pocketFrom ? [state.pocketFrom.id] : []),
      };
    }
  } else if (!state.pocket) {
    return {
      message: "Pocket mana yang dimaksud?",
      step: "ask-pocket",
      options: collectOptions(pockets),
    };
  }

  if (!state.noteAsked) {
    return {
      message: "Ada catatan tambahan? (boleh kosong)",
      step: "ask-note",
    };
  }

  const summary = formatSummary(state);
  return {
    message: `${summary} Jika sudah siap, jawab "ya" untuk mengeksekusi.`,
    step: "confirm",
  };
}

export function step(context: StepContext): StepResult {
  const pockets =
    context.aliases && context.aliases.length > 0
      ? context.pockets
      : context.pockets;
  const aliases = context.aliases && context.aliases.length > 0 ? context.aliases : ensurePocketAliases(context.pockets);
  const state: DialogState = {
    ...context.state,
  };
  let responseMessage: string | null = null;
  let options: string[] | undefined;
  let execute = false;
  let plan: ExecutionPlan | null = null;

  const text = normalize(context.text);
  const lower = text.toLowerCase();

  if (state.confirmed && state.step === "executed") {
    state.intent = null;
    state.amount = undefined;
    state.pocket = undefined;
    state.pocketFrom = undefined;
    state.pocketTo = undefined;
    state.note = undefined;
    state.noteAsked = false;
    state.confirmed = false;
    state.step = "init";
  }

  if (!state.intent) {
    mapParserResult(state, text, pockets, aliases);
    if (!state.intent) {
      return {
        state,
        message: "Maaf, aku belum menangkap maksudmu. Coba jelaskan apakah ini pemasukan, pengeluaran, atau transfer.",
      };
    }
  } else if (state.step === "ask-amount") {
    if (!handleAmountAnswer(text, state)) {
      return {
        state,
        message: "Belum bisa membaca nominalnya. Pastikan kamu menulis angka yang jelas, contoh: 250k atau 2.500.000.",
        options,
      };
    }
  } else if (state.step === "ask-pocket") {
    if (!handlePocketAnswer(text, state, pockets, aliases, "pocket")) {
      return {
        state,
        message: "Aku tidak menemukan pocket tersebut. Sebutkan nama pocket persis atau pilih dari pilihan yang ada.",
        options: collectOptions(pockets),
      };
    }
  } else if (state.step === "ask-pocket-from") {
    if (!handlePocketAnswer(text, state, pockets, aliases, "pocketFrom")) {
      return {
        state,
        message: "Pocket asal tidak ditemukan. Pilih dari daftar pocket yang tersedia.",
        options: collectOptions(pockets),
      };
    }
  } else if (state.step === "ask-pocket-to") {
    if (!handlePocketAnswer(text, state, pockets, aliases, "pocketTo")) {
      return {
        state,
        message: "Pocket tujuan tidak ditemukan. Pilih dari daftar pocket yang tersedia.",
        options: collectOptions(pockets, state.pocketFrom ? [state.pocketFrom.id] : []),
      };
    }
  } else if (state.step === "ask-note") {
    handleNoteAnswer(text, state);
  } else if (state.step === "confirm") {
    if (isAffirmative(lower)) {
      plan = buildExecutionPlan(state);
      if (!plan) {
        return {
          state,
          message: "Sepertinya masih ada data yang belum lengkap. Coba sebutkan lagi detail transaksinya.",
        };
      }
      execute = true;
      state.confirmed = true;
      state.step = "executed";
      const summary = formatSummary(state) ?? "Menjalankan instruksi.";
      responseMessage = summary.replace(/\?$/, ".");
    } else if (isNegative(lower)) {
      state.confirmed = false;
      state.step = "init";
      state.intent = null;
      state.amount = undefined;
      state.pocket = undefined;
      state.pocketFrom = undefined;
      state.pocketTo = undefined;
      state.note = undefined;
      state.noteAsked = false;
      return {
        state,
        message: "Baik, transaksi dibatalkan. Kamu bisa mulai lagi dengan perintah baru.",
      };
    } else {
      return {
        state,
        message: "Jika sudah yakin, jawab “ya”. Jika ingin membatalkan, jawab “tidak”.",
      };
    }
  } else {
    mapParserResult(state, text, pockets, aliases);
  }

  const constraintWarning = enforceTransferConstraints(state);
  if (constraintWarning) {
    return {
      state,
      message: constraintWarning,
      options: collectOptions(pockets, state.pocketFrom ? [state.pocketFrom.id] : []),
    };
  }

  if (!responseMessage) {
    const next = nextQuestion(state, pockets);
    state.step = next.step;
    responseMessage = next.message;
    options = next.options;
  }

  return {
    state,
    message: responseMessage,
    options,
    execute,
    plan: plan ?? undefined,
  };
}
