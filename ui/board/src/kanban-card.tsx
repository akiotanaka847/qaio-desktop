import { useState, useRef, useEffect } from "react"
import {
  cn,
  ConfirmDialog,
} from "@qaio-ai/core"
import type { KanbanItem } from "./types"
import { DEFAULT_CARD_LABELS, type KanbanCardLabels } from "./kanban-card-labels"
import { KanbanCardActions } from "./kanban-card-actions"
export type { KanbanCardLabels } from "./kanban-card-labels"

export interface KanbanCardProps {
  item: KanbanItem
  onSelect: () => void
  onDelete?: () => void
  onApprove?: () => void
  onRename?: (newTitle: string) => void
  runningStatuses?: string[]
  approveStatuses?: string[]
  actions?: React.ReactNode
  avatar?: React.ReactNode
  labels?: KanbanCardLabels
}

export function KanbanCard({
  item,
  onSelect,
  onDelete,
  onApprove,
  onRename,
  runningStatuses = ["running"],
  approveStatuses = ["needs_you"],
  actions,
  avatar,
  labels,
}: KanbanCardProps) {
  const l = { ...DEFAULT_CARD_LABELS, ...labels }
  const isRunning = runningStatuses.includes(item.status)
  const isNeedsApproval = approveStatuses.includes(item.status)
  const [showConfirm, setShowConfirm] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(item.title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const handleDeleteClick = () => {
    setShowConfirm(true)
  }

  const confirmDelete = () => {
    onDelete?.()
    setShowConfirm(false)
  }

  const handleRenameClick = () => {
    setEditValue(item.title)
    setEditing(true)
  }

  const commitRename = () => {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== item.title) {
      onRename?.(trimmed)
    }
    setEditing(false)
  }

  return (
    <>
      <div
        onClick={(e) => { e.stopPropagation(); onSelect() }}
        className={cn(
          "group/card relative rounded-xl bg-card p-3 cursor-pointer transition-all duration-200",
          isRunning
            ? "card-running-glow shadow-[0_2px_16px_rgba(76,175,125,0.15)]"
            : "border border-border/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(27,42,74,0.08)] hover:border-border",
          isNeedsApproval && "approval-gate",
        )}
      >
        {/* Running indicator */}
        {isRunning && (
          <div className="flex items-center gap-1 mb-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            <span className="text-[10px] font-medium text-accent">
              {l.agentWorking}
            </span>
          </div>
        )}

        {/* Top row: agent info + action buttons */}
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            {!isRunning && (avatar ?? (
              item.icon && (
                <span className="size-3.5 shrink-0 flex items-center justify-center">
                  {item.icon}
                </span>
              )
            ))}
            {item.group && (
              <span className="text-[11px] text-muted-foreground truncate">
                {item.group}
              </span>
            )}
          </div>
          <KanbanCardActions
            showApprove={!actions && isNeedsApproval}
            onApprove={onApprove}
            onRename={onRename ? handleRenameClick : undefined}
            onDelete={onDelete ? handleDeleteClick : undefined}
            approveTooltip={l.approveTooltip}
            renameTooltip={l.renameTooltip}
            deleteTooltip={l.deleteTooltip}
          />
        </div>

        {/* Title */}
        {editing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename()
              if (e.key === "Escape") setEditing(false)
            }}
            onClick={(e) => e.stopPropagation()}
            className="text-[13px] font-medium text-foreground bg-transparent border-b border-foreground/20 outline-none w-full"
          />
        ) : (
          <p className="text-[13px] font-medium text-foreground line-clamp-2">
            {item.title}
          </p>
        )}

        {/* Description */}
        {item.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
            {item.description}
          </p>
        )}

        {/* Running progress bar */}
        {isRunning && (
          <div className="mt-2 h-1 rounded-full bg-accent/15 overflow-hidden">
            <div className="h-full bg-accent rounded-full animate-progress-indeterminate" />
          </div>
        )}

        {/* Footer: tags + avatar + custom actions */}
        {(item.tags?.length || actions || avatar) && (
          <div className="flex items-center justify-between mt-2.5">
            <div className="flex items-center gap-1 flex-wrap min-w-0">
              {item.tags?.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex h-[18px] items-center rounded-full bg-accent/10 px-2 text-[10px] font-semibold text-accent-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {actions}
              {avatar}
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        title={l.deleteTitle(item.title)}
        description={l.deleteDescription}
        onConfirm={confirmDelete}
      />
    </>
  )
}
