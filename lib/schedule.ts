import { RecurringScheduleInput } from "@/lib/validators";

export type RecurringSchedule = RecurringScheduleInput;

const DEFAULT_HOUR = 7;
const DEFAULT_MINUTE = 0;

function normalizeTime(hour?: number, minute?: number) {
  const safeHour = typeof hour === "number" ? Math.min(Math.max(hour, 0), 23) : DEFAULT_HOUR;
  const safeMinute = typeof minute === "number" ? Math.min(Math.max(minute, 0), 59) : DEFAULT_MINUTE;
  return { hour: safeHour, minute: safeMinute };
}

export function getNextRun(from: Date, schedule: RecurringSchedule) {
  const base = new Date(from);
  const { hour, minute } = normalizeTime(schedule.hour, schedule.minute);

  if (schedule.mode === "weekly") {
    const targetDow = schedule.dayOfWeek;
    const currentDow = base.getUTCDay();
    let daysToAdd = targetDow - currentDow;

    let candidate = createUtcDate(base, hour, minute);
    candidate.setUTCDate(candidate.getUTCDate() + daysToAdd);

    if (daysToAdd < 0 || (daysToAdd === 0 && candidate <= base)) {
      candidate.setUTCDate(candidate.getUTCDate() + 7);
    }
    return candidate;
  }

  if (schedule.mode === "monthly") {
    const year = base.getUTCFullYear();
    const month = base.getUTCMonth();
    const dayThisMonth = Math.min(schedule.dayOfMonth, daysInMonth(year, month));

    let candidate = new Date(Date.UTC(year, month, dayThisMonth, hour, minute, 0, 0));

    if (candidate <= base) {
      const nextMonth = month + 1;
      const nextYear = year + Math.floor(nextMonth / 12);
      const normalizedMonth = nextMonth % 12;
      const targetDay = Math.min(schedule.dayOfMonth, daysInMonth(nextYear, normalizedMonth));
      candidate = new Date(Date.UTC(nextYear, normalizedMonth, targetDay, hour, minute, 0, 0));
    }

    return candidate;
  }

  throw new Error("Unsupported schedule");
}

export function daysInMonth(year: number, monthZeroBased: number) {
  return new Date(year, monthZeroBased + 1, 0).getDate();
}

function createUtcDate(base: Date, hour: number, minute: number) {
  return new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), hour, minute, 0, 0),
  );
}

export function serializeSchedule(schedule: RecurringSchedule) {
  return JSON.stringify(schedule);
}

export function parseSchedule(raw: string): RecurringSchedule {
  const parsed = JSON.parse(raw) as RecurringSchedule;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid schedule payload");
  }
  if (parsed.mode === "weekly" && typeof parsed.dayOfWeek === "number") {
    return {
      mode: "weekly",
      dayOfWeek: parsed.dayOfWeek,
      hour: parsed.hour,
      minute: parsed.minute,
    };
  }
  if (parsed.mode === "monthly" && typeof parsed.dayOfMonth === "number") {
    return {
      mode: "monthly",
      dayOfMonth: parsed.dayOfMonth,
      hour: parsed.hour,
      minute: parsed.minute,
    };
  }
  throw new Error("Unsupported schedule payload");
}
