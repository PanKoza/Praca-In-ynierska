ALTER TYPE "Role" ADD VALUE 'REFEREE';

ALTER TABLE "users" ADD COLUMN "username" TEXT;
UPDATE "users"
SET "username" = 'user_' || replace("id", '-', '')
WHERE "username" IS NULL;
ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

ALTER TABLE "matches" ADD COLUMN "assignedRefereeId" TEXT;
CREATE INDEX "matches_assignedRefereeId_idx" ON "matches"("assignedRefereeId");
ALTER TABLE "matches"
  ADD CONSTRAINT "matches_assignedRefereeId_fkey"
  FOREIGN KEY ("assignedRefereeId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
