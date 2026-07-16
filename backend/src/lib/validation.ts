import { Request, Response, NextFunction, RequestHandler } from "express";
import { z, ZodTypeAny } from "zod";

/**
 * Validates req.body against a zod schema. Replaces req.body with the parsed
 * (and coerced/defaulted) result on success; responds 400 on failure.
 */
export function validateBody(schema: ZodTypeAny): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error.issues[0]?.message ?? "Invalid request body",
      });
    }
    req.body = result.data;
    next();
  };
}

// -------------------------------------------------------
// Bingo details (POST /bingo/details)
// -------------------------------------------------------

export const bingoDetailsSchema = z.object({
  name: z.string().min(1, "Bingo name is required"),
  start: z.string().optional(),
  end: z.string().optional(),
  size: z.number().int().positive().optional(),
  teams: z
    .array(z.string().min(1))
    .refine(
      (names) => new Set(names.map((n) => n.trim().toLowerCase())).size === names.length,
      { message: "Team names must be unique" },
    )
    .optional(),
});

// -------------------------------------------------------
// Bingo update (PUT /bingo/:id)
// -------------------------------------------------------

export const bingoUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  // "active" is deliberately excluded — activation must go through
  // POST /bingo/activate so start/current snapshots get taken; a direct PUT
  // to "active" would also collide confusingly with uq_bingos_one_active.
  status: z.enum(["draft", "complete", "archived"]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  boardSize: z.number().int().positive().optional(),
  teams: z
    .array(z.string().min(1))
    .refine(
      (names) => new Set(names.map((n) => n.trim().toLowerCase())).size === names.length,
      { message: "Team names must be unique" },
    )
    .optional(),
});

// -------------------------------------------------------
// Board tiles (POST/PUT /bingo/board)
// -------------------------------------------------------

const boardTileTypes = ["Kill Count", "Experience", "Drops"] as const;

export const boardTileSchema = z
  .object({
    type: z.enum(boardTileTypes),
    task: z.string().min(1, "Tile task is required").max(100, "Tile task must be 100 characters or fewer"),
    points: z.number(),
    killCount: z.number().optional(),
    experience: z.number().optional(),
    dropsAmount: z.number().optional(),
  })
  .passthrough(); // tile metadata is stored as-is; only validate the fields we rely on

export const boardTilesSchema = z.array(boardTileSchema);

// -------------------------------------------------------
// Draft assignments (POST /bingo/draft)
// -------------------------------------------------------

export const draftAssignmentsSchema = z.array(
  z.object({
    rsn: z.string().min(1, "RSN is required"),
    teamId: z.string().nullable(),
  }),
);

// -------------------------------------------------------
// Player registration (POST /bingo/players)
// -------------------------------------------------------

export const playerRegistrationSchema = z.object({
  rsn: z.string().min(1, "RSN is required"),
  teamId: z.string().optional(),
});

// -------------------------------------------------------
// Side accounts (POST /bingo/players/:rsn/side-accounts)
// -------------------------------------------------------

export const sideAccountSchema = z.object({
  rsn: z.string().min(1, "RSN is required"),
  notes: z.string().optional(),
});

// -------------------------------------------------------
// Screenshot submission review (POST /bingo/screenshots/:id/approve)
// -------------------------------------------------------

export const screenshotApprovalSchema = z.object({
  tileId: z.string().min(1, "Tile ID is required"),
  teamId: z.string().min(1, "Team ID is required"),
  playerId: z.string().min(1).optional(),
});

// playerId is intentionally NOT required=true here in the zod schema — the
// frozen contract (TEAM-BRIEF.md Sprint 13, Track A) requires approving
// without one to fail with 422 specifically, and validateBody's own
// zod-failure path always responds 400 (see lib/validation.ts's
// validateBody above). The route handler enforces the 422 explicitly
// instead (routes/admin.ts's POST .../approve) so the required-shape check
// (this schema) and the required-field-with-a-specific-status-code check
// stay decoupled.

// -------------------------------------------------------
// Tagging a still-pending submission with tile+team (PATCH
// /bingo/screenshots/:id/tag) — NEW Sprint 13, Track A: lets an admin
// associate a pending submission with a tile/team BEFORE approving/denying
// it, so GET /api/bingo/board's pendingByMyTeam has something to key off of
// (a pending row previously never carried tile_id/team_id at all — see
// db/bingoSubmissions.ts's tagPendingSubmission doc comment). No playerId
// here — attribution only ever happens at approval time or via the
// separate backfill route.
// -------------------------------------------------------

export const screenshotTagSchema = z.object({
  tileId: z.string().min(1, "Tile ID is required"),
  teamId: z.string().min(1, "Team ID is required"),
});

// -------------------------------------------------------
// Backfilling attribution on an already-approved submission
// (PATCH /bingo/screenshots/:id/attribute) — playerId is REQUIRED here
// (unlike screenshotApprovalSchema above): the whole point of this route is
// filling in a previously-skipped attribution, so an empty call would be a
// no-op that's better rejected than silently accepted.
// -------------------------------------------------------

export const screenshotAttributionSchema = z.object({
  playerId: z.string().min(1, "Player ID is required"),
});

// -------------------------------------------------------
// Invites (POST /admin/invites, POST /invites/:token/accept)
// -------------------------------------------------------

export const inviteCreateSchema = z.object({
  role: z.enum(["user", "admin", "moderator"]).optional(),
  expiresInHours: z.number().int().positive().optional(),
});

export const inviteAcceptSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(32, "Username must be 32 characters or fewer")
    .regex(
      /^[a-zA-Z0-9_.-]+$/,
      "Username may only contain letters, numbers, underscores, periods, and hyphens",
    ),
  password: z.string().min(8, "Password must be at least 8 characters"),
  nickname: z.string().min(1).max(50).optional(),
});

// -------------------------------------------------------
// Onboarding RSN claim (POST /onboarding/rsn — TEAM-BRIEF.md Sprint 11,
// Track A frozen contract). Loose length cap only — character-class shape
// (letters/digits/spaces/hyphens after canonicalization) is checked
// post-canonicalization in the route via lib/rsn.ts's isPlausibleRsn, since
// canonicalization (trim/underscore-to-space) has to happen first. This
// schema just keeps obviously-garbage bodies (empty, absurdly long) from
// reaching that point.
// -------------------------------------------------------

export const rsnClaimSchema = z.object({
  rsn: z.string().min(1, "RSN is required").max(40, "RSN is too long"),
});
