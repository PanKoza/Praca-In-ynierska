ALTER TABLE "matches"
  ADD COLUMN "extraTimeScore1" INTEGER,
  ADD COLUMN "extraTimeScore2" INTEGER,
  ADD COLUMN "penaltyScore1" INTEGER,
  ADD COLUMN "penaltyScore2" INTEGER,
  ADD COLUMN "winnerId" TEXT,
  ADD COLUMN "groupKey" TEXT,
  ADD COLUMN "nextMatchId" TEXT,
  ADD COLUMN "nextSlot" INTEGER,
  ADD COLUMN "loserNextMatchId" TEXT,
  ADD COLUMN "loserNextSlot" INTEGER,
  ADD COLUMN "period" TEXT,
  ADD COLUMN "clockSeconds" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "clockRunning" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "clockStartedAt" TIMESTAMP(3),
  ADD COLUMN "court" TEXT,
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "refereeTokenHash" TEXT,
  ADD COLUMN "refereeTokenExpiresAt" TIMESTAMP(3);

ALTER TABLE "matches"
  ALTER COLUMN "player1Id" DROP NOT NULL,
  ALTER COLUMN "player2Id" DROP NOT NULL;

CREATE UNIQUE INDEX "matches_refereeTokenHash_key" ON "matches"("refereeTokenHash");
CREATE INDEX "matches_tournamentId_groupKey_status_idx" ON "matches"("tournamentId", "groupKey", "status");
ALTER TABLE "matches"
  ADD CONSTRAINT "matches_nextMatchId_fkey"
  FOREIGN KEY ("nextMatchId") REFERENCES "matches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "matches"
  ADD CONSTRAINT "matches_loserNextMatchId_fkey"
  FOREIGN KEY ("loserNextMatchId") REFERENCES "matches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "match_events" (
  "id" TEXT NOT NULL,
  "commandId" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "actorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "match_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "match_events_commandId_key" ON "match_events"("commandId");
CREATE UNIQUE INDEX "match_events_matchId_sequence_key" ON "match_events"("matchId", "sequence");
CREATE INDEX "match_events_matchId_createdAt_idx" ON "match_events"("matchId", "createdAt");
ALTER TABLE "match_events"
  ADD CONSTRAINT "match_events_matchId_fkey"
  FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
