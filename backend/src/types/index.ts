export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface HiscoreData {
  name: string;
  skills: Array<{
    id: number;
    name: string;
    rank: number;
    level: number;
    xp: number;
  }>;
  activities: Array<{ id: number; name: string; rank: number; kc: number }>;
  updatedAt: Date;
}

export type BingoStatus = "draft" | "active" | "complete" | "archived";

export interface BingoTeam {
  id: string;
  name: string;
  sortOrder: number;
}

export interface BingoConfig {
  id?: string;
  name: string;
  description?: string;
  status?: BingoStatus;
  startDate: string;
  endDate: string;
  boardSize: number;
  numberOfTeams?: number;
  teams: string[];
  teamObjects?: BingoTeam[];
  tasks: string[];
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SideAccount {
  id: string;
  player_id: string;
  rsn: string;
  notes: string | null;
  added_by: string | null;
  added_at: string;
}

export interface User {
  id: string;
  username: string;
  nickname?: string | null;
  email?: string;
  role: "user" | "admin" | "moderator";
  createdAt: string;
  updatedAt: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

// The JWT itself is never in this response body (issue #53) — it's set as
// an httpOnly cookie by setAuthCookie (see lib/session.ts) instead, so it
// isn't readable by client-side JS.
export interface LoginResponse {
  user: User;
  expiresAt: string;
}

export interface ErrorResponse {
  error: string;
  code?: string;
  details?: any;
}
