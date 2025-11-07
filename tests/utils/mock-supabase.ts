import { randomUUID } from "node:crypto";

import type { Database } from "@/lib/supabase";

import {
  deleteAll,
  deleteRows,
  insertRow,
  resetTestDb,
  selectRows,
  updateRows,
  upsertRows,
} from "./test-db";

type TableName = keyof Database["public"]["Tables"];

type FilterFn = (row: Record<string, any>) => boolean;

function clone<T>(value: T): T {
  const sc = globalThis.structuredClone?.bind(globalThis);
  return sc ? sc(value) : JSON.parse(JSON.stringify(value));
}

function toNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && !Number.isNaN(Number(value))) return Number(value);
  return value as number;
}

function toDate(value: unknown) {
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return value as Date;
}

function applySort(rows: Array<Record<string, any>>, sorts: Array<{ column: string; ascending: boolean }>) {
  if (!sorts.length) return rows;
  return [...rows].sort((a, b) => {
    for (const sort of sorts) {
      const av = a[sort.column];
      const bv = b[sort.column];
      if (av === bv) continue;
      if (av == null) return sort.ascending ? -1 : 1;
      if (bv == null) return sort.ascending ? 1 : -1;
      if (av > bv) return sort.ascending ? 1 : -1;
      if (av < bv) return sort.ascending ? -1 : 1;
    }
    return 0;
  });
}

function parseOrExpression(expression: string): FilterFn {
  const parts = expression.split(",");
  const evaluators = parts.map((part) => {
    const [field, op, value] = part.split(".");
    if (op === "is" && value === "null") {
      return (row: Record<string, any>) => row[field] == null;
    }
    if (op === "neq" && value) {
      return (row: Record<string, any>) => row[field] !== value;
    }
    if (op === "eq" && value) {
      return (row: Record<string, any>) => row[field] === value;
    }
    return () => true;
  });

  return (row) => evaluators.some((fn) => fn(row));
}

class BaseBuilder {
  protected table: TableName;
  protected filters: FilterFn[] = [];
  protected sorts: Array<{ column: string; ascending: boolean }> = [];
  protected limitValue: number | null = null;

  constructor(table: TableName) {
    this.table = table;
  }

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  neq(column: string, value: unknown) {
    this.filters.push((row) => row[column] !== value);
    return this;
  }

  gte(column: string, value: unknown) {
    const target = value instanceof Date || typeof value === "string" ? toDate(value).getTime() : toNumber(value);
    this.filters.push((row) => {
      const cell = row[column];
      if (cell instanceof Date) return cell.getTime() >= target;
      if (typeof cell === "string" && !Number.isNaN(Date.parse(cell))) {
        return new Date(cell).getTime() >= target;
      }
      return cell >= target;
    });
    return this;
  }

  lte(column: string, value: unknown) {
    const target = value instanceof Date || typeof value === "string" ? toDate(value).getTime() : toNumber(value);
    this.filters.push((row) => {
      const cell = row[column];
      if (cell instanceof Date) return cell.getTime() <= target;
      if (typeof cell === "string" && !Number.isNaN(Date.parse(cell))) {
        return new Date(cell).getTime() <= target;
      }
      return cell <= target;
    });
    return this;
  }

  in(column: string, values: Array<unknown>) {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }

  order(column: string, options: { ascending?: boolean } = {}) {
    this.sorts.push({ column, ascending: options.ascending ?? true });
    return this;
  }

  limit(count: number) {
    this.limitValue = count;
    return this;
  }

  or(expression: string) {
    this.filters.push(parseOrExpression(expression));
    return this;
  }

  protected runSelect() {
    let rows = selectRows(this.table);
    for (const filter of this.filters) {
      rows = rows.filter(filter);
    }
    rows = applySort(rows, this.sorts);
    if (this.limitValue != null) {
      rows = rows.slice(0, this.limitValue);
    }
    return rows;
  }
}

class SelectBuilder extends BaseBuilder {
  private head = false;

  constructor(table: TableName, _columns: string, options?: { count?: "exact"; head?: boolean }) {
    super(table);
    this.head = Boolean(options?.head);
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null,
  ) {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }

  private execute() {
    const rows = this.runSelect();
    if (this.head) {
      return { data: null, error: null, count: rows.length };
    }
    return { data: rows.map(clone), error: null };
  }

