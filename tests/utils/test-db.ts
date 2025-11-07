import { randomUUID } from "node:crypto";

type TableName =
  | "Profile"
  | "Pocket"
  | "Transaction"
  | "Recurring"
  | "UserPref"
  | "ChatSession"
  | "ChatTurn"
  | "Journal";

type TableStore = Map<string, Record<string, any>>;

const tables = new Map<TableName, TableStore>();

function ensureTable(name: TableName): TableStore {
  const existing = tables.get(name);
  if (existing) return existing;
  const store = new Map<string, Record<string, any>>();
  tables.set(name, store);
  return store;
}

function clone<T>(value: T): T {
  const sc = globalThis.structuredClone?.bind(globalThis);
  return sc ? sc(value) : JSON.parse(JSON.stringify(value));
}

function withTimestamps(row: Record<string, any>) {
  const now = new Date().toISOString();
  if (!row.createdAt) row.createdAt = now;
  if (!row.updatedAt) row.updatedAt = now;
  return row;
}

export function resetTestDb() {
  for (const store of tables.values()) {
    store.clear();
  }
}

export function insertRow(table: TableName, data: Record<string, any>) {
  const store = ensureTable(table);
  const id = data.id ?? randomUUID();
  const record = withTimestamps({ ...data, id });
  store.set(id, clone(record));
  return clone(record);
}

export function upsertRows(table: TableName, rows: Array<Record<string, any>>) {
  return rows.map((row) => {
    const store = ensureTable(table);
    const id = row.id ?? randomUUID();
    const existing = store.get(id);
    const next = withTimestamps({
      ...(existing ?? {}),
      ...row,
      id,
      updatedAt: row.updatedAt ?? new Date().toISOString(),
    });
    if (!next.createdAt) next.createdAt = new Date().toISOString();
    store.set(id, clone(next));
    return clone(next);
  });
}

export function updateRows(
  table: TableName,
  predicate: (row: Record<string, any>) => boolean,
  patch: Record<string, any>,
) {
  const store = ensureTable(table);
  const updated: Array<Record<string, any>> = [];
  for (const [id, record] of store) {
    if (!predicate(record)) continue;
    const next = {
      ...record,
      ...patch,
      id,
      updatedAt: patch.updatedAt ?? new Date().toISOString(),
    };
    store.set(id, clone(next));
    updated.push(clone(next));
  }
  return updated;
}

export function deleteRows(table: TableName, predicate: (row: Record<string, any>) => boolean) {
  const store = ensureTable(table);
  const deleted: Array<Record<string, any>> = [];
  for (const [id, record] of store) {
    if (!predicate(record)) continue;
    store.delete(id);
    deleted.push(clone(record));
  }
  return deleted;
}

export function deleteAll(table: TableName) {
  const store = ensureTable(table);
  const deleted = Array.from(store.values()).map((row) => clone(row));
  store.clear();
  return deleted;
}

export function selectRows(table: TableName) {
  return Array.from(ensureTable(table).values()).map((row) => clone(row));
}
