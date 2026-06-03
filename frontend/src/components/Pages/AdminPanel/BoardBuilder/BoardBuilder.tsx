import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Stack,
  TextField,
  Typography,
  Autocomplete,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2';
import { useBoardBuilder, Tile } from './useBoardBuilder';
import { darkTheme } from '../../../../layout/Theme';
import Close from '@mui/icons-material/Close';
import Edit from '@mui/icons-material/Edit';
import DragIndicator from '@mui/icons-material/DragIndicator';
import PageLayout from '../../../../layout/PageLayout/PageLayout';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Sortable tile card
const SortableTileCard = ({
  tile,
  idx,
  onRemove,
  onEdit,
}: {
  tile: Tile;
  idx: number;
  onRemove: () => void;
  onEdit: () => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: idx });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 999 : 'auto',
  };

  return (
    <Grid
      ref={setNodeRef}
      style={style}
      xs={12} sm={6} md={4} lg={3}
      width="220px"
      height="200px"
      sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}
    >
      <Card sx={{ width: '100%', height: '100%', backgroundImage: 'linear-gradient(to bottom, #2A9D8F, rgba(13, 13, 13, 0.86))', cursor: 'default' }}>
        <CardHeader
          title={tile.task}
          avatar={
            <IconButton size="small" {...listeners} {...attributes} sx={{ cursor: 'grab', color: 'black', touchAction: 'none' }}>
              <DragIndicator />
            </IconButton>
          }
          action={
            <Stack direction="row">
              <IconButton aria-label="edit tile" onClick={onEdit}>
                <Edit fontSize="small" sx={{ color: 'black' }} />
              </IconButton>
              <IconButton aria-label="remove tile" onClick={onRemove}>
                <Close sx={{ color: 'black' }} />
              </IconButton>
            </Stack>
          }
          titleTypographyProps={{ variant: 'h6', fontSize: 16, noWrap: true }}
        />
        <CardContent>
          <Stack>
            <Typography variant="body1">Type: {tile.type}</Typography>
            <Typography variant="body1">Points: {tile.points}</Typography>
            <Typography variant="body1">
              Objective:{' '}
              {tile.type === 'Kill Count'
                ? `Kill ${tile.killCount}`
                : tile.type === 'Experience'
                  ? `Gain ${tile.experience} xp`
                  : `Get ${tile.dropsAmount} ${tile.task}s`}
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Grid>
  );
};

