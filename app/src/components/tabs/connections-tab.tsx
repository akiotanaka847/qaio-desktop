import { IntegrationsView } from "./integrations-view";
import type { TabProps } from "../../lib/types";

/**
 * Per-agent Connections tab. Delegates to the shared `IntegrationsView`
 * so this surface stays identical to the Integrations tab — single
 * source of truth, no drift.
 */
export default function ConnectionsTab(_props: TabProps) {
  return <IntegrationsView />;
}
