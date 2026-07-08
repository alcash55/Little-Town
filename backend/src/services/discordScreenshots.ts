import { Client, GatewayIntentBits, Attachment, Message, TextBasedChannel } from "discord.js";
import { getDb } from "../db/client.js";
import { getActiveBingo } from "../db/bingos.js";
import {
  submissionExistsByDiscordMessageId,
  insertPendingSubmission,
  SCREENSHOTS_BUCKET,
} from "../db/bingoSubmissions.js";

const BACKFILL_LIMIT = 100;

let client: Client | null = null;

function isImageAttachment(attachment: Attachment): boolean {
  if (attachment.contentType?.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp)$/i.test(attachment.name ?? "");
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/**
 * Downloads a Discord attachment and uploads it to the private `screenshots`
 * storage bucket, returning the stored object path.
 */
async function uploadAttachment(
  bingoId: string,
  discordMessageId: string,
  attachment: Attachment,
): Promise<string> {
  const response = await fetch(attachment.url);
  if (!response.ok) {
    throw new Error(
      `Failed to download Discord attachment ${attachment.id}: ${response.status} ${response.statusText}`,
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const path = `${bingoId}/${sanitizeFileName(discordMessageId)}-${sanitizeFileName(
    attachment.name ?? attachment.id,
  )}`;

  const { error } = await getDb()
    .storage.from(SCREENSHOTS_BUCKET)
    .upload(path, buffer, {
      contentType: attachment.contentType ?? "application/octet-stream",
      upsert: false,
    });

  if (error) throw new Error(`Failed to upload screenshot to storage: ${error.message}`);
  return path;
}

/**
 * Ingests every image attachment on a message into bingo_submissions
 * (status pending). Skips attachments whose discord_message_id has already
 * been ingested. Messages with more than one image attachment get one row
 * per attachment, suffixed `:<index>` so discord_message_id stays unique
 * (see reactToSubmissionMessage, which strips the suffix back off).
 */
async function ingestMessage(message: Message): Promise<void> {
  if (message.author.bot) return;

  const imageAttachments = [...message.attachments.values()].filter(isImageAttachment);
  if (imageAttachments.length === 0) return;

  const bingo = await getActiveBingo();
  if (!bingo?.id || bingo.status !== "active") {
    console.warn(
      `[discordScreenshots] No active bingo — skipping screenshot from message ${message.id}.`,
    );
    return;
  }
  const bingoId = bingo.id;

  for (let index = 0; index < imageAttachments.length; index++) {
    const attachment = imageAttachments[index];
    const discordMessageId =
      imageAttachments.length > 1 ? `${message.id}:${index}` : message.id;

    try {
      if (await submissionExistsByDiscordMessageId(discordMessageId)) continue;

      const imagePath = await uploadAttachment(bingoId, discordMessageId, attachment);

      await insertPendingSubmission({
        bingoId,
        discordMessageId,
        imagePath,
        // bingo_submissions.submitted_by is a FK to `users`, and Discord
        // authors generally have no corresponding registered account, so
        // there's nowhere else in the current schema to record who posted
        // this — stash it in `notes` for the reviewing admin.
        notes: `Submitted via Discord by ${message.author.tag} (${message.author.id})`,
      });

      console.log(
        `[discordScreenshots] Ingested screenshot from ${message.author.tag} (message ${discordMessageId})`,
      );
    } catch (e) {
      console.error(
        `[discordScreenshots] Failed to ingest attachment ${attachment.id} on message ${message.id}:`,
        e,
      );
    }
  }
}

/**
 * Scans the last `BACKFILL_LIMIT` messages in the configured channel on
 * startup, oldest first, so any screenshots posted while the bot was
 * offline still get ingested (dedupe makes this safe to re-run).
 */
async function backfillChannel(channel: TextBasedChannel): Promise<void> {
  try {
    const messages = await channel.messages.fetch({ limit: BACKFILL_LIMIT });
    const ordered = [...messages.values()].reverse();
    for (const message of ordered) {
      await ingestMessage(message);
    }
    console.log(`[discordScreenshots] Backfill complete (${ordered.length} messages scanned).`);
  } catch (e) {
    console.error("[discordScreenshots] Backfill failed:", e);
  }
}

/**
 * Starts the Discord gateway client and begins watching
 * DISCORD_SCREENSHOT_CHANNEL_ID for image attachments. Both DISCORD_BOT_TOKEN
 * and DISCORD_SCREENSHOT_CHANNEL_ID are optional — if either is unset this
 * logs a single warning and does not start (the admin review API still
 * works against whatever submissions already exist).
 */
export function startDiscordScreenshotService(): void {
  const token = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.DISCORD_SCREENSHOT_CHANNEL_ID;

  if (!token || !channelId) {
    console.warn(
      "[discordScreenshots] DISCORD_BOT_TOKEN / DISCORD_SCREENSHOT_CHANNEL_ID not set — Discord screenshot ingest disabled.",
    );
    return;
  }

  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  client.once("ready", async (readyClient) => {
    console.log(`[discordScreenshots] Logged in as ${readyClient.user.tag}`);
    try {
      const channel = await readyClient.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) {
        console.error(
          `[discordScreenshots] Configured channel ${channelId} is not a readable text channel.`,
        );
        return;
      }
      await backfillChannel(channel);
    } catch (e) {
      console.error("[discordScreenshots] Failed to fetch configured channel:", e);
    }
  });

  client.on("messageCreate", (message) => {
    if (message.channelId !== channelId) return;
    ingestMessage(message).catch((e) =>
      console.error(`[discordScreenshots] Error processing message ${message.id}:`, e),
    );
  });

  client.on("error", (e) => console.error("[discordScreenshots] Client error:", e));

  client.login(token).catch((e) => {
    console.error("[discordScreenshots] Failed to log in:", e);
  });
}

export function stopDiscordScreenshotService(): void {
  if (client) {
    client.destroy();
    client = null;
    console.log("[discordScreenshots] Stopped.");
  }
}

/**
 * Best-effort reaction on the original Discord message for a reviewed
 * submission (👍 on approve, 👎 on deny). No-ops if the service isn't
 * running; swallows errors (deleted message/channel, missing permissions,
 * etc.) since a failed reaction must never block the review itself.
 */
export async function reactToSubmissionMessage(
  discordMessageId: string,
  emoji: "👍" | "👎",
): Promise<void> {
  const channelId = process.env.DISCORD_SCREENSHOT_CHANNEL_ID;
  if (!client || !channelId) return;

  // Multi-attachment messages are stored as `<messageId>:<index>` — strip
  // the suffix to get back the real Discord message id to react to.
  const realMessageId = discordMessageId.split(":")[0];

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) return;
    const message = await channel.messages.fetch(realMessageId);
    await message.react(emoji);
  } catch (e) {
    console.warn(`[discordScreenshots] Best-effort reaction failed for message ${realMessageId}:`, e);
  }
}
