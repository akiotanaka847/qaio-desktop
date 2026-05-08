import { QaioAvatar, resolveAgentColor } from "@qaio-ai/core";

export function AgentPanelAvatar({
  color,
  running,
}: {
  color?: string;
  running: boolean;
}) {
  return (
    <QaioAvatar
      color={resolveAgentColor(color)}
      diameter={40}
      running={running}
    />
  );
}
