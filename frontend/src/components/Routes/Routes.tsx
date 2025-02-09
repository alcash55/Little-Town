import { Providers } from '../../layout/Providers';
import { Pages } from '../Pages';
import { createBrowserRouter, Route, createRoutesFromElements } from 'react-router-dom';

/**
 *  Routes component is responsible for creating the routes for the application.
 *  It uses the createBrowserRouter function from react-router-dom to create the routes.
 *  It also uses the createRoutesFromElements function to create the routes from the provided elements.
 *  The routes are defined in the Pages directory and are used to render the different pages of the application.
 * @returns {JSX.Element} The Routes component
 */
export const Routes = createBrowserRouter(
  createRoutesFromElements(
    <Route path="/" element={<Providers />}>
      <Route index element={<Pages.Home />} />
      <Route path="TeamData" element={<Pages.TeamData />} />
      <Route path="BingoBoard" element={<Pages.BingoBoard />} />
      <Route path="BingoScores" element={<Pages.BingoScores />} />
      <Route path="BingoRules" element={<Pages.BingoRules />} />
      {/* <Route path="AdminPanel" element={<Pages.AdminPanel />} /> */}
      <Route path="AdminPanel/BoardBuilder" element={<Pages.BoardBuilder />} />
      {/* 
      <Route path="Admin/Team Drafter" element={<Pages./>} />
      <Route path="Admin/BoardBuilder" element={<Pages./>} />
      <Route path="Admin/ScreenshotSubmissions" element={<Pages./>} /> */}
      <Route path="*" element={<Pages.Error />} />
    </Route>,
  ),
);
