import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as kb from "../../data/knowledge-base";
import type { KnowledgeEntryUpdate, NewKnowledgeEntry } from "../../data/knowledge-base";
import { queryKeys } from "../../lib/query-keys";

export function useKnowledgeBase(agentPath: string | undefined) {
  return useQuery({
    queryKey: queryKeys.knowledgeBase(agentPath ?? ""),
    queryFn: () => kb.list(agentPath!),
    enabled: !!agentPath,
  });
}

export function useSearchKnowledgeBase(
  agentPath: string | undefined,
  query: string,
) {
  return useQuery({
    queryKey: [...queryKeys.knowledgeBase(agentPath ?? ""), "search", query],
    queryFn: () => kb.search(agentPath!, query),
    enabled: !!agentPath && query.length > 0,
  });
}

export function useCreateKnowledgeEntry(agentPath: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewKnowledgeEntry) => kb.create(agentPath!, input),
    onSuccess: () => {
      if (agentPath)
        qc.invalidateQueries({ queryKey: queryKeys.knowledgeBase(agentPath) });
    },
  });
}

export function useUpdateKnowledgeEntry(agentPath: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: KnowledgeEntryUpdate }) =>
      kb.update(agentPath!, id, updates),
    onSuccess: () => {
      if (agentPath)
        qc.invalidateQueries({ queryKey: queryKeys.knowledgeBase(agentPath) });
    },
  });
}

export function useDeleteKnowledgeEntry(agentPath: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => kb.remove(agentPath!, id),
    onSuccess: () => {
      if (agentPath)
        qc.invalidateQueries({ queryKey: queryKeys.knowledgeBase(agentPath) });
    },
  });
}
