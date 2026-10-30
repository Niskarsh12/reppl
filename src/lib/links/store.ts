import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export interface Click {
  at: string;
  /** Referring host only; no IPs or user agents are stored. */
  ref?: string;
}

export interface LinkRecord {
  code: string;
  campaignId: string;
  opportunityId: string;
  label: string;
  destination: string;
  createdAt: string;
  clicks: Click[];
}

export type NewLink = Omit<LinkRecord, "code" | "createdAt" | "clicks">;

/** Storage for tracked links. Swap the file store for a database by implementing this. */
export interface LinkStore {
  create(links: NewLink[]): Promise<LinkRecord[]>;
  get(code: string): Promise<LinkRecord | null>;
  recordClick(code: string, click: Click): Promise<LinkRecord | null>;
  list(campaignId: string): Promise<LinkRecord[]>;
}

const MAX_CLICKS_PER_LINK = 10_000;
const ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function newCode() {
  const bytes = randomBytes(7);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

class FileLinkStore implements LinkStore {
  private data: Record<string, LinkRecord> | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private file = process.env.LINK_STORE_PATH ?? path.join(process.cwd(), ".data", "links.json");

  /** Serialises reads and writes so concurrent clicks never drop each other's updates. */
  private run<T>(task: () => Promise<T>): Promise<T> {
    const next = this.queue.then(task, task);
    this.queue = next.catch(() => {});
    return next;
  }

  private async load() {
    if (this.data) return this.data;
    try {
      this.data = JSON.parse(await readFile(this.file, "utf8")) as Record<string, LinkRecord>;
    } catch {
      this.data = {};
    }
    return this.data;
  }

  private async save() {
    const body = JSON.stringify(this.data);
    try {
      await mkdir(path.dirname(this.file), { recursive: true });
      await writeFile(`${this.file}.tmp`, body);
      await rename(`${this.file}.tmp`, this.file);
    } catch {
      // Read-only filesystems (some hosts) fall back to the OS temp directory.
      this.file = path.join(tmpdir(), "reppl-links.json");
      await writeFile(this.file, body);
    }
  }

  create(links: NewLink[]) {
    return this.run(async () => {
      const data = await this.load();
      const records = links.map((link) => {
        const existing = Object.values(data).find(
          (r) => r.campaignId === link.campaignId && r.opportunityId === link.opportunityId && r.destination === link.destination,
        );
        if (existing) return existing;
        let code = newCode();
        while (data[code]) code = newCode();
        const record: LinkRecord = { ...link, code, createdAt: new Date().toISOString(), clicks: [] };
        data[code] = record;
        return record;
      });
      await this.save();
      return records;
    });
  }

  get(code: string) {
    return this.run(async () => (await this.load())[code] ?? null);
  }

  recordClick(code: string, click: Click) {
    return this.run(async () => {
      const record = (await this.load())[code];
      if (!record) return null;
      if (record.clicks.length < MAX_CLICKS_PER_LINK) record.clicks.push(click);
      await this.save();
      return record;
    });
  }

  list(campaignId: string) {
    return this.run(async () =>
      Object.values(await this.load())
        .filter((r) => r.campaignId === campaignId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    );
  }
}

const globalStore = globalThis as unknown as { __linkStore?: LinkStore };

export function getLinkStore(): LinkStore {
  globalStore.__linkStore ??= new FileLinkStore();
  return globalStore.__linkStore;
}