const BoardBuilder = () => {
  const {
    tilesTypeOptions,
    tileType, setTileType,
    tileTask, setTileTask,
    tilePoints, setTilePoints,
    tileKillCount, setTileKillCount,
    tileExperience, setTileExperience,
    tileDropsAmount, setTileDropsAmount,
    activities, skills, items, loading,
    board, boardSize,
    submitted,
    submitError,
    isTileValid, isBoardComplete, isExistingBoard,
    inputSx,
    addTile, removeTile, reorderTiles,
    editingTile, startEditingTile, updateEditingTile, saveEditingTile, cancelEditingTile,
    clearTileForm, clearBoard, submitBoard,
  } = useBoardBuilder();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      reorderTiles(active.id as number, over.id as number);
    }
  };

  return (
    <PageLayout
      title="Board Builder"
      bingoItem="Board"
      maxWidth="full"
      showExistingWarning={isExistingBoard}
      error={submitError}
      submitted={submitted}
      isUpdated={isExistingBoard}
    >
      <Stack spacing={3} justifyContent="center" alignItems="center" sx={{ maxWidth: 500, width: '100%' }}>
        <FormControl variant="outlined" sx={{ m: 1, minWidth: 120, width: '100%' }} required>
          <InputLabel id="tile-type-select-label">Tile Type</InputLabel>
          <Select
            labelId="tile-type-select-label"
            id="tile-type-select"
            value={tileType.value}
            onChange={(e: SelectChangeEvent<number>) => {
              const selected = tilesTypeOptions.find((o) => o.value === e.target.value);
              if (selected) {
                setTileType(selected);
                setTileTask('');
              }
            }}
            label="Tile Type"
            sx={inputSx}
          >
            {tilesTypeOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {tileType.value === 1 && (
          <Autocomplete
            id="tile-task-kc"
            inputValue={tileTask}
            onInputChange={(_, value) => setTileTask(value)}
            options={activities}
            loading={loading}
            sx={{ width: '100%' }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Boss / Monster / Mini Game"
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {loading && <CircularProgress sx={{ color: '#2A9D8F' }} size={20} />}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
                sx={inputSx}
              />
            )}
          />
        )}

        {tileType.value === 2 && (
          <Autocomplete
            id="tile-task-xp"
            inputValue={tileTask}
            onInputChange={(_, value) => setTileTask(value)}
            options={skills}
            loading={loading}
            sx={{ width: '100%' }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Skill"
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {loading && <CircularProgress sx={{ color: '#2A9D8F' }} size={20} />}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
                sx={inputSx}
              />
            )}
          />
        )}

        {tileType.value === 3 && (
          <Autocomplete
            id="tile-task-drops"
            inputValue={tileTask}
            onInputChange={(_, value) => setTileTask(value)}
            options={items}
            loading={loading}
            sx={{ width: '100%' }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Item Name"
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {loading && <CircularProgress sx={{ color: '#2A9D8F' }} size={20} />}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
                sx={inputSx}
              />
            )}
          />
        )}

        <TextField
          id="tile-points"
          label="Tile Points"
          variant="outlined"
          type="number"
          fullWidth
          required
          value={tilePoints ?? ''}
          onChange={(e) => setTilePoints(Number(e.target.value))}
          sx={inputSx}
        />

        {tileType.name === 'Kill Count' ? (
          <TextField
            id="kc"
            label="Number of Kills"
            type="number"
            required
            fullWidth
            value={tileKillCount ?? ''}
            onChange={(e) => setTileKillCount(Number(e.target.value))}
            sx={inputSx}
          />
        ) : tileType.name === 'Experience' ? (
          <TextField
            id="xp"
            label="Total Experience"
            type="number"
            required
            fullWidth
            value={tileExperience ?? ''}
            onChange={(e) => setTileExperience(Number(e.target.value))}
            sx={inputSx}
          />
        ) : (
          <TextField
            id="drops"
            label="How many drops?"
            type="number"
            required
            fullWidth
            value={tileDropsAmount ?? ''}
            onChange={(e) => setTileDropsAmount(Number(e.target.value))}
            sx={inputSx}
          />
        )}

        <Stack spacing={2} direction="row" width="100%">
          <Button
            variant="outlined"
            color="success"
            disabled={!isTileValid}
            onClick={addTile}
            sx={{ width: '50%' }}
          >
            Add Tile
          </Button>
          <Button
            variant="outlined"
            color="error"
            onClick={clearTileForm}
            sx={{ width: '50%' }}
          >
            Clear
          </Button>
        </Stack>

        <Typography variant="body2" sx={{ color: darkTheme.palette.text.secondary }}>
          {board.length} / {boardSize} tiles added
        </Typography>

        {isBoardComplete && (
          <Button variant="outlined" color={isExistingBoard ? 'info' : 'success'} onClick={submitBoard} fullWidth>
            {isExistingBoard ? 'Update Board' : 'Submit Board'}
          </Button>
        )}

        {board.length > 0 && (
          <Button variant="outlined" color="error" onClick={clearBoard} fullWidth>
            Clear Entire Board
          </Button>
        )}
      </Stack>

      <Box sx={{ width: '100%', boxSizing: 'border-box', pb: 8 }}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={board.map((_, i) => i)} strategy={rectSortingStrategy}>
            <Grid container spacing={2} width="100%" sx={{ p: 0 }}>
              {board.map((tile, idx) => (
                <SortableTileCard
                  key={idx}
                  tile={tile}
                  idx={idx}
                  onRemove={() => removeTile(tile)}
                  onEdit={() => startEditingTile(idx)}
                />
              ))}
            </Grid>
          </SortableContext>
        </DndContext>
      </Box>

      {/* Inline edit dialog */}
      <Dialog open={!!editingTile} onClose={cancelEditingTile} maxWidth="xs" fullWidth>
        <DialogTitle>Edit Tile</DialogTitle>
        <DialogContent>
          {editingTile && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <TextField
                label="Task"
                fullWidth
                value={editingTile.tile.task}
                onChange={(e) => updateEditingTile({ task: e.target.value })}
              />
              <TextField
                label="Points"
                type="number"
                fullWidth
                value={editingTile.tile.points}
                onChange={(e) => updateEditingTile({ points: Number(e.target.value) })}
              />
              {editingTile.tile.type === 'Kill Count' && (
                <TextField
                  label="Kill Count"
                  type="number"
                  fullWidth
                  value={(editingTile.tile as any).killCount}
                  onChange={(e) => updateEditingTile({ killCount: Number(e.target.value) } as any)}
                />
              )}
              {editingTile.tile.type === 'Experience' && (
                <TextField
                  label="Experience"
                  type="number"
                  fullWidth
                  value={(editingTile.tile as any).experience}
                  onChange={(e) => updateEditingTile({ experience: Number(e.target.value) } as any)}
                />
              )}
              {editingTile.tile.type === 'Drops' && (
                <TextField
                  label="Drops Amount"
                  type="number"
                  fullWidth
                  value={(editingTile.tile as any).dropsAmount}
                  onChange={(e) => updateEditingTile({ dropsAmount: Number(e.target.value) } as any)}
                />
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelEditingTile} color="error">Cancel</Button>
          <Button onClick={saveEditingTile} color="success" variant="outlined">Save</Button>
        </DialogActions>
      </Dialog>
    </PageLayout>
  );
};

export default BoardBuilder;
