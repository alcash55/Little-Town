export type BossList = Boss[];

export type Boss = {
  id: number;
  name: string;
};

export type Tile = {
  name: string;
  tile_type: string;
  task: string;
  instructions: string;
  icon_url: string;
};
