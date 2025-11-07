import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { PocketInsight } from "@/components/pockets/pocket-insight";
import { UserPrefProvider } from "@/components/providers/user-pref-provider";

const mockGetPocketById = vi.fn();
const mockGetPocketStats = vi.fn();
const mockGetPocketCashflowSeries = vi.fn();
const mockListPocketTransactions = vi.fn();
const mockUpdatePocketNote = vi.fn();

vi.mock("@/app/pockets/actions", () => ({
  getPocketById: (...args: unknown[]) => mockGetPocketById(...args),
  getPocketStats: (...args: unknown[]) => mockGetPocketStats(...args),
  getPocketCashflowSeries: (...args: unknown[]) => mockGetPocketCashflowSeries(...args),
  listPocketTransactions: (...args: unknown[]) => mockListPocketTransactions(...args),
  updatePocketNote: (...args: unknown[]) => mockUpdatePocketNote(...args),
}));

vi.mock("@/components/analytics/pocket-chart", () => ({
  PocketChart: ({ data }: { data: Array<unknown> }) => (
    <div data-testid="pocket-chart">rendered-{data.length}</div>
  ),
  __esModule: true,
  default: ({ data }: { data: Array<unknown> }) => (
    <div data-testid="pocket-chart">rendered-{data.length}</div>
  ),
}));

vi.mock("next/dynamic", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: (importer: () => Promise<any>, options?: { loading?: React.ComponentType }) => {
      return function DynamicComponent(props: Record<string, unknown>) {
        const [Resolved, setResolved] = React.useState<React.ComponentType | null>(null);
        React.useEffect(() => {
          let mounted = true;
          importer().then((mod) => {
            if (!mounted) return;
            const Component = (mod.default ?? mod.PocketChart ?? mod) as React.ComponentType;
            setResolved(() => Component);
          });
          return () => {
            mounted = false;
          };
        }, []);
        if (!Resolved) {
          const Loading = options?.loading;
          return Loading ? React.createElement(Loading, null) : null;
        }
        return React.createElement(Resolved, props);
      };
    },
  };
});


vi.mock("@/components/transactions/quick-add-transaction-dialog", () => ({
  QuickAddTransactionDialog: () => <div data-testid="quick-add-dialog" />,
}));

vi.mock("@/components/transactions/transfer-dialog", () => ({
  TransferDialog: () => <div data-testid="transfer-dialog" />,
}));

describe("PocketInsight component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPocketById.mockResolvedValue({
      success: true,
      data: {
        id: "pocket-1",
        name: "Tabungan Harian",
        icon: null,
        color: "#0ea5e9",
        monthlyBudget: 250_000,
        goalAmount: 0,
        balance: 500_000,
        note: "Catatan awal",
      },
    });
    mockGetPocketStats.mockResolvedValue({
      success: true,
      data: {
        totalIncome: 1_200_000,
        totalExpense: 450_000,
        avgDailyExpense: 15_000,
        topExpense: {
          date: new Date("2024-05-03T00:00:00.000Z"),
          amount: 200_000,
          note: "Monitor",
        },
        overspend: false,
        overspendPct: 80,
      },
    });
    mockGetPocketCashflowSeries.mockResolvedValue({
      success: true,
      data: [
        { date: "2024-05-01", income: 500_000, expense: 0, balanceAfter: null },
        { date: "2024-05-02", income: 0, expense: 150_000, balanceAfter: null },
      ],
    });
    mockListPocketTransactions.mockResolvedValue({
      success: true,
      data: {
        items: [
          {
            id: "txn-1",
            type: "income",
            amount: 300_000,
            date: new Date("2024-05-02T05:00:00.000Z"),
            note: "Bonus",
            source: "manual",
            createdAt: new Date("2024-05-02T05:00:00.000Z"),
          },
        ],
        nextCursor: null,
      },
    });
    mockUpdatePocketNote.mockResolvedValue({ success: true, data: { id: "pocket-1", note: "Catatan awal" } });
  });

  it("menampilkan header, statistik, dan chart ketika data tersedia", async () => {
    render(
      <UserPrefProvider>
        <PocketInsight
          pocketId="pocket-1"
          pockets={[{ id: "pocket-1", name: "Tabungan Harian", color: "#0ea5e9", balance: 500_000 }]}
          onClose={() => {}}
        />
      </UserPrefProvider>,
    );

    await waitFor(() => {
      expect(mockGetPocketById).toHaveBeenCalled();
    });

    const header = await screen.findByText("Tabungan Harian");
    const balanceLabel = await screen.findByText(/Saldo saat ini/i);
    const statsLabel = await screen.findByText(/Total Income/i);
    const chart = await screen.findByTestId("pocket-chart");
    expect(header).toBeTruthy();
    expect(balanceLabel).toBeTruthy();
    expect(statsLabel).toBeTruthy();
    expect(chart).toBeTruthy();
    expect(chart.textContent).toContain("rendered-2");
  });
});
