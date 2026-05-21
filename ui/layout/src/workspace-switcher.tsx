import { Plus, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@qaio-ai/core";

export interface WorkspaceSwitcherLabels {
  createWorkspace?: string;
}

export interface WorkspaceSwitcherProps {
  workspaces: { id: string; name: string }[];
  currentId: string | null;
  currentName: string;
  onSwitch: (workspaceId: string) => void;
  onCreate: () => void;
  labels?: WorkspaceSwitcherLabels;
}

const DEFAULT_LABELS: Required<WorkspaceSwitcherLabels> = {
  createWorkspace: "Create workspace",
};

export function WorkspaceSwitcher({
  workspaces,
  currentId,
  currentName,
  onSwitch,
  onCreate,
  labels,
}: WorkspaceSwitcherProps) {
  const l = { ...DEFAULT_LABELS, ...labels };
  return (
    <div
      className="flex items-center gap-1 px-2 pt-3 pb-1"
      data-tauri-drag-region
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-1 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent rounded-lg py-1.5 px-2.5 transition-colors flex-1 min-w-0">
            <span className="truncate">{currentName}</span>
            <ChevronDown className="h-3.5 w-3.5 text-sidebar-foreground/50 flex-shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          {workspaces.map((ws) => (
            <DropdownMenuItem
              key={ws.id}
              onClick={() => onSwitch(ws.id)}
              className={ws.id === currentId ? "font-medium" : ""}
            >
              {ws.name}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onCreate}>
            <Plus className="h-4 w-4 mr-2" />
            {l.createWorkspace}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
