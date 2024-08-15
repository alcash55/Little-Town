import { Providers } from '../../layout/Providers';
import { Pages } from '../Pages';
import { createBrowserRouter, Route, createRoutesFromElements } from 'react-router-dom';

export const Routes = createBrowserRouter(
  createRoutesFromElements(
    <Route path="/" element={<Providers />} errorElement={<Pages.Error />}>
      <Route index element={<Pages.Home />} />
      <Route path="/TeamData" element={<Pages.TeamData />} />
      <Route path="/BingoBoard" element={<Pages.BingoBoard />} />
      <Route path="/BingoScores" element={<Pages.BingoScores />} />
      <Route path="/BingoRules" element={<Pages.BingoRules />} />
      <Route path="/AdminPanel" element={<Pages.AdminPanel />} />
    </Route>,
  ),
);
