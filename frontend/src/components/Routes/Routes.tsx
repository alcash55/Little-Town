import { Providers } from '../../layout/Providers';
import { Pages } from '../Pages';
import { ProtectedRoute } from './ProtectedRoute';
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
      {/* Public routes */}
      <Route index element={<Pages.Home />} />
      <Route path="unauthorized" element={<Pages.Unauthorized />} />
      <Route path="Resources" element={<Pages.Resources />} />

      {/* Player routes */}
      <Route path="BingoRules" element={<ProtectedRoute allowedRoles={['user', 'admin', 'moderator']}><Pages.BingoRules /></ProtectedRoute>} />
      <Route path="BingoBoard" element={<ProtectedRoute allowedRoles={['user', 'admin', 'moderator']}><Pages.BingoBoard /></ProtectedRoute>} />
      <Route path="TeamData" element={<ProtectedRoute allowedRoles={['user', 'admin', 'moderator']}><Pages.TeamData /></ProtectedRoute>} />
      <Route path="BingoScores" element={<ProtectedRoute allowedRoles={['user', 'admin', 'moderator']}><Pages.BingoScores /></ProtectedRoute>} />

      {/* Admin routes */}
      <Route path="AdminPanel/BingoDetails" element={<ProtectedRoute allowedRoles={['admin']}><Pages.BingoDetails /></ProtectedRoute>} />
      <Route path="AdminPanel/BoardBuilder" element={<ProtectedRoute allowedRoles={['admin']}><Pages.BoardBuilder /></ProtectedRoute>} />
      <Route path="AdminPanel/TeamDrafter" element={<ProtectedRoute allowedRoles={['admin']}><Pages.TeamDrafter /></ProtectedRoute>} />
      <Route path="AdminPanel/ScreenshotSubmission" element={<ProtectedRoute allowedRoles={['admin']}><Pages.ScreenshotSubmission /></ProtectedRoute>} />

      <Route path="*" element={<Pages.Error />} />
    </Route>,
  ),
);
