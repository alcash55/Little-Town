import { lazy } from 'react';

export const Pages = {
  TeamData: lazy(() => import('./TeamData')),
  Home: lazy(() => import('./Home')),
  Error: lazy(() => import('./Error')),
  BingoBoard: lazy(() => import('./BingoBoard')),
  BingoRules: lazy(() => import('./BingoRules')),
  BingoScores: lazy(() => import('./BingoScores')),
  // AdminPanel: lazy(() => import('./AdminPanel')),
  // BingoBuilder: lazy(() => import('./AdminPanel/BingoBuilder/BingoBuilder')),
  // TeamDrafter: lazy(()=> import('./AdminPanel'))
  BoardBuilder: lazy(() => import('./AdminPanel/BoardBuilder/BoardBuilder')),
  // ScreenshotSubmissions: lazy(()=> import('./AdminPanel'))
};
