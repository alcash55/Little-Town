import { Autocomplete, CircularProgress, TextField } from '@mui/material';

export type TileTaskAutocompleteProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  loading: boolean;
};

/**
 * The task-name input shared by tile creation and tile editing (BoardBuilder)
 * — an Autocomplete over the OSRS activity/skill/item lists, suggestions-only
 * (freeSolo-style typing via `inputValue`/`onInputChange`, not tied to an
 * exact option match). Extracted so both flows stay in lockstep instead of
 * editing quietly regressing to a plain TextField.
 *
 * TEAM-BRIEF.md Sprint 17, Track B item 4(b) — the "options" selection
 * (`value`/`onChange`) was left uncontrolled, only `inputValue` was. MUI's
 * Autocomplete tracks its OWN internal `value` (the picked option) whenever
 * `onChange` isn't wired, and that internal selection survived a parent
 * reset of `inputValue` alone — clicking "Add Tile" cleared every other
 * field but the task text kept showing the just-added tile's name, still
 * `isTileValid`, ready to silently land on the NEXT tile if the admin
 * didn't notice and retyped only points/kill-count. Controlling `value`
 * (in lockstep with `inputValue`, both driven by the same parent string)
 * removes that second source of truth entirely, so `onChange('')` from
 * clearTileForm() actually clears what's on screen. `freeSolo` keeps intact
 * the original "typed text doesn't have to exactly match an option" contract
 * (e.g. a Drops item missing from the wiki price mapping).
 */
export const TileTaskAutocomplete = ({
  id,
  label,
  value,
  onChange,
  options,
  loading,
}: TileTaskAutocompleteProps) => (
  <Autocomplete
    id={id}
    freeSolo
    value={value}
    inputValue={value}
    onChange={(_, newValue) => onChange(newValue ?? '')}
    onInputChange={(_, newValue) => onChange(newValue)}
    options={options}
    loading={loading}
    sx={{ width: '100%' }}
    renderInput={(params) => (
      <TextField
        {...params}
        label={label}
        slotProps={{
          ...params.slotProps,
          input: {
            ...params.slotProps.input,
            endAdornment: (
              <>
                {loading && <CircularProgress sx={{ color: '#2A9D8F' }} size={20} />}
                {params.slotProps.input.endAdornment}
              </>
            ),
          },
        }}
      />
    )}
  />
);
