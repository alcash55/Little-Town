import { getDb } from "./client.js";

/**
 * Upsert a static data array (e.g. skills or activities) into the DB.
 */
export async function upsertStaticData(key: string, data: string[]): Promise<void> {
  const db = getDb();
  const { error } = await db
    .from("osrs_static_data")
    .upsert({ key, data, updated_at: new Date().toISOString() }, { onConflict: "key" });

  if (error) throw new Error(`Failed to upsert static data for "${key}": ${error.message}`);
}

/**
 * Fetch a static data array by key. Returns empty array if not found.
 */
export async function getStaticData(key: string): Promise<string[]> {
  const db = getDb();
  const { data, error } = await db
    .from("osrs_static_data")
    .select("data, updated_at")
    .eq("key", key)
    .single();

  if (error || !data) return [];
  return data.data as string[];
}

/**
 * Returns the updated_at timestamp for a static data key, or null if not found.
 */
export async function getStaticDataUpdatedAt(key: string): Promise<string | null> {
  const db = getDb();
  const { data, error } = await db
    .from("osrs_static_data")
    .select("updated_at")
    .eq("key", key)
    .single();

  if (error || !data) return null;
  return data.updated_at;
}
