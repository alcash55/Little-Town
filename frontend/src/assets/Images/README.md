Other assets:

- [potential custom cursors](https://github.com/runelite/runelite/tree/master/runelite-client/src/main/resources/net/runelite/client/plugins/customcursor)

- [Skill icons](https://github.com/runelite/runelite/tree/master/runelite-client/src/main/resources/skill_icons)

- [hud icons](https://github.com/runelite/runelite/tree/master/runelite-client/src/main/resources/hud_icons)

- [boss icons](https://github.com/Bram91/runelite/tree/master/runelite-client/src/main/resources/net/runelite/client/plugins/hiscore/bosses)

Gang icons:

- `gangs/` holds the clan gang icons shown on the Home page. `Home/gangIcons.ts` picks up every svg in it with `import.meta.glob`. Screen readers announce the filename, split on capitals: `redHat.svg` reads "Little Town red hat logo". Name files the way they should sound, then add the new label to the pinned list in `gangIcons.test.ts`.
