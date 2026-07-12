import bcrypt from "bcrypt";

const SALT_ROUNDS = 12;
import { getDb } from "./client.js";
import { User } from "../types/index.js";

interface UserRow {
  id: string;
  username: string;
  nickname: string | null;
  email: string | null;
  password_hash: string;
  role: "user" | "admin" | "moderator";
  created_at: string;
  updated_at: string;
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    nickname: row.nickname ?? null,
    email: row.email ?? undefined,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  if (passwordHash.startsWith("dev:")) {
    return (
      process.env.ALLOW_DEV_AUTH === "true" &&
      process.env.NODE_ENV !== "production" &&
      password === passwordHash.slice(4)
    );
  }

  return bcrypt.compare(password, passwordHash);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function findUserByUsername(
  username: string,
): Promise<(User & { passwordHash: string }) | null> {
  const { data, error } = await getDb()
    .from("users")
    .select("id, username, nickname, email, password_hash, role, created_at, updated_at")
    .eq("username", username)
    .single();

  if (error || !data) return null;
  const row = data as UserRow;
  return { ...toUser(row), passwordHash: row.password_hash };
}

export async function loginUser(
  username: string,
  password: string,
): Promise<User | null> {
  const user = await findUserByUsername(username);
  if (!user || !(await verifyPassword(password, user.passwordHash)))
    return null;

  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

export async function findUserById(id: string): Promise<User | null> {
  const { data, error } = await getDb()
    .from("users")
    .select("id, username, nickname, email, password_hash, role, created_at, updated_at")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return toUser(data as UserRow);
}

export interface UserListItem {
  id: string;
  label: string;
  role: "user" | "admin" | "moderator";
}

/**
 * All users, for the impersonation picker (GET /api/admin/users — TEAM-
 * BRIEF.md Sprint 6, Track A item 2). `label` is nickname-or-username, the
 * same display-name fallback the app bar already uses (see
 * frontend/AppShell/.../Bar.tsx's getInitials) — RSN isn't usable here since
 * bingo_players has no unique, reliable FK back to the user who owns the
 * account (registered_by is whoever ran the registration call, usually an
 * admin registering someone else, not a self-service link).
 */
export async function listUsers(): Promise<UserListItem[]> {
  const { data, error } = await getDb()
    .from("users")
    .select("id, username, nickname, role")
    .order("username", { ascending: true });

  if (error) throw new Error(`Failed to list users: ${error.message}`);

  return ((data ?? []) as Array<Pick<UserRow, "id" | "username" | "nickname" | "role">>).map((row) => ({
    id: row.id,
    label: row.nickname?.trim() || row.username,
    role: row.role,
  }));
}
