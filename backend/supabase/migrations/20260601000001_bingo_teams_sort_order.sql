ALTER TABLE bingo_teams
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

WITH ordered_teams AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY bingo_id ORDER BY created_at, id) - 1 AS row_sort_order
  FROM bingo_teams
)
UPDATE bingo_teams
SET sort_order = ordered_teams.row_sort_order
FROM ordered_teams
WHERE bingo_teams.id = ordered_teams.id
  AND bingo_teams.sort_order = 0;
