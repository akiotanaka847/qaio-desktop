import { QaioAvatar, resolveAgentColor } from "@qaio-ai/core";

export function AgentCardAvatar({ color }: { color?: string }) {
  return <QaioAvatar color={resolveAgentColor(color)} diameter={16} />;
}
