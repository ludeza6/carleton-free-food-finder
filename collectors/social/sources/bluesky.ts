import type { CollectedEvent, EventSource } from "../../types";
import type { SocialPost } from "../types";
import { extractSocialEvent } from "../extract-event";
import { socialAccounts } from "../accounts";

const WEEK = 7 * 86_400_000;
function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
}

export function normalizeBlueskyFeed(data: unknown, now: Date): SocialPost[] {
  const feed = record(data).feed;
  if (!Array.isArray(feed)) throw new Error("Invalid Bluesky feed response");
  return feed.flatMap((item) => {
    const entry = record(item);
    if (entry.reason || entry.reply) return []; // Neither reposts nor replies are announcements.
    const post = record(entry.post);
    const content = record(post.record);
    const author = record(post.author);
    if (typeof content.text !== "string" || typeof content.createdAt !== "string" || typeof author.handle !== "string") return [];
    const posted = Date.parse(content.createdAt);
    const uri = typeof post.uri === "string" ? /^at:\/\/(did:[a-z0-9:._%-]+)\/app\.bsky\.feed\.post\/([a-zA-Z0-9._~-]+)$/.exec(post.uri) : null;
    if (!uri || !Number.isFinite(posted) || posted < +now - WEEK || posted > +now) return [];
    return [{ text: content.text, postedAt: content.createdAt,
      sourceName: `Bluesky @${author.handle}`,
      sourceUrl: `https://bsky.app/profile/${uri[1]}/post/${uri[2]}` }];
  });
}

type Options = { fetch?: typeof fetch; sleep?: (ms: number) => Promise<void>; now?: () => Date };
export function createBlueskySources(accounts: readonly string[] = socialAccounts.bluesky, options: Options = {}): EventSource[] {
  return accounts.map((account) => ({
    name: `Bluesky @${account}`,
    async collect(): Promise<CollectedEvent[]> {
      const now = (options.now ?? (() => new Date()))();
      const events: CollectedEvent[] = [];
      let cursor: string | undefined;
      // Bound requests even for very active accounts. Inspect at most 500 posts.
      for (let page = 0; page < 5; page++) {
        const url = new URL("https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed");
        url.searchParams.set("actor", account);
        url.searchParams.set("limit", "100");
        url.searchParams.set("filter", "posts_no_replies");
        url.searchParams.set("includePins", "false");
        if (cursor) url.searchParams.set("cursor", cursor);
        let data: unknown;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const response = await (options.fetch ?? globalThis.fetch)(url, {
              signal: AbortSignal.timeout(15_000),
              headers: { "User-Agent": "CF3-Carleton-Free-Food-Finder/1.0", Accept: "application/json" },
            });
            if (!response.ok) throw new Error(`Bluesky HTTP ${response.status}`);
            data = await response.json();
            if (!Array.isArray(record(data).feed)) throw new Error("Invalid Bluesky feed response");
            break;
          } catch (error) {
            if (attempt === 2) throw error;
            await (options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))))(1000 * 2 ** attempt);
          }
        }
        for (const post of normalizeBlueskyFeed(data, now)) {
          const result = extractSocialEvent(post, now);
          if (result.event) events.push(result.event);
          else console.info(`[social] Skipped ${post.sourceUrl}: ${result.reason}`);
        }
        const next = record(data).cursor;
        if (typeof next !== "string" || !next || next === cursor) break;
        cursor = next;
      }
      return events;
    },
  }));
}
