export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface HiscoreData {
  name: string;
  skills: [
    {
      id: number;
      name: string;
      rank: number;
      level: number;
      xp: number;
    }
  ];
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

export interface LoginResponse {
  user: User;
  token: string;
  expiresAt: string;
}

export interface ErrorResponse {
  error: string;
  code?: string;
  details?: any;
}
