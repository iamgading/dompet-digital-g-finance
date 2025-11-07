import { z } from "zod";

const cuidLikePattern = /^[cC][^\s-]{8,}$/;
const uuidPattern =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const idValidator = z
  .string()
  .refine(
    (value) => cuidLikePattern.test(value) || uuidPattern.test(value),
    "ID tidak valid.",
  );

export const ZTxnCreate = z.object({
  type: z.enum(["income", "expense"]),
  amount: z.number().int().positive(),
  pocketId: idValidator,
  note: z.string().trim().max(280).optional(),
  date: z.coerce.date().optional(),
  clientRef: z
    .string()
    .trim()
    .min(1, "Referensi klien tidak boleh kosong.")
    .max(64, "Referensi klien terlalu panjang.")
    .optional(),
});

export const ZTransfer = z
  .object({
    fromId: idValidator,
    toId: idValidator,
    amount: z.number().int().positive(),
    note: z.string().trim().max(280).optional(),
  })
  .refine((data) => data.fromId !== data.toId, {
    message: "Pocket asal dan tujuan harus berbeda.",
    path: ["toId"],
  });

export const ZPocketUpsert = z.object({
  id: idValidator.optional(),
  name: z.string().trim().min(1, "Nama pocket wajib diisi."),
  icon: z.string().trim().max(64).optional(),
  color: z.string().trim().max(32).optional(),
  monthlyBudget: z.number().int().min(0).optional(),
  goalAmount: z.number().int().min(0).optional(),
  order: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const ZPocketInsightRange = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
  })
  .refine((data) => data.from.getTime() <= data.to.getTime(), {
    message: "Rentang tanggal tidak valid.",
    path: ["to"],
  });

export const ZPocketInsightGranularity = z.enum(["daily", "weekly", "monthly"]);

export const ZPocketInsightTxnFilter = z
  .object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    type: z.enum(["income", "expense"]).optional(),
    limit: z.number().int().min(1).max(50).optional(),
    cursor: idValidator.optional(),
  })
  .refine(
    (data) => {
      if (data.from && data.to) {
        return data.from.getTime() <= data.to.getTime();
      }
      return true;
    },
    { message: "Rentang filter tidak valid.", path: ["to"] },
  );

export const ZPocketNoteUpdate = z.object({
  pocketId: idValidator,
  note: z
    .string()
    .trim()
    .max(2000, "Catatan terlalu panjang.")
    .optional()
    .default(""),
});

export const ZTransactionFilter = z.object({
  pocketId: idValidator.optional(),
  type: z.enum(["income", "expense", "transfer"]).optional(),
  limit: z.number().int().positive().max(50).optional(),
  order: z.enum(["asc", "desc"]).optional().default("desc"),
});

export const ZProfileId = z
  .string()
  .min(8, "ID profil tidak valid.")
  .max(36, "ID profil tidak valid.");

export const ZProfileCreate = z.object({
  name: z.string().trim().min(1, "Nama profil wajib diisi.").max(60, "Nama profil terlalu panjang."),
  desc: z
    .string()
    .trim()
    .max(160, "Deskripsi maksimal 160 karakter.")
    .optional(),
  copyFromActive: z.boolean().optional().default(false),
});

export const ZSetActiveProfile = z.object({
  profileId: ZProfileId,
});

export const ZPocketReorder = z
  .object({
    idsInNewOrder: z.array(idValidator).min(1, "Minimal satu pocket."),
  })
  .refine(
    (data) => {
      const unique = new Set(data.idsInNewOrder);
      return unique.size === data.idsInNewOrder.length;
    },
    {
      message: "Urutan pocket tidak valid.",
      path: ["idsInNewOrder"],
    },
  );

export const ZImportRow = z.object({
  date: z.string().trim().min(1, "Tanggal wajib diisi."),
  description: z.string().trim().min(1, "Deskripsi wajib diisi."),
  amount: z.number(),
  note: z.string().trim().max(280).optional(),
  pocketId: idValidator.optional(),
  externalRef: z.string().trim().max(128).optional(),
});

export const ZImportTransactionsInput = z.object({
  rows: ZImportRow.array().min(1, "Minimal satu baris transaksi."),
  defaultPocketId: idValidator.optional(),
  reverseSign: z.boolean().optional(),
});

const hoursRange = z.number().int().min(0).max(23);
const minutesRange = z.number().int().min(0).max(59);

export const ZRecurringSchedule = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("weekly"),
    dayOfWeek: z.number().int().min(0).max(6),
    hour: hoursRange.optional(),
    minute: minutesRange.optional(),
  }),
  z.object({
    mode: z.literal("monthly"),
    dayOfMonth: z.number().int().min(1).max(31),
    hour: hoursRange.optional(),
    minute: minutesRange.optional(),
  }),
]);

