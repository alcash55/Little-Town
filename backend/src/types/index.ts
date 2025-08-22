export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface HiscoreData {
  [key: string]: {
    level: number | "unranked";
    experience: number;
  };
}

export interface BingoConfig {
  id?: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  teams: string[];
  tasks: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface User {
  id: string;
  username: string;
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
