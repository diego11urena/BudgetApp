-- "Log out everywhere" is gone; sessions now only check the account still exists.
ALTER TABLE "User" DROP COLUMN "sessionVersion";

-- When the user accepted the Terms of Use / Privacy Policy on /login.
ALTER TABLE "User" ADD COLUMN "termsAcceptedAt" TIMESTAMP(3);
