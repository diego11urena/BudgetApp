-- AlterTable
ALTER TABLE "GmailConnection" ADD COLUMN     "lastReconciledAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "GmailIgnoredMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GmailIgnoredMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GmailIgnoredMessage_userId_messageId_key" ON "GmailIgnoredMessage"("userId", "messageId");

-- AddForeignKey
ALTER TABLE "GmailIgnoredMessage" ADD CONSTRAINT "GmailIgnoredMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
