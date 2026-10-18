-- Remembers what the user did about a Home insight (dismissed, resolved,
-- "remind me tomorrow", ...) so it doesn't come back unless its data changes.
-- Additive only.
CREATE TABLE "InsightMemory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "response" TEXT NOT NULL DEFAULT 'dismissed',
    "until" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InsightMemory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InsightMemory_userId_key_key" ON "InsightMemory"("userId", "key");

ALTER TABLE "InsightMemory" ADD CONSTRAINT "InsightMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
