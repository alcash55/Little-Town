import { getDb } from "./client.js";

// This read-only RPC checks the migration through the same API and role as auth.
export async function assertAccountRecoverySchemaReady(): Promise<void> {
  const { data, error } = await getDb()
    .rpc("account_recovery_schema_ready")
    .abortSignal(AbortSignal.timeout(5_000));
  if (error || data !== true) {
    // Never include driver messages, URLs, or credentials in startup output.
    throw new Error(
      "Account recovery schema unavailable. Apply pending database migrations and verify Supabase access."
    );
  }
}
