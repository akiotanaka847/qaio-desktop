export const RUNNING_STATUSES = new Set([
  "running", "planning", "implementing", "testing",
  "review_plan", "review_impl", "requirements",
]);

export const APPROVAL_STATUSES = new Set([
  "needs_you", "needs_plan_approval", "needs_impl_approval",
]);

export const DONE_STATUSES = new Set(["done", "cancelled"]);

export const STATUS_KEYS = [
  "requirements",
  "planning",
  "review_plan",
  "implementing",
  "review_impl",
  "testing",
  "done",
  "cancelled",
  "running",
  "needs_you",
  "needs_plan_approval",
  "needs_impl_approval",
] as const;

export type StatusKey = (typeof STATUS_KEYS)[number];

export interface AgentStats {
  name: string;
  color: string;
  total: number;
  done: number;
  running: number;
  needsApproval: number;
}
