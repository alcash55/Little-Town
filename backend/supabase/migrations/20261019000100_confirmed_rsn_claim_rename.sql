-- #107: carry an existing identity claim when WOM confirms an account rename.
-- Keep the player id, team, snapshots and claim owner. A conflicting claim or
-- player name aborts the whole transaction. Only the backend may call this,
-- after an approved WOM history and a successful new-name hiscores lookup.
CREATE OR REPLACE FUNCTION public.rename_confirmed_player_rsn(
  p_player_id uuid, p_old_rsn text, p_new_rsn text
) RETURNS SETOF public.bingo_players
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  player public.bingo_players;
BEGIN
  SELECT * INTO STRICT player FROM public.bingo_players
    WHERE id = p_player_id FOR UPDATE;
  IF lower(player.rsn) <> lower(p_old_rsn) THEN
    RAISE EXCEPTION 'Player RSN changed while confirming rename';
  END IF;

  -- UNIQUE(rsn_normalized) rejects a destination held by another user.
  -- Preserve claimed_at: this is the same claim, not a new ownership event.
  UPDATE public.rsn_claims
    SET rsn = p_new_rsn, rsn_normalized = lower(p_new_rsn)
    WHERE rsn_normalized = lower(p_old_rsn);

  RETURN QUERY UPDATE public.bingo_players SET rsn = p_new_rsn
    WHERE id = p_player_id RETURNING *;
END;
$$;
REVOKE ALL ON FUNCTION public.rename_confirmed_player_rsn(uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rename_confirmed_player_rsn(uuid, text, text) TO service_role;
