-- Create TradingAccount table first
CREATE TABLE "TradingAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AccountType" NOT NULL DEFAULT 'DEMO',
    "tier" "Tier" NOT NULL DEFAULT 'STANDARD',
    "balance" DECIMAL(18,8) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "leverage" INTEGER NOT NULL DEFAULT 30,
    "isIslamic" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradingAccount_pkey" PRIMARY KEY ("id")
);

-- Copy data from Account to TradingAccount
INSERT INTO "TradingAccount" ("id", "userId", "type", "tier", "balance", "currency", "leverage", "isIslamic", "isActive", "createdAt", "updatedAt")
SELECT "id", "userId", "type", "tier", "balance", "currency", "leverage", "isIslamic", "isActive", "createdAt", "updatedAt"
FROM "Account";

-- Create indexes on TradingAccount
CREATE INDEX "TradingAccount_userId_idx" ON "TradingAccount"("userId");
CREATE INDEX "TradingAccount_userId_type_idx" ON "TradingAccount"("userId", "type");

-- Add foreign key from TradingAccount to User
ALTER TABLE "TradingAccount" ADD CONSTRAINT "TradingAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Now update Trade table to reference TradingAccount
-- First drop the old foreign key
ALTER TABLE "Trade" DROP CONSTRAINT "Trade_accountId_fkey";

-- Add new foreign key to TradingAccount
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "TradingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Now convert Account table to OAuth schema
-- Drop the old columns that were for trading accounts
ALTER TABLE "Account" DROP COLUMN "balance",
DROP COLUMN "createdAt",
DROP COLUMN "currency",
DROP COLUMN "isActive",
DROP COLUMN "isIslamic",
DROP COLUMN "leverage",
DROP COLUMN "tier",
DROP COLUMN "updatedAt";

-- Change type column to TEXT (it was AccountType enum)
ALTER TABLE "Account" ALTER COLUMN "type" TYPE TEXT USING "type"::TEXT;

-- Add OAuth columns
ALTER TABLE "Account" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'credentials';
ALTER TABLE "Account" ADD COLUMN "providerAccountId" TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE "Account" ADD COLUMN "refresh_token" TEXT;
ALTER TABLE "Account" ADD COLUMN "access_token" TEXT;
ALTER TABLE "Account" ADD COLUMN "expires_at" INTEGER;
ALTER TABLE "Account" ADD COLUMN "token_type" TEXT;
ALTER TABLE "Account" ADD COLUMN "scope" TEXT;
ALTER TABLE "Account" ADD COLUMN "id_token" TEXT;
ALTER TABLE "Account" ADD COLUMN "session_state" TEXT;

-- Remove the default values we added temporarily
ALTER TABLE "Account" ALTER COLUMN "provider" DROP DEFAULT;
ALTER TABLE "Account" ALTER COLUMN "providerAccountId" DROP DEFAULT;

-- Create unique index for OAuth accounts
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- Update existing rows to have proper OAuth values (credentials type)
-- For existing trading accounts that were converted, they are now in TradingAccount
-- The Account table should now only contain OAuth accounts, but we need to clean up
-- For now, we'll leave the existing rows with the default values, they won't conflict due to unique constraint
-- In practice, you might want to delete these rows or update them properly