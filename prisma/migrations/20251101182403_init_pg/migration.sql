-- CreateEnum
CREATE TYPE "ChatRole" AS ENUM ('user', 'assistant');

-- CreateEnum
CREATE TYPE "JournalType" AS ENUM ('income', 'expense', 'transfer');

-- CreateTable
CREATE TABLE "Pocket" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "note" TEXT,
    "monthlyBudget" INTEGER NOT NULL DEFAULT 0,
    "goalAmount" INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "profileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pocket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "pocketId" TEXT NOT NULL,
    "source" TEXT,
    "externalRef" TEXT,
    "profileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recurring" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "schedule" TEXT NOT NULL,
    "pocketId" TEXT NOT NULL,
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "autoPost" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recurring_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPref" (
    "id" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "locale" TEXT NOT NULL DEFAULT 'id-ID',
    "theme" TEXT NOT NULL DEFAULT 'system',
    "pinHash" TEXT,
    "biometricEnabled" BOOLEAN NOT NULL DEFAULT false,
    "passkeyCredentialId" TEXT,
    "passkeyPublicKey" TEXT,
    "passkeyCounter" INTEGER,
    "passkeyTransports" TEXT,
    "passkeyCurrentChallenge" TEXT,
    "uiAnimationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "activeProfileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPref_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatTurn" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "role" "ChatRole" NOT NULL,
    "text" TEXT NOT NULL,
    "payload" JSONB,
    "sessionId" TEXT,

    CONSTRAINT "ChatTurn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "state" JSONB NOT NULL,

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "desc" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Journal" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "JournalType" NOT NULL,
    "payload" JSONB NOT NULL,
    "affectedTxnIds" JSONB NOT NULL,
    "undoToken" TEXT NOT NULL,

    CONSTRAINT "Journal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Journal_undoToken_key" ON "Journal"("undoToken");

-- AddForeignKey
ALTER TABLE "Pocket" ADD CONSTRAINT "Pocket_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_pocketId_fkey" FOREIGN KEY ("pocketId") REFERENCES "Pocket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recurring" ADD CONSTRAINT "Recurring_pocketId_fkey" FOREIGN KEY ("pocketId") REFERENCES "Pocket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatTurn" ADD CONSTRAINT "ChatTurn_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

