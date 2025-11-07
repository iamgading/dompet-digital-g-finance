import { randomUUID } from "node:crypto";

import {
  deleteAll,
  deleteRows,
  insertRow,
  resetTestDb,
  selectRows,
  updateRows,
  upsertRows,
} from "./test-db";

type ModelName =
  | "Profile"
  | "Pocket"
  | "Transaction"
  | "Recurring"
  | "UserPref"
  | "ChatSession"
  | "ChatTurn"
  | "Journal";

type WhereClause = Record<string, any>;
type ModelClient = ReturnType<typeof createModel>;

type PrismaMock = {
  profile: ModelClient;
  pocket: ModelClient;
  transaction: ModelClient;
  recurring: ModelClient;
  userPref: ModelClient;
  chatSession: ModelClient;
  chatTurn: ModelClient;
  journal: ModelClient;
  $transaction<T>(fn: (mock: PrismaMock) => Promise<T>): Promise<T>;
  $queryRaw(): Promise<number>;
  $disconnect(): Promise<void>;
};

function matchesWhere(row: Record<string, any>, where?: WhereClause): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, value]) => {
    if (value && typeof value === "object") {
      if ("equals" in value) return row[key] === value.equals;
      if ("in" in value) return (value.in as Array<unknown>).includes(row[key]);
      if ("not" in value) return row[key] !== value.not;
      if ("gte" in value) return row[key] >= value.gte;
      if ("lte" in value) return row[key] <= value.lte;
    }
    return row[key] === value;
  });
}

function applyWhere(rows: Array<Record<string, any>>, where?: WhereClause) {
  return rows.filter((row) => matchesWhere(row, where));
}

function applyOrderBy(
  rows: Array<Record<string, any>>,
  orderBy?: Array<Record<string, "asc" | "desc">> | Record<string, "asc" | "desc">,
) {
  if (!orderBy) return rows;
  const list = Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...rows].sort((a, b) => {
    for (const order of list) {
      const [key, direction] = Object.entries(order)[0];
      if (a[key] === b[key]) continue;
      const asc = direction !== "desc";
      return a[key] > b[key] ? (asc ? 1 : -1) : asc ? -1 : 1;
    }
    return 0;
  });
}

function clone<T>(value: T): T {
  const sc = globalThis.structuredClone?.bind(globalThis);
  return sc ? sc(value) : JSON.parse(JSON.stringify(value));
}

function formatCreateData(data: Record<string, any>) {
  const record = { ...data };
  if (!record.id) record.id = randomUUID();
  const now = new Date().toISOString();
  if (!record.createdAt) record.createdAt = now;
  if (!record.updatedAt) record.updatedAt = now;
  return record;
}

function createModel(model: ModelName) {
  return {
    async create({ data }: { data: Record<string, any> }) {
      return insertRow(model, formatCreateData(data));
    },
    async createMany({ data }: { data: Array<Record<string, any>> }) {
      data.forEach((entry) => insertRow(model, formatCreateData(entry)));
      return { count: data.length };
    },
    async upsert({ where, create, update }: { where: WhereClause; create: Record<string, any>; update: Record<string, any> }) {
      const rows = applyWhere(selectRows(model), where);
      if (rows.length > 0) {
        const id = rows[0].id;
        const [updated] = updateRows(model, (row) => row.id === id, update);
        return clone(updated);
      }
      return insertRow(model, formatCreateData(create));
    },
    async findMany(args: { where?: WhereClause; orderBy?: any }) {
      const rows = applyOrderBy(applyWhere(selectRows(model), args?.where), args?.orderBy);
      return rows.map(clone);
    },
    async findFirst(args: { where?: WhereClause; orderBy?: any; select?: Record<string, boolean> }) {
      const rows = applyOrderBy(applyWhere(selectRows(model), args?.where), args?.orderBy);
      const record = rows[0];
      if (!record) return null;
      if (!args?.select) return clone(record);
      const selected: Record<string, any> = {};
      for (const [key, enabled] of Object.entries(args.select)) {
        if (enabled) selected[key] = record[key];
      }
      return clone(selected);
    },
    async findUnique(args: { where: WhereClause; select?: Record<string, boolean> }) {
      const rows = applyWhere(selectRows(model), args.where);
      const record = rows[0];
      if (!record) return null;
      if (!args.select) return clone(record);
      const selected: Record<string, any> = {};
      for (const [key, enabled] of Object.entries(args.select)) {
        if (enabled) selected[key] = record[key];
      }
      return clone(selected);
    },
    async findUniqueOrThrow(args: { where: WhereClause }) {
      const rows = applyWhere(selectRows(model), args.where);
      const record = rows[0];
      if (!record) {
        throw new Error("Record not found");
      }
      return clone(record);
    },
    async update(args: { where: WhereClause; data: Record<string, any> }) {
      const updated = updateRows(model, (row) => matchesWhere(row, args.where), args.data);
      if (!updated.length) throw new Error("Record not found");
      return clone(updated[0]);
    },
    async updateMany(args: { where?: WhereClause; data: Record<string, any> }) {
      const updated = updateRows(model, (row) => matchesWhere(row, args.where), args.data);
      return { count: updated.length };
    },
    async delete(args: { where: WhereClause }) {
      const deleted = deleteRows(model, (row) => matchesWhere(row, args.where));
      if (!deleted.length) throw new Error("Record not found");
      return clone(deleted[0]);
    },
    async deleteMany(args?: { where?: WhereClause }) {
      if (!args?.where) {
        const deleted = deleteAll(model);
        return { count: deleted.length };
      }
      const deleted = deleteRows(model, (row) => matchesWhere(row, args.where));
      return { count: deleted.length };
    },
    async count(args?: { where?: WhereClause }) {
      const rows = applyWhere(selectRows(model), args?.where);
      return rows.length;
    },
    async aggregate(args: { where?: WhereClause; _sum?: Record<string, boolean>; _max?: Record<string, boolean> }) {
      const rows = applyWhere(selectRows(model), args?.where);
      const result: Record<string, any> = {};
      if (args._sum) {
        result._sum = {};
        for (const key of Object.keys(args._sum)) {
          result._sum[key] = rows.reduce((total, row) => total + (row[key] ?? 0), 0);
        }
      }
      if (args._max) {
        result._max = {};
        for (const key of Object.keys(args._max)) {
          result._max[key] = rows.reduce((max, row) => {
            if (max == null) return row[key] ?? null;
            if (row[key] == null) return max;
            return row[key] > max ? row[key] : max;
          }, null as unknown);
        }
      }
      return result;
    },
  };
}

function createPrismaMock(): PrismaMock {
  const client: PrismaMock = {
    profile: createModel("Profile"),
    pocket: createModel("Pocket"),
    transaction: createModel("Transaction"),
    recurring: createModel("Recurring"),
    userPref: createModel("UserPref"),
    chatSession: createModel("ChatSession"),
    chatTurn: createModel("ChatTurn"),
    journal: createModel("Journal"),
    async $transaction<T>(fn: (mock: PrismaMock) => Promise<T>) {
      return fn(client);
    },
    async $queryRaw() {
      return 1;
    },
    async $disconnect() {},
  };

  return client;
}

export const prisma = createPrismaMock();

export function resetPrismaMock() {
  resetTestDb();
}
