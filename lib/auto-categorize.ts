const DEFAULT_RULES = [
  {
    pocketName: "Kebutuhan Pokok",
    keywords: ["indomaret", "alfamart", "supermarket", "hypermart", "farmers market"],
  },
  {
    pocketName: "E-Money",
    keywords: ["gopay", "ovo", "dana", "shopeepay", "linkaja"],
  },
  {
    pocketName: "Transport",
    keywords: ["grab", "gojek", "bbm", "spbu", "shell", "pertamina", "angkot"],
  },
  {
    pocketName: "Invest",
    keywords: ["reksadana", "saham", "crypto", "indodax", "bibit", "ajaib"],
  },
  {
    pocketName: "Tabungan",
    keywords: ["tabungan", "menabung", "deposito", "transfer masuk"],
  },
];

interface AutoCategorizeResult {
  pocketName: string;
  keyword: string;
}

export type AutoCategorizeRule = (typeof DEFAULT_RULES)[number];

export const autoCategorizeRules: AutoCategorizeRule[] = DEFAULT_RULES;

export function autoCategorize(description: string): AutoCategorizeResult | null {
  const normalized = description?.toLowerCase() ?? "";
  if (!normalized) return null;

  for (const rule of autoCategorizeRules) {
    const match = rule.keywords.find((keyword) => normalized.includes(keyword));
    if (match) {
      return {
        pocketName: rule.pocketName,
        keyword: match,
      };
    }
  }

  return null;
}

