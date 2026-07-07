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
  status: z.enum(["draft", "active", "complete", "archived"]).optional(),
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
