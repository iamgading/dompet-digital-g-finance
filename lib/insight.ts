export type InsightType = "overspend" | "saving";

export interface Insight {
  type: InsightType;
  message: string;
}

export function generateInsights({
  pockets,
  totalBalance,
}: {
  pockets: Array<{ name: string; balance: number; monthlyBudget: number }>;
  totalBalance: number;
}): Insight[] {
  const insights: Insight[] = [];
  const budgetTotal = pockets.reduce((sum, pocket) => sum + (pocket.monthlyBudget ?? 0), 0);

  for (const pocket of pockets) {
    if (!pocket.monthlyBudget) continue;
    const threshold = pocket.monthlyBudget * 0.2;
    if (pocket.balance < threshold) {
      insights.push({
        type: "overspend",
        message: `Pocket ${pocket.name} tinggal ${formatCurrency(pocket.balance)} dari ${formatCurrency(pocket.monthlyBudget)}.`,
      });
    }
  }

  if (budgetTotal > 0) {
    const targetSavings = budgetTotal * 0.1;
    if (totalBalance > targetSavings) {
      insights.push({
        type: "saving",
        message: `Potensi tabungan Rp ${formatCurrency(Math.round(totalBalance - targetSavings))}.`,
      });
    }
  }

  return insights;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID").format(value);
}

