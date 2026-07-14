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
    inputValue={value}
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
