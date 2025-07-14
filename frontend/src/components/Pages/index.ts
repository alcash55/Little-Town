import { lazy } from 'react';

export const Pages = {
  TeamData: lazy(() => import('./TeamData')),
  Home: lazy(() => import('./Home')),
  Error: lazy(() => import('./Error')),
  BingoBoard: lazy(() => import('./BingoBoard')),
  BingoRules: lazy(() => import('./BingoRules')),
  BingoScores: lazy(() => import('./BingoScores')),
  BingoDetails: lazy(() => import('./AdminPanel/BingoDetails/BingoDetails')),
  TeamDrafter: lazy(() => import('./AdminPanel/TeamDrafter/TeamDrafter')),
  BoardBuilder: lazy(() => import('./AdminPanel/BoardBuilder/BoardBuilder')),
  ScreenshotSubmission: lazy(
    () => import('./AdminPanel/ScreenshotSubmission/ScreenshotSubmission'),
  ),
};
