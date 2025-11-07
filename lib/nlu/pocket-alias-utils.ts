export interface PocketAlias {
  id: string;
  name: string;
  aliases: string[];
}

const ABBREVIATION_MAP: Record<string, string> = {
  keb: "kebutuhan",
  kebu: "kebutuhan",
  kebutuhan: "kebutuhan",
  pokok: "pokok",
  tab: "tabungan",
  tabung: "tabungan",
  tabungan: "tabungan",
  invest: "investasi",
  investasi: "investasi",
  operasional: "operasional",
  darurat: "darurat",
  e: "e",
  money: "money",
  emoney: "emoney",
};

function sanitizePocketName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/['’]/g, "")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function expandToken(token: string): string[] {
  const base = ABBREVIATION_MAP[token] ?? token;
  if (base === token) {
    return [token];
  }
  return [token, base];
}

export function generatePocketAliasesFromName(name: string): string[] {
  const sanitized = sanitizePocketName(name);
  if (!sanitized) return [];

  const aliasSet = new Set<string>();
  aliasSet.add(sanitized);

  const tokens = sanitized.split(" ");
  if (tokens.length > 1) {
    aliasSet.add(tokens.join(" "));
  }

  const expandedTokens = tokens.map((token) => expandToken(token));

  const primaryExpansion = tokens
    .map((token) => (ABBREVIATION_MAP[token] ? ABBREVIATION_MAP[token] : token))
    .join(" ")
    .trim();
  if (primaryExpansion && primaryExpansion !== sanitized) {
    aliasSet.add(primaryExpansion);
  }

  expandedTokens.forEach((alternatives) => {
    alternatives.forEach((alt) => {
      if (alt.length > 1) {
        aliasSet.add(alt);
      }
    });
  });

  if (sanitized.includes("-") || name.includes("-")) {
    const noHyphen = sanitized.replace(/-/g, " ");
    const compact = sanitized.replace(/[\s-]/g, "");
    if (noHyphen) aliasSet.add(noHyphen);
    if (compact) aliasSet.add(compact);
  }

  if (sanitized.includes("emoney") || sanitized.includes("e money")) {
    aliasSet.add("e money");
    aliasSet.add("emoney");
    aliasSet.add("saldo e money");
  }
  if (sanitized.includes("tabungan")) {
    aliasSet.add("tabungan");
  }
  if (sanitized.includes("kebutuhan") && sanitized.includes("pokok")) {
    aliasSet.add("kebutuhan pokok");
  }

  return Array.from(aliasSet)
    .map((alias) => alias.trim())
    .filter(Boolean);
}
