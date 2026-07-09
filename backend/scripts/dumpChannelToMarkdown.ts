/**
 * Standalone CLI: dumps the full history of a Discord text channel to a
 * human-trimmable markdown file, oldest message first.
 *
 * Usage:
 *   bun run dump-resources -- --channel <id> [--out <path>]
 *
 * Reuses the discord.js client conventions from
 * src/services/discordScreenshots.ts, but runs standalone: login, dump,
 * destroy client, exit. It does not touch the long-running ingest service
 * or its DISCORD_SCREENSHOT_CHANNEL_ID env var — the channel id always
 * comes from the --channel CLI flag.
 *
 * Read-only against Discord: only ever fetches message history, never
 * reacts or sends. DISCORD_BOT_TOKEN is read from the environment (bun
 * auto-loads backend/.env) and is never logged or written to the output
 * file.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client, GatewayIntentBits, type Message, type TextBasedChannel } from "discord.js";

const FETCH_PAGE_SIZE = 100;
// backend/scripts/out/ — resolved from this file's own location rather than
// process.cwd() so the default output lands in the same place regardless of
// where `bun run dump-resources` is invoked from.
const DEFAULT_OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "out");

interface CliArgs {
  channel: string;
  out?: string;
}

function printUsage(): void {
  console.error("Usage: bun run dump-resources -- --channel <id> [--out <path>]");
}

function parseArgs(argv: string[]): CliArgs {
  let channel: string | undefined;
  let out: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--channel" || arg === "--out") {
      const value = argv[i + 1];
      if (!value) throw new Error(`Missing value for ${arg}`);
      if (arg === "--channel") channel = value;
      else out = value;
      i++;
      continue;
    }
    if (arg.startsWith("--channel=")) {
      channel = arg.slice("--channel=".length);
      continue;
    }
    if (arg.startsWith("--out=")) {
      out = arg.slice("--out=".length);
      continue;
    }
  }

  if (!channel) throw new Error("--channel <id> is required");
  return { channel, out };
}

function sanitizeForFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-");
}

/** ISO date (YYYY-MM-DD), used in both the default filename and the H1. */
function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Fetches the full channel history, oldest message first. Paginates with
 * `before` in batches of FETCH_PAGE_SIZE, awaiting each page sequentially
 * (discord.js queues/rate-limits REST calls itself — no Promise.all over
 * pages).
 */
async function fetchFullHistory(channel: TextBasedChannel): Promise<Message[]> {
  const newestFirst: Message[] = [];
  let before: string | undefined;

  for (;;) {
    const batch = await channel.messages.fetch({ limit: FETCH_PAGE_SIZE, before });
    if (batch.size === 0) break;

    const batchArray = [...batch.values()]; // newest -> oldest within this page
    newestFirst.push(...batchArray);
    before = batchArray[batchArray.length - 1]?.id;

    if (batch.size < FETCH_PAGE_SIZE) break; // reached the beginning of the channel
  }

  return newestFirst.reverse(); // oldest -> newest
}

/** True for system messages (pins, joins, etc.) with no user content. */
function isEmptySystemMessage(message: Message): boolean {
  return message.system && !message.content && message.attachments.size === 0 && message.embeds.length === 0;
}

function embedUrl(embed: Message["embeds"][number]): string | undefined {
  return embed.url ?? embed.image?.url ?? embed.thumbnail?.url ?? undefined;
}

function renderMarkdown(channelName: string, messages: Message[]): string {
  const lines: string[] = [];
  lines.push(`# #${channelName} — dumped ${isoDate(new Date())}`, "");

  for (const message of messages) {
    if (isEmptySystemMessage(message)) continue;

    lines.push(`## ${message.author.tag} — ${message.createdAt.toISOString()}`, "");
    lines.push(message.content.length > 0 ? message.content : "*(no text content)*", "");

    const links: string[] = [];
    for (const attachment of message.attachments.values()) {
      links.push(`- ${attachment.url}`);
    }
    for (const embed of message.embeds) {
      const url = embedUrl(embed);
      if (url) links.push(`- ${url}`);
    }
    if (links.length > 0) {
      lines.push(...links, "");
    }

    lines.push("---", "");
  }

  return lines.join("\n");
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    throw new Error("DISCORD_BOT_TOKEN is not set (expected in backend/.env)");
  }

  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  });

  try {
    await client.login(token);

    const channel = await client.channels.fetch(args.channel);
    if (!channel || !channel.isTextBased() || channel.isDMBased()) {
      throw new Error(`Channel ${args.channel} is not a readable guild text channel`);
    }

    const channelName = channel.name ?? args.channel;
    console.log(`[dumpChannelToMarkdown] Fetching full history of #${channelName} (${args.channel})...`);

    const messages = await fetchFullHistory(channel);
    const markdown = renderMarkdown(channelName, messages);

    const outPath =
      args.out ?? path.join(DEFAULT_OUT_DIR, `${sanitizeForFileName(channelName)}-${isoDate(new Date())}.md`);

    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, markdown, "utf-8");

    console.log(`[dumpChannelToMarkdown] Wrote ${messages.length} messages to ${outPath}`);
  } finally {
    client.destroy();
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("[dumpChannelToMarkdown] Failed:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
