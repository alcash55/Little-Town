import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchWithAuth } from '../../../../utils/fetchWithAuth';

// -------------------------------------------------------
// Types
// -------------------------------------------------------

export interface BingoTeam {
  id: string;
  name: string;
  sortOrder: number;
}

export interface BingoPlayer {
  id: string;
  bingo_id: string;
  team_id: string | null;
  captain_team_id: string | null;
  rsn: string;
  registered_by: string | null;
  registered_at: string;
}

export interface SideAccount {
  id: string;
  player_id: string;
  rsn: string;
  notes: string | null;
  added_by: string | null;
  added_at: string;
}

/** Items map used by the DnD context: container id -> list of RSN strings */
export type DraftItems = Record<string, string[]>;

function draftsEqual(a: DraftItems, b: DraftItems): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    const left = a[key] ?? [];
    const right = b[key] ?? [];
    if (left.length !== right.length) return false;
    for (let i = 0; i < left.length; i++) {
      if (left[i] !== right[i]) return false;
    }
  }
  return true;
}

function allPlayersAssigned(playerList: BingoPlayer[]): boolean {
  return playerList.length > 0 && playerList.every((p) => p.team_id != null);
}

// -------------------------------------------------------
// Hook
// -------------------------------------------------------

export const useTeamDrafter = () => {
  const BASE_URL = `${import.meta.env.VITE_BASEURL || 'http://localhost:8081'}/api/admin`;

  // ── Shared state ─────────────────────────────────────
  /** Active tab: 0 = Drafter, 1 = Player Management */
  const [activeTab, setActiveTab] = useState(1);
  const defaultTabResolved = useRef(false);

  // ── Bingo / team state ────────────────────────────────
  const [teams, setTeams] = useState<BingoTeam[]>([]);
  const [loadingBingo, setLoadingBingo] = useState(true);
  const [bingoError, setBingoError] = useState<string | null>(null);

  // ── Draft (DnD) state ─────────────────────────────────
  /**
   * DnD items map: 'pool' holds unassigned RSNs; each team id holds its RSNs.
   * Initialised as an empty pool + one key per team once bingo details load.
   */
  const [draftItems, setDraftItems] = useState<DraftItems>({ pool: [] });
  /** Last-saved draft layout; used to detect unsaved team changes. */
  const [savedDraftItems, setSavedDraftItems] = useState<DraftItems>({ pool: [] });
  const [teamsEverSubmitted, setTeamsEverSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // ── Player management state ───────────────────────────
  /** All players registered to the active bingo */
  const [players, setPlayers] = useState<BingoPlayer[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  /** CSV textarea value on the Add Players tab */
  const [csvInput, setCsvInput] = useState('');
  const [addingPlayers, setAddingPlayers] = useState(false);
  const [addPlayerError, setAddPlayerError] = useState<string | null>(null);
  /** Per-RSN result feedback after CSV submit { rsn -> 'ok' | error message } */
  const [addResults, setAddResults] = useState<Record<string, string>>({});
  const [removingRsn, setRemovingRsn] = useState<string | null>(null);
  const [captainUpdatingRsn, setCaptainUpdatingRsn] = useState<string | null>(null);

  // ── Side account dialog state ─────────────────────────
  /** Player whose side-account dialog is open (null = closed) */
  const [sideAccountPlayer, setSideAccountPlayer] = useState<BingoPlayer | null>(null);
  const [sideAccounts, setSideAccounts] = useState<SideAccount[]>([]);
  const [loadingSideAccounts, setLoadingSideAccounts] = useState(false);
  const [newSideRsn, setNewSideRsn] = useState('');
  const [newSideNotes, setNewSideNotes] = useState('');
  const [addingSideAccount, setAddingSideAccount] = useState(false);
  const [sideAccountError, setSideAccountError] = useState<string | null>(null);
  /** Side accounts keyed by primary player id (from GET /bingo/players). */
  const [sideAccountsByPlayerId, setSideAccountsByPlayerId] = useState<
    Record<string, SideAccount[]>
  >({});

  // ── Helpers ───────────────────────────────────────────

  /** Build the initial DnD items map from a player list + team list. */
  const buildDraftItems = useCallback(
    (playerList: BingoPlayer[], teamList: BingoTeam[]): DraftItems => {
      const map: DraftItems = { pool: [] };
      for (const t of teamList) map[t.id] = [];

      for (const p of playerList) {
        const draftTeamId = p.captain_team_id ?? p.team_id;
        if (draftTeamId && map[draftTeamId] !== undefined) {
          if (p.captain_team_id) {
            map[draftTeamId].unshift(p.rsn);
          } else {
            map[draftTeamId].push(p.rsn);
          }
        } else {
          map['pool'].push(p.rsn);
        }
      }
      return map;
    },
    [],
  );

  // ── API calls ─────────────────────────────────────────

  /**
   * Load active bingo details to get the team list, then load players.
   * Called once on mount.
   */
  const loadBingoDetails = useCallback(async () => {
    setLoadingBingo(true);
    setBingoError(null);
    try {
      const res = await fetchWithAuth(`${BASE_URL}/bingo/details`);
      if (!res.ok) throw new Error(`Failed to load bingo details: ${res.statusText}`);
      const json = await res.json();
      const bingo = json.data;

      const teamObjs: BingoTeam[] = (bingo?.teamObjects ?? []).sort(
        (a: BingoTeam, b: BingoTeam) => a.sortOrder - b.sortOrder,
      );
      setTeams(teamObjs);
      return teamObjs;
    } catch (e) {
      setBingoError(String(e));
      return [];
    } finally {
      setLoadingBingo(false);
    }
  }, [BASE_URL]);

  /**
   * Load all players registered to the active bingo.
   * Rebuilds the DnD items map after loading.
   */
  const loadPlayers = useCallback(
    async (teamList?: BingoTeam[]) => {
      setLoadingPlayers(true);
      try {
        const res = await fetchWithAuth(`${BASE_URL}/bingo/players`);
        if (!res.ok) throw new Error(`Failed to load players: ${res.statusText}`);
        const json = await res.json();
        const playerList: BingoPlayer[] = [];
        const sideMap: Record<string, SideAccount[]> = {};
        for (const row of json.data ?? []) {
          const { player, sideAccounts: sides } = row as {
            player: BingoPlayer;
            sideAccounts?: SideAccount[];
          };
          playerList.push(player);
          sideMap[player.id] = sides ?? [];
        }
        setPlayers(playerList);
        setSideAccountsByPlayerId(sideMap);
        if (!defaultTabResolved.current) {
          setActiveTab(playerList.length > 0 ? 0 : 1);
          defaultTabResolved.current = true;
        }
        const tl = teamList ?? teams;
        const draft = buildDraftItems(playerList, tl);
        setDraftItems(draft);
        setSavedDraftItems(draft);
        if (allPlayersAssigned(playerList)) {
          setTeamsEverSubmitted(true);
        }
        return playerList;
      } catch (e) {
        console.error('loadPlayers error:', e);
        return [];
      } finally {
        setLoadingPlayers(false);
      }
    },
    [BASE_URL, teams, buildDraftItems],
  );

  /** Initial load on mount */
  useEffect(() => {
    loadBingoDetails().then((teamList) => loadPlayers(teamList));
  }, []);

  /**
   * Parse CSV textarea input into a list of RSN strings.
   * Accepts comma-separated, newline-separated, or a mix.
   * Trims whitespace and filters empties.
   */
  const parseCsv = (raw: string): string[] =>
    raw
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

  /**
   * Add a list of players parsed from the CSV input to the active bingo.
   * Fires one POST per player and collects per-RSN results.
   */
  const addPlayersFromCsv = useCallback(async () => {
    const rsns = parseCsv(csvInput);
    if (!rsns.length) return;

    setAddingPlayers(true);
    setAddPlayerError(null);
    setAddResults({});

    const results: Record<string, string> = {};

    await Promise.allSettled(
      rsns.map(async (rsn) => {
        try {
          const res = await fetchWithAuth(`${BASE_URL}/bingo/players`, {
            method: 'POST',
            body: JSON.stringify({ rsn }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            results[rsn] = err.error ?? res.statusText;
          } else {
            results[rsn] = 'ok';
          }
        } catch (e) {
          results[rsn] = String(e);
        }
      }),
    );

    setAddResults(results);
    setCsvInput('');
    setAddingPlayers(false);

    const anyFailed = Object.values(results).some((r) => r !== 'ok');
    if (anyFailed) setAddPlayerError('Some players could not be added — see results below.');

    // Refresh player list
    await loadPlayers();
  }, [csvInput, BASE_URL, loadPlayers]);

  /**
   * Remove a player from the active bingo by RSN.
   * Refreshes the player list and DnD map after removal.
   */
  const setPlayerCaptain = useCallback(
    async (rsn: string, captainTeamId: string | null) => {
      setCaptainUpdatingRsn(rsn);
      try {
        const res = await fetchWithAuth(
          `${BASE_URL}/bingo/players/${encodeURIComponent(rsn)}/captain`,
          {
            method: 'PATCH',
            body: JSON.stringify({ captainTeamId }),
          },
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? res.statusText);
        }
        await loadPlayers();
      } catch (e) {
        console.error('setPlayerCaptain error:', e);
      } finally {
        setCaptainUpdatingRsn(null);
      }
    },
    [BASE_URL, loadPlayers],
  );

  const removePlayer = useCallback(
    async (rsn: string) => {
      setRemovingRsn(rsn);
      try {
        const res = await fetchWithAuth(`${BASE_URL}/bingo/players/${encodeURIComponent(rsn)}`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error(`Failed to remove player: ${res.statusText}`);
        await loadPlayers();
      } catch (e) {
        console.error('removePlayer error:', e);
      } finally {
        setRemovingRsn(null);
      }
    },
    [BASE_URL, loadPlayers],
  );

  /**
   * Submit the completed draft.
   * Sends an array of { rsn, teamId } for every player that has been placed
   * in a team container. Players remaining in the pool get teamId: null.
   */
  const submitDraft = useCallback(async () => {
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      const assignments: Array<{ rsn: string; teamId: string | null }> = [];

      for (const [containerId, rsns] of Object.entries(draftItems)) {
        const teamId = containerId === 'pool' ? null : containerId;
        for (const rsn of rsns) {
          assignments.push({ rsn, teamId });
        }
      }

      const res = await fetchWithAuth(`${BASE_URL}/bingo/draft`, {
        method: 'POST',
        body: JSON.stringify(assignments),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? res.statusText);
      }

      setSubmitSuccess(true);
      setSavedDraftItems(draftItems);
      setTeamsEverSubmitted(true);
      // Refresh so team_id values reflect the saved state
      await loadPlayers();
    } catch (e) {
      setSubmitError(String(e));
    } finally {
      setSubmitting(false);
    }
  }, [draftItems, BASE_URL, loadPlayers]);

  /**
   * Reset all team assignments: calls DELETE /bingo/draft on the API
   * and rebuilds the DnD map with all players back in the pool.
   */
  const resetDraft = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${BASE_URL}/bingo/draft`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Failed to reset draft: ${res.statusText}`);
      await loadPlayers();
      setTeamsEverSubmitted(false);
      setSubmitSuccess(false);
    } catch (e) {
      console.error('resetDraft error:', e);
    }
  }, [BASE_URL, loadPlayers]);

  // ── Side account helpers ──────────────────────────────

  /**
   * Open the side accounts dialog for a player and load their side accounts.
   */
  const openSideAccountDialog = useCallback(
    async (player: BingoPlayer) => {
      setSideAccountPlayer(player);
      setSideAccounts([]);
      setSideAccountError(null);
      setNewSideRsn('');
      setNewSideNotes('');
      setLoadingSideAccounts(true);

      try {
        const res = await fetchWithAuth(
          `${BASE_URL}/bingo/players/${encodeURIComponent(player.rsn)}/side-accounts`,
        );
        if (!res.ok) throw new Error(`Failed to load side accounts: ${res.statusText}`);
        const json = await res.json();
        setSideAccounts(json.data ?? []);
      } catch (e) {
        setSideAccountError(String(e));
      } finally {
        setLoadingSideAccounts(false);
      }
    },
    [BASE_URL],
  );

  /** Close side accounts dialog and clear state. */
  const closeSideAccountDialog = useCallback(() => {
    setSideAccountPlayer(null);
    setSideAccounts([]);
    setSideAccountError(null);
    setNewSideRsn('');
    setNewSideNotes('');
  }, []);

  /**
   * Add a side account to the currently open player.
   */
  const addSideAccount = useCallback(async () => {
    if (!sideAccountPlayer || !newSideRsn.trim()) return;

    setAddingSideAccount(true);
    setSideAccountError(null);

    try {
      const res = await fetchWithAuth(
        `${BASE_URL}/bingo/players/${encodeURIComponent(sideAccountPlayer.rsn)}/side-accounts`,
        {
          method: 'POST',
          body: JSON.stringify({ rsn: newSideRsn.trim(), notes: newSideNotes.trim() || undefined }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? res.statusText);
      }
      const json = await res.json();
      const added = json.data as SideAccount;
      setSideAccounts((prev) => [...prev, added]);
      setSideAccountsByPlayerId((prev) => ({
        ...prev,
        [sideAccountPlayer.id]: [...(prev[sideAccountPlayer.id] ?? []), added],
      }));
      setNewSideRsn('');
      setNewSideNotes('');
    } catch (e) {
      setSideAccountError(String(e));
    } finally {
      setAddingSideAccount(false);
    }
  }, [sideAccountPlayer, newSideRsn, newSideNotes, BASE_URL]);

  /**
   * Remove a side account by its ID from the currently open player.
   */
  const removeSideAccount = useCallback(
    async (sideAccountId: string) => {
      if (!sideAccountPlayer) return;

      try {
        const res = await fetchWithAuth(
          `${BASE_URL}/bingo/players/${encodeURIComponent(sideAccountPlayer.rsn)}/side-accounts/${sideAccountId}`,
          { method: 'DELETE' },
        );
        if (!res.ok) throw new Error(`Failed to remove side account: ${res.statusText}`);
        setSideAccounts((prev) => prev.filter((s) => s.id !== sideAccountId));
        setSideAccountsByPlayerId((prev) => ({
          ...prev,
          [sideAccountPlayer.id]: (prev[sideAccountPlayer.id] ?? []).filter(
            (s) => s.id !== sideAccountId,
          ),
        }));
      } catch (e) {
        setSideAccountError(String(e));
      }
    },
    [sideAccountPlayer, BASE_URL],
  );

  // ── Derived ───────────────────────────────────────────

  /** True when at least one team container has a player in it. */
  const anyTeamHasPlayers = teams.some((t) => (draftItems[t.id]?.length ?? 0) > 0);

  /** True when the pool is empty (all players have been drafted). */
  const poolIsEmpty = (draftItems['pool']?.length ?? 0) === 0 && players.length > 0;

  const draftIsDirty = !draftsEqual(draftItems, savedDraftItems);

  const submitTeamsDisabled =
    submitting || !poolIsEmpty || (teamsEverSubmitted && !draftIsDirty);

  const submitTeamsLabel =
    teamsEverSubmitted && draftIsDirty ? 'Update Teams' : 'Submit Teams';

  const teamNameById = useMemo(
    () => Object.fromEntries(teams.map((t) => [t.id, t.name])),
    [teams],
  );

  return {
    // Shared
    activeTab,
    setActiveTab,

    // Bingo / teams
    teams,
    teamNameById,
    loadingBingo,
    bingoError,

    // Draft (DnD)
    draftItems,
    setDraftItems,
    anyTeamHasPlayers,
    poolIsEmpty,
    teamsEverSubmitted,
    draftIsDirty,
    submitTeamsDisabled,
    submitTeamsLabel,
    submitting,
    submitError,
    submitSuccess,
    submitDraft,
    resetDraft,

    // Player management
    players,
    loadingPlayers,
    csvInput,
    setCsvInput,
    addingPlayers,
    addPlayerError,
    addResults,
    addPlayersFromCsv,
    removingRsn,
    removePlayer,
    captainUpdatingRsn,
    setPlayerCaptain,

    // Side accounts
    sideAccountPlayer,
    sideAccounts,
    loadingSideAccounts,
    newSideRsn,
    setNewSideRsn,
    newSideNotes,
    setNewSideNotes,
    addingSideAccount,
    sideAccountError,
    openSideAccountDialog,
    closeSideAccountDialog,
    addSideAccount,
    removeSideAccount,
    sideAccountsByPlayerId,
  };
};