  async single() {
    const rows = this.runSelect();
    if (rows.length !== 1) {
      return { data: null, error: { message: "Expected single row" } };
    }
    return { data: clone(rows[0]), error: null };
  }

  async maybeSingle() {
    const rows = this.runSelect();
    return { data: rows[0] ? clone(rows[0]) : null, error: null };
  }
}

class MutationBuilder extends BaseBuilder {
  protected executed = false;
  protected result: Array<Record<string, any>> = [];

  protected async ensureExecuted() {
    if (this.executed) return this.result;
    const rows = this.runSelect();
    this.result = rows.map((row) => clone(row));
    this.executed = true;
    return this.result;
  }

  async single() {
    const rows = await this.ensureExecuted();
    if (rows.length !== 1) {
      return { data: null, error: { message: "Expected single row" } };
    }
    return { data: clone(rows[0]), error: null };
  }

  async maybeSingle() {
    const rows = await this.ensureExecuted();
    return { data: rows[0] ? clone(rows[0]) : null, error: null };
  }

  select() {
    return this;
  }
}

class UpdateBuilder extends MutationBuilder {
  constructor(table: TableName, private patch: Record<string, any>) {
    super(table);
  }

  protected override async ensureExecuted() {
    if (this.executed) return this.result;
    const rows = this.runSelect();
    const ids = new Set(rows.map((row) => row.id));
    const updated = updateRows(this.table as TableName, (row) => ids.has(row.id), this.patch);
    this.result = updated.map(clone);
    this.executed = true;
    return this.result;
  }
}

class DeleteBuilder extends MutationBuilder {
  protected override async ensureExecuted() {
    if (this.executed) return this.result;
    const deleted = deleteRows(this.table as TableName, (row) => this.filters.every((fn) => fn(row)));
    this.result = deleted.map(clone);
    this.executed = true;
    return this.result;
  }
}

class InsertBuilder {
  private inserted: Array<Record<string, any>> = [];

  constructor(table: TableName, values: Record<string, any> | Array<Record<string, any>>) {
    const rows = Array.isArray(values) ? values : [values];
    this.inserted = rows.map((row) => insertRow(table, row));
  }

  select() {
    return this;
  }

  async single() {
    if (this.inserted.length !== 1) {
      return { data: null, error: { message: "Expected single row" } };
    }
    return { data: clone(this.inserted[0]), error: null };
  }

  async maybeSingle() {
    return { data: this.inserted[0] ? clone(this.inserted[0]) : null, error: null };
  }

  async then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null,
  ) {
    return Promise.resolve({ data: this.inserted.map(clone), error: null }).then(onfulfilled, onrejected);
  }
}

class UpsertBuilder extends MutationBuilder {
  constructor(table: TableName, private rows: Array<Record<string, any>>) {
    super(table);
    this.result = upsertRows(table, this.rows).map(clone);
    this.executed = true;
  }

  onConflict() {
    return this;
  }

  async single() {
    if (this.result.length !== 1) {
      return { data: null, error: { message: "Expected single row" } };
    }
    return { data: clone(this.result[0]), error: null };
  }

  async maybeSingle() {
    return { data: this.result[0] ? clone(this.result[0]) : null, error: null };
  }

  select() {
    return this;
  }

  async then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null,
  ) {
    return Promise.resolve({ data: this.result.map(clone), error: null }).then(onfulfilled, onrejected);
  }
}

class SupabaseClientMock {
  from(table: TableName) {
    return {
      select: (columns = "*", options?: { count?: "exact"; head?: boolean }) =>
        new SelectBuilder(table, columns, options),
      insert: (values: Record<string, any> | Array<Record<string, any>>) => new InsertBuilder(table, values),
      update: (values: Record<string, any>) => new UpdateBuilder(table, values),
      delete: () => new DeleteBuilder(table),
      upsert: (values: Array<Record<string, any>>) => new UpsertBuilder(table, values),
    };
  }
}

export const supabaseClientMock = new SupabaseClientMock();

type SupabaseAdminClient = ReturnType<typeof import("@/lib/supabase")["getSupabaseAdminClient"]>;

export function getMockSupabaseAdminClient() {
  return supabaseClientMock as unknown as SupabaseAdminClient;
}

export function resetSupabase() {
  resetTestDb();
}
