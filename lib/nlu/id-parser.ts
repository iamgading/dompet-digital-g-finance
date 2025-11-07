import type { PocketAlias } from "@/lib/nlu/pocket-alias-utils";

export type IndoIntent = "income_to_pocket" | "expense_from_pocket" | "transfer_between_pockets" | null;

export interface ParsedEntities {
  amount?: number;
  pocket?: string;
  pocketFrom?: string;
  pocketTo?: string;
  note?: string;
  amountText?: string;
}

export interface ParseResult {
  intent: IndoIntent;
  entities: ParsedEntities;
  missing: string[];
}

export interface ParserOptions {
  pockets?: PocketAlias[];
}

const CURRENCY_FORMATTER = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const INCOME_KEYWORDS = ["pemasukan", "income", "gaji", "tambah saldo"];
const EXPENSE_KEYWORDS = ["pengeluaran", "keluarkan", "bayar", "pakai"];
const TRANSFER_KEYWORDS = ["transfer", "kirim", "pindahkan", "pindah"];

const NOTE_PREFIX_PATTERN = /\b(buat|untuk|karena|biar)\s+(.+)/i;

const AMOUNT_PATTERN = /\d[\d.,]*(?:\s*(?:jt|juta|m|k|rb|ribu))?(?:\s*\d{1,3})?/gi;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sanitizeForPocketMatching(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/['’]/g, "")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeIndo(text: string): string {
  let normalized = text.toLowerCase().normalize("NFKD");
  normalized = normalized
    .replace(/['’]/g, "")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s.,]/g, " ")
    .replace(/\s+/g, " ");

  const synonymReplacements: Array<[RegExp, string]> = [
    [/\bmemasukkan\b/g, " pemasukan "],
    [/\bmendapat(?:kan)?\b/g, " pemasukan "],
    [/\bdapat\b/g, " pemasukan "],
    [/\bterima\b/g, " pemasukan "],
    [/\bmasukkan\b/g, " pemasukan "],
    [/\bgaji\b/g, " income "],
    [/\btambah(?:kan)?\s+saldo\b/g, " tambah saldo "],
    [/\btambah\b(?=\s+saldo)/g, " tambah saldo "],
    [/\btransfer\b|\bkirim\b|\bpindahkan\b|\bpindah\b/g, " transfer "],
    [/\bkeluarkan\b|\bpengeluaran\b|\bbayar\b|\bpakai\b|\bbelanja\b/g, " pengeluaran "],
  ];

  for (const [pattern, replacement] of synonymReplacements) {
    normalized = normalized.replace(pattern, replacement);
  }

  const unitReplacements: Array<[RegExp, string]> = [
    [/\bjt\b/g, " juta "],
    [/\bjuta\b/g, " juta "],
    [/\brb\b/g, " ribu "],
    [/\bribu\b/g, " ribu "],
    [/\bk\b/g, " ribu "],
  ];

  for (const [pattern, replacement] of unitReplacements) {
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized.replace(/\s+/g, " ").trim();
}

function formatCurrency(value: number): string {
  return CURRENCY_FORMATTER.format(value);
}

export function parseAmountIndo(raw: string): number | null {
  if (!raw) return null;
  let value = raw.toLowerCase();
  value = value.replace(/\s+/g, " ").trim();
  let working = value.replace(/rp\.?/g, "").replace(/idr/g, "").trim();

  // Remove thousand separators noted by . or , when followed by 3 digits.
  working = working.replace(/(\d)[.,](?=\d{3}\b)/g, "$1");
  // Normalize decimal separator to dot for fractional millions.
  working = working.replace(/,/g, ".");

  // Convert textual units to symbolic markers.
  working = working.replace(/\bjuta\b/g, "m");
  working = working.replace(/\bjt\b/g, "m");
  working = working.replace(/\bm\b/g, "m");
  working = working.replace(/\bribu\b/g, "k");
  working = working.replace(/\brb\b/g, "k");
  working = working.replace(/\bk\b/g, "k");

  // Insert spaces between number and unit when missing (e.g., 3m400).
  working = working.replace(/(\d)(?=[mk])/g, "$1 ");
  working = working.replace(/([mk])(?=\d)/g, "$1 ");

  const tokens = working.match(/(\d+(?:\.\d+)?)|[mk]/g);
  if (!tokens) return null;

  let total = 0;
  let index = 0;
  let lastMagnitude = 1;

  while (index < tokens.length) {
    const token = tokens[index];
    if (!token) {
      index += 1;
      continue;
    }

    if (token === "m" || token === "k") {
      // Skip isolated unit markers without preceding value.
      lastMagnitude = token === "m" ? 1_000_000 : 1_000;
      index += 1;
      continue;
    }

    const numeric = Number.parseFloat(token);
    if (Number.isNaN(numeric)) {
      index += 1;
      continue;
    }

    let multiplier = 1;
    const next = tokens[index + 1];

    if (next === "m") {
      multiplier = 1_000_000;
      index += 1;
    } else if (next === "k") {
      multiplier = 1_000;
      index += 1;
    } else if (lastMagnitude === 1_000_000 && numeric < 1000) {
      multiplier = 1_000;
    } else {
      multiplier = 1;
    }

    total += Math.round(numeric * multiplier);
    lastMagnitude = multiplier;
    index += 1;
  }

  return total > 0 ? total : null;
}

function extractAmount(text: string): { amount: number; source: string } | null {
  const candidates = text.match(AMOUNT_PATTERN);
  if (!candidates) return null;

  for (const candidate of candidates) {
    const parsed = parseAmountIndo(candidate);
    if (parsed && parsed > 0) {
      return { amount: parsed, source: candidate.trim() };
    }
  }

  return null;
}

function matchPocketByKeyword(
  text: string,
  keyword: string,
  entries: PocketAlias[],
  ignoreIds: Set<string>,
): PocketAlias | null {
  for (const entry of entries) {
    if (ignoreIds.has(entry.id)) continue;
    for (const alias of entry.aliases) {
      if (!alias) continue;
      const pattern = new RegExp(`\\b${keyword}\\s+${escapeRegex(alias)}\\b`);
      if (pattern.test(text)) {
        return entry;
      }
    }
  }
  return null;
}

function matchPocketAnywhere(text: string, entries: PocketAlias[], ignoreIds: Set<string>): PocketAlias | null {
  for (const entry of entries) {
    if (ignoreIds.has(entry.id)) continue;
    for (const alias of entry.aliases) {
      if (!alias) continue;
      const pattern = new RegExp(`\\b${escapeRegex(alias)}\\b`);
      if (pattern.test(text)) {
        return entry;
      }
    }
  }
  return null;
}

function detectIntent(normalized: string): IndoIntent {
  if (TRANSFER_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return "transfer_between_pockets";
  }
  if (INCOME_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return "income_to_pocket";
  }
  if (EXPENSE_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return "expense_from_pocket";
  }
  return null;
}

export function parseIndoCommand(text: string, options: ParserOptions = {}): ParseResult {
  const normalized = normalizeIndo(text);
  const sanitized = sanitizeForPocketMatching(text);
  const entries = options.pockets ?? [];

  const entities: ParsedEntities = {};
  const missing: string[] = [];

  const amountInfo = extractAmount(text);
  if (amountInfo) {
    entities.amount = amountInfo.amount;
    entities.amountText = amountInfo.source;
  } else {
    missing.push("amount");
  }

  const intent = detectIntent(normalized);

  const ignoreIds = new Set<string>();

  if (intent === "income_to_pocket") {
    const target =
      matchPocketByKeyword(sanitized, "ke", entries, ignoreIds) ??
      matchPocketByKeyword(sanitized, "masuk", entries, ignoreIds) ??
      matchPocketAnywhere(sanitized, entries, ignoreIds);
    if (target) {
      entities.pocket = target.name;
      ignoreIds.add(target.id);
    } else {
      missing.push("pocket");
    }
  }

  if (intent === "expense_from_pocket") {
    const target =
      matchPocketByKeyword(sanitized, "dari", entries, ignoreIds) ??
      matchPocketAnywhere(sanitized, entries, ignoreIds);
    if (target) {
      entities.pocket = target.name;
      ignoreIds.add(target.id);
    } else {
      missing.push("pocket");
    }
  }

  if (intent === "transfer_between_pockets") {
    const from =
      matchPocketByKeyword(sanitized, "dari", entries, ignoreIds) ??
      matchPocketAnywhere(sanitized, entries, ignoreIds);
    if (from) {
      entities.pocketFrom = from.name;
      ignoreIds.add(from.id);
    } else {
      missing.push("pocketFrom");
    }

    const to =
      matchPocketByKeyword(sanitized, "ke", entries, ignoreIds) ??
      matchPocketAnywhere(sanitized, entries, ignoreIds);
    if (to) {
      entities.pocketTo = to.name;
      ignoreIds.add(to.id);
    } else {
      missing.push("pocketTo");
    }
  }

  const noteMatch = NOTE_PREFIX_PATTERN.exec(text);
  if (noteMatch && noteMatch[2]) {
    const rawNote = noteMatch[2].trim().replace(/[.!?]$/, "");
    if (rawNote) {
      entities.note = rawNote;
    }
  }

  return {
    intent,
    entities,
    missing,
  };
}

export function describeParseResult(result: ParseResult): string {
  if (!result.intent) {
    return "Saya belum bisa memahami permintaanmu. Bisa jelaskan lagi?";
  }

  const parts: string[] = [];
  const { intent, entities, missing } = result;

  const amountText = entities.amount ? formatCurrency(entities.amount) : "nominal belum disebutkan";
  if (intent === "income_to_pocket") {
    const pocketText = entities.pocket ? ` ke ${entities.pocket}` : "";
    parts.push(`Saya mengenali niat pemasukan sebesar ${amountText}${pocketText}.`);
  } else if (intent === "expense_from_pocket") {
    const pocketText = entities.pocket ? ` dari ${entities.pocket}` : "";
    parts.push(`Saya mengenali niat pengeluaran sebesar ${amountText}${pocketText}.`);
  } else if (intent === "transfer_between_pockets") {
    const fromText = entities.pocketFrom ? ` dari ${entities.pocketFrom}` : "";
    const toText = entities.pocketTo ? ` ke ${entities.pocketTo}` : "";
    parts.push(`Saya menangkap niat transfer sebesar ${amountText}${fromText}${toText}.`);
  }

  if (entities.note) {
    parts.push(`Catatan: ${entities.note}.`);
  }

  if (missing.length > 0) {
    const missingPrompts: Record<string, string> = {
      amount: "Nominal transaksinya belum ada.",
      pocket: "Pocket tujuan belum kamu sebutkan.",
      pocketFrom: "Pocket asal perlu disebutkan.",
      pocketTo: "Pocket tujuan transfer belum jelas.",
    };
    const prompts = missing.map((item) => missingPrompts[item] ?? item);
    parts.push(`${prompts.join(" ")} Beritahu detailnya, ya.`);
  } else {
    parts.push("Jika sudah benar, kamu bisa minta aku untuk menjalankannya.");
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}
