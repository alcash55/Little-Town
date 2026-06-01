-- Side accounts: additional RSNs tracked alongside a primary bingo player.
-- Each side account belongs to a bingo_player (the primary account).
-- Hiscore snapshots for side accounts are stored in bingo_player_hiscores
-- using the side_account_id foreign key (NULL for primary accounts).

CREATE TABLE IF NOT EXISTS bingo_player_side_accounts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id     UUID NOT NULL REFERENCES bingo_players(id) ON DELETE CASCADE,
  rsn           TEXT NOT NULL,
  notes         TEXT,
  added_by      UUID REFERENCES users(id),
  added_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (player_id, rsn)
);

-- Add a nullable side_account_id column to hiscores so side account snapshots
-- can be stored alongside primary snapshots without a separate table.
ALTER TABLE bingo_player_hiscores
  ADD COLUMN IF NOT EXISTS side_account_id UUID
    REFERENCES bingo_player_side_accounts(id) ON DELETE CASCADE;

-- The existing UNIQUE (player_id, type) constraint only works for primary accounts.
-- Drop it and replace with a partial unique index for primary and side accounts.
ALTER TABLE bingo_player_hiscores
  DROP CONSTRAINT IF EXISTS bingo_player_hiscores_player_id_type_key;

-- Primary account snapshots: unique per player+type where side_account_id IS NULL
CREATE UNIQUE INDEX IF NOT EXISTS uq_hiscores_primary
  ON bingo_player_hiscores (player_id, type)
  WHERE side_account_id IS NULL;

-- Side account snapshots: unique per side_account+type
CREATE UNIQUE INDEX IF NOT EXISTS uq_hiscores_side
  ON bingo_player_hiscores (side_account_id, type)
  WHERE side_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS bingo_side_accounts_player_idx
  ON bingo_player_side_accounts(player_id);

ALTER TABLE bingo_player_side_accounts ENABLE ROW LEVEL SECURITY;
