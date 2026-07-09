/**
 * Types for the Resource Library — mirrors the DATA CONTRACT in
 * TEAM-BRIEF-RESOURCES.md verbatim. Both the data-engineer's
 * `frontend/src/data/resources.json` and this frontend must stay in sync
 * with this shape; do not drift without updating the brief.
 */

export type SectionKind =
  | 'guides'
  | 'tileMarkers'
  | 'dataSheets'
  | 'media'
  | 'tools'
  | 'text';

export type LinkKind =
  | 'youtube'
  | 'streamable'
  | 'imgur'
  | 'sheet'
  | 'wiki'
  | 'other';

export type RuneliteKind = 'npcMarkers' | 'tileMarkers' | 'other';

export interface ResourceLink {
  label: string;
  url: string;
  kind: LinkKind;
}

export interface RuneliteConfig {
  label: string;
  kind: RuneliteKind;
  /** The FULL raw json string, verbatim — never render inline, copy-only. */
  json: string;
}

export interface ResourceItem {
  /** unique across the whole manifest */
  id: string;
  title: string;
  description?: string;
  /** paths relative to `.../assets/Images/resources/`, e.g. "tob/bad-crabs.jpg" */
  images?: string[];
  links?: ResourceLink[];
  runelite?: RuneliteConfig;
}

export interface ResourceSection {
  kind: SectionKind;
  title: string;
  items: ResourceItem[];
}

export interface ResourceCategory {
  /** kebab, stable, used in image paths + URL hash */
  id: string;
  name: string;
  /** coarse grouping label (Raids, Solo PvM, Skilling, Other) */
  group?: string;
  order: number;
  sections: ResourceSection[];
}

export interface ResourceManifest {
  generatedAt: string;
  categories: ResourceCategory[];
}

export const SECTION_KIND_LABELS: Record<SectionKind, string> = {
  guides: 'Guides & videos',
  tileMarkers: 'Tile & NPC markers',
  dataSheets: 'Data sheets',
  media: 'Media',
  tools: 'Tools',
  text: 'Notes',
};
