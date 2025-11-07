export type CashflowCalendarEntry = {
  date: string; // ISO date (yyyy-mm-dd)
  income: number;
  expense: number;
  type: "recurring" | "big-expense" | "net";
  label?: string;
  direction?: "up" | "down" | "flat";
  delta?: number;
  alert?: string;
};