export const ZRecurringUpsert = z.object({
  id: idValidator.optional(),
  name: z.string().trim().min(1, "Nama wajib diisi."),
  type: z.enum(["income", "expense"]),
  amount: z.number().int().positive(),
  pocketId: idValidator,
  schedule: ZRecurringSchedule,
  autoPost: z.boolean().optional().default(true),
  nextRunAt: z.coerce.date().optional(),
});

export const ZRecurringDelete = z.object({
  id: idValidator,
});

export const ZRunRecurring = z.object({
  id: idValidator,
});

export const ZPinSetup = z
  .object({
    pin: z.string().regex(/^\d{4,6}$/, "PIN harus 4-6 digit angka."),
    confirmPin: z.string(),
  })
  .refine((data) => data.pin === data.confirmPin, {
    message: "PIN tidak cocok.",
    path: ["confirmPin"],
  });

export const ZPinVerify = z.object({
  pin: z.string().regex(/^\d{4,6}$/),
});

export const ZUserPrefUpdate = z.object({
  currency: z.enum(["IDR", "USD"]),
  locale: z.enum(["id-ID", "en-US"]),
  theme: z.enum(["light", "dark", "system"]),
  uiAnimationsEnabled: z.boolean(),
});

export const ZBackupExportInput = z.object({
  includeTransactions: z.boolean().optional().default(true),
  includeRecurring: z.boolean().optional().default(true),
});

export const ZBackupPayload = z.object({
  profiles: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        desc: z.string().nullable().optional(),
        createdAt: z.string(),
      }),
    )
    .optional()
    .default([]),
  pockets: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      icon: z.string().nullable(),
      color: z.string().nullable(),
      monthlyBudget: z.number(),
      goalAmount: z.number(),
      order: z.number(),
      isActive: z.boolean(),
      balance: z.number(),
      createdAt: z.string(),
      updatedAt: z.string(),
      profileId: z.string().optional(),
    }),
  ),
  transactions: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      amount: z.number(),
      date: z.string(),
      note: z.string().nullable(),
      pocketId: z.string(),
      source: z.string().nullable(),
      externalRef: z.string().nullable(),
      createdAt: z.string(),
      updatedAt: z.string(),
      profileId: z.string().optional(),
    }),
  ),
  recurring: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      type: z.string(),
      amount: z.number(),
      schedule: z.string(),
      pocketId: z.string(),
      nextRunAt: z.string(),
      lastRunAt: z.string().nullable(),
      autoPost: z.boolean(),
      createdAt: z.string(),
      updatedAt: z.string(),
    }),
  ),
  userPref: z
    .object({
      id: z.string(),
      currency: z.string(),
      theme: z.string(),
      pinHash: z.string().nullable(),
      biometricEnabled: z.boolean(),
      passkeyCredentialId: z.string().nullable(),
      passkeyPublicKey: z.string().nullable(),
      passkeyCounter: z.number().nullable(),
      passkeyTransports: z.string().nullable(),
      passkeyCurrentChallenge: z.string().nullable(),
      locale: z.string(),
      uiAnimationsEnabled: z.boolean(),
      createdAt: z.string(),
      updatedAt: z.string(),
      activeProfileId: z.string().nullable().optional(),
    })
    .nullable(),
});

export type TxnCreateInput = z.infer<typeof ZTxnCreate>;
export type TransferInput = z.infer<typeof ZTransfer>;
export type PocketUpsertInput = z.infer<typeof ZPocketUpsert>;
export type TransactionFilterInput = z.infer<typeof ZTransactionFilter>;
export type PocketReorderInput = z.infer<typeof ZPocketReorder>;
export type ImportRowInput = z.infer<typeof ZImportRow>;
export type ImportTransactionsInput = z.infer<typeof ZImportTransactionsInput>;
export type RecurringScheduleInput = z.infer<typeof ZRecurringSchedule>;
export type RecurringUpsertInput = z.infer<typeof ZRecurringUpsert>;
export type RecurringDeleteInput = z.infer<typeof ZRecurringDelete>;
export type RunRecurringInput = z.infer<typeof ZRunRecurring>;
export type PinSetupInput = z.infer<typeof ZPinSetup>;
export type PinVerifyInput = z.infer<typeof ZPinVerify>;
export type UserPrefUpdateInput = z.infer<typeof ZUserPrefUpdate>;
export type BackupExportInput = z.infer<typeof ZBackupExportInput>;
export type BackupPayload = z.infer<typeof ZBackupPayload>;
