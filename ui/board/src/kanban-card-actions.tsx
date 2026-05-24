import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@qaio-ai/core"
import { Trash2, Check, Pencil } from "lucide-react"

interface CardActionsProps {
  showApprove: boolean
  onApprove?: () => void
  onRename?: () => void
  onDelete?: () => void
  approveTooltip: string
  renameTooltip: string
  deleteTooltip: string
}

export function KanbanCardActions({
  showApprove,
  onApprove,
  onRename,
  onDelete,
  approveTooltip,
  renameTooltip,
  deleteTooltip,
}: CardActionsProps) {
  return (
    <div className="flex items-center gap-0.5 shrink-0">
      {showApprove && onApprove && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={(e) => { e.stopPropagation(); onApprove() }}
              className="p-1 rounded-md text-muted-foreground/40 hover:text-success hover:bg-success/10 transition-colors duration-200"
              aria-label={approveTooltip}
            >
              <Check className="size-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">{approveTooltip}</TooltipContent>
        </Tooltip>
      )}
      {onRename && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={(e) => { e.stopPropagation(); onRename() }}
              className="p-1 rounded-md text-muted-foreground/40 hover:text-foreground hover:bg-accent transition-colors duration-200"
              aria-label={renameTooltip}
            >
              <Pencil className="size-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">{renameTooltip}</TooltipContent>
        </Tooltip>
      )}
      {onDelete && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete() }}
              className="p-1 rounded-md text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors duration-200"
              aria-label={deleteTooltip}
            >
              <Trash2 className="size-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">{deleteTooltip}</TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}
