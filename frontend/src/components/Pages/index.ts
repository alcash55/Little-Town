import { lazy } from 'react';

export const Pages = {
  TeamData: lazy(() => import('./TeamData/TeamData')),
  Home: lazy(() => import('./Home/Home')),
  Error: lazy(() => import('./Error/Error')),
  BingoBoard: lazy(() => import('./BingoBoard/BingoBoard')),
  BingoRules: lazy(() => import('./BingoRules/BingoRules')),
  BingoScores: lazy(() => import('./BingoScores/BingoScores')),
  BingoDetails: lazy(() => import('./AdminPanel/BingoDetails/BingoDetails')),
  TeamDrafter: lazy(() => import('./AdminPanel/TeamDrafter/TeamDrafter')),
  BoardBuilder: lazy(() => import('./AdminPanel/BoardBuilder/BoardBuilder')),
  ScreenshotSubmission: lazy(
    () => import('./AdminPanel/ScreenshotSubmission/ScreenshotSubmission'),
  ),
  Unauthorized: lazy(() => import('./Unauthorized/Unauthorized')),
  Resources: lazy(() => import('./Resources/Resources')),
  BingoOverview: lazy(() => import('./AdminPanel/BingoOverview/BingoOverview')),
  Maintenance: lazy(() => import('./AdminPanel/Maintenance/Maintenance')),
  UserInvite: lazy(() => import('./AdminPanel/UserInvite/UserInvite')),
};
