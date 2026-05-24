import { useActivity } from "../../hooks/queries/use-activity";
import { ActivityTimeline } from "./activity-timeline";
import type { TabProps } from "../../lib/types";

export default function EventsTab({ agent }: TabProps) {
  const { data: items = [] } = useActivity(agent.folderPath);

  return (
    <ActivityTimeline items={items} agentName={agent.name} />
  );
}
