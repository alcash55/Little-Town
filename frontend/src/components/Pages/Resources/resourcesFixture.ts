import { ResourceManifest } from './types';

/**
 * MOCK DATA — TEMPORARY.
 *
 * Story R2.g: an inline fixture matching the DATA CONTRACT exactly, built so
 * every interaction (category switch, search, lightbox, RuneLite copy) can be
 * fully driven before the data-engineer's real
 * `frontend/src/data/resources.json` lands.
 *
 * The lead swaps this for the real manifest at integration — see
 * `useResources.ts`, which is the single place that decides the data source.
 */
export const resourcesFixture: ResourceManifest = {
  generatedAt: '2026-07-08T00:00:00.000Z',
  categories: [
    {
      id: 'tob',
      name: 'Theatre of Blood',
      group: 'Raids',
      order: 1,
      sections: [
        {
          kind: 'guides',
          title: 'Guides & videos',
          items: [
            {
              id: 'tob-bad-crabs',
              title: 'Bad crabs (P2 crab pattern)',
              description:
                'How to read the crab spawn pattern in the Bloat room so the team splits cleanly.',
              images: ['tob/hm-big-split-markers.jpg'],
              links: [
                { label: 'YouTube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', kind: 'youtube' },
                { label: 'Wiki', url: 'https://oldschool.runescape.wiki/w/Theatre_of_Blood', kind: 'wiki' },
              ],
            },
          ],
        },
        {
          kind: 'tileMarkers',
          title: 'Tile & NPC markers',
          items: [
            {
              id: 'tob-hm-big-split',
              title: 'HM Big Split — radius markers',
              description: 'NPC radius markers for calling Nylocas splits in Hard Mode.',
              runelite: {
                label: 'HM Big Split — radius markers',
                kind: 'npcMarkers',
                json: '{"regionRadius":15,"npcIds":[10800,10801,10802],"markerColor":"#FF5555","name":"HM Big Split"}',
              },
            },
          ],
        },
      ],
    },
    {
      id: 'toa',
      name: 'Tombs of Amascut',
      group: 'Raids',
      order: 2,
      sections: [
        {
          kind: 'guides',
          title: 'Guides & videos',
          items: [
            {
              id: 'toa-baba-puzzle',
              title: 'Ba-Ba boulder puzzle order',
              description: 'Safe tile order to dodge the rolling boulders on higher invocations.',
              images: ['toa/baba-puzzle-order.png'],
              links: [{ label: 'Imgur', url: 'https://imgur.com/a/example', kind: 'imgur' }],
            },
          ],
        },
        {
          kind: 'dataSheets',
          title: 'Data sheets',
          items: [
            {
              id: 'toa-invocation-points',
              title: 'Invocation point costs',
              description: 'Community-maintained sheet of invocation point costs per raid level.',
              links: [{ label: 'Sheet', url: 'https://docs.google.com/spreadsheets/d/example', kind: 'sheet' }],
            },
          ],
        },
      ],
    },
    {
      id: 'cox',
      name: 'Chambers of Xeric',
      group: 'Raids',
      order: 3,
      sections: [
        {
          kind: 'media',
          title: 'Media',
          items: [
            {
              id: 'cox-olm-head-phases',
              title: 'Olm head phase reference',
              description: 'Screenshot reference for the three Great Olm head-phase attacks.',
              images: ['cox/olm-head-phases.png'],
            },
          ],
        },
      ],
    },
  ],
};
