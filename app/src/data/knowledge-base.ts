/** `.qaio/knowledge_base/knowledge_base.json` — institutional knowledge entries. */

import schema from "@qaio-ai/agent-schemas/knowledge_base.schema.json";
import { newId, now, readAgentJson, writeAgentJson } from "./agent-file";

export interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  source: string;
  tags: string[];
  client?: string;
  project?: string;
  author?: string;
  created_at: string;
  updated_at: string;
}

export interface NewKnowledgeEntry {
  title: string;
  content: string;
  source?: string;
  tags?: string[];
  client?: string;
  project?: string;
  author?: string;
}

export interface KnowledgeEntryUpdate {
  title?: string;
  content?: string;
  source?: string;
  tags?: string[];
  client?: string | null;
  project?: string | null;
  author?: string | null;
}

const NAME = "knowledge_base";
const s = schema as unknown as Parameters<typeof readAgentJson>[2];

export async function list(agentPath: string): Promise<KnowledgeEntry[]> {
  return readAgentJson<KnowledgeEntry[]>(agentPath, NAME, s, []);
}

export async function search(
  agentPath: string,
  query: string,
): Promise<KnowledgeEntry[]> {
  const all = await list(agentPath);
  if (!query) return all;
  const q = query.toLowerCase();
  return all.filter(
    (e) =>
      e.title.toLowerCase().includes(q) ||
      e.content.toLowerCase().includes(q) ||
      e.tags.some((t) => t.toLowerCase().includes(q)) ||
      (e.client ?? "").toLowerCase().includes(q) ||
      (e.project ?? "").toLowerCase().includes(q),
  );
}

export async function create(
  agentPath: string,
  input: NewKnowledgeEntry,
): Promise<KnowledgeEntry> {
  const items = await list(agentPath);
  const ts = now();
  const entry: KnowledgeEntry = {
    id: newId(),
    title: input.title,
    content: input.content,
    source: input.source ?? "manual",
    tags: input.tags ?? [],
    client: input.client,
    project: input.project,
    author: input.author,
    created_at: ts,
    updated_at: ts,
  };
  await writeAgentJson(agentPath, NAME, s, [...items, entry]);
  return entry;
}

export async function update(
  agentPath: string,
  id: string,
  patch: KnowledgeEntryUpdate,
): Promise<KnowledgeEntry> {
  const items = await list(agentPath);
  const idx = items.findIndex((e) => e.id === id);
  if (idx === -1) throw new Error(`Knowledge entry not found: ${id}`);
  const merged: KnowledgeEntry = {
    ...items[idx],
    ...patch,
    client: patch.client === null ? undefined : (patch.client ?? items[idx].client),
    project: patch.project === null ? undefined : (patch.project ?? items[idx].project),
    author: patch.author === null ? undefined : (patch.author ?? items[idx].author),
    updated_at: now(),
  };
  const next = [...items];
  next[idx] = merged;
  await writeAgentJson(agentPath, NAME, s, next);
  return merged;
}

export async function remove(agentPath: string, id: string): Promise<void> {
  const items = await list(agentPath);
  const next = items.filter((e) => e.id !== id);
  if (next.length === items.length)
    throw new Error(`Knowledge entry not found: ${id}`);
  await writeAgentJson(agentPath, NAME, s, next);
}
