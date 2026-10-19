-- Re-evaluate the current end_date every tick, including after an extension.
-- Lock eligible bingos so a concurrent date/status edit cannot race deletion.
CREATE OR REPLACE FUNCTION public.delete_expired_hiscore_history(p_now timestamptz DEFAULT now())
RETURNS bigint
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  bingo_row record;
  deleted_count bigint := 0;
  affected bigint;
BEGIN
  FOR bingo_row IN
    SELECT id FROM bingos
    WHERE status = 'complete'
      -- Early completion without end_date assumes updated_at is the
      -- completion transition timestamp. Later edits move that fallback too.
      AND COALESCE(end_date, updated_at) < p_now - interval '120 hours'
    ORDER BY id
    FOR UPDATE
  LOOP
    DELETE FROM bingo_player_hiscore_history AS history
    WHERE (
      history.side_account_id IS NULL
      AND history.player_id IN (SELECT id FROM bingo_players WHERE bingo_id = bingo_row.id)
    ) OR history.side_account_id IN (
      SELECT side_account.id
      FROM bingo_player_side_accounts AS side_account
      JOIN bingo_players AS player ON player.id = side_account.player_id
      WHERE player.bingo_id = bingo_row.id
    );
    GET DIAGNOSTICS affected = ROW_COUNT;
    deleted_count := deleted_count + affected;
  END LOOP;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_expired_hiscore_history(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_expired_hiscore_history(timestamptz) TO service_role;
