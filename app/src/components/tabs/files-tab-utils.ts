import type { FileEntry } from "../../lib/types";

// --- File type categories for filter pills ---

export type FileCategory = "all" | "documents" | "sheets" | "pdf";

const DOC_EXT = new Set([
  "doc", "docx", "txt", "md", "rtf", "odt", "pages",
  "ppt", "pptx", "key", "odp",
]);
const SHEET_EXT = new Set(["xls", "xlsx", "csv", "numbers", "ods"]);

export function fileCategory(ext: string): FileCategory {
  const e = ext.toLowerCase();
  if (e === "pdf") return "pdf";
  if (SHEET_EXT.has(e)) return "sheets";
  if (DOC_EXT.has(e)) return "documents";
  return "all"; // uncategorized files only match "all"
}

export function matchesCategory(file: FileEntry, cat: FileCategory): boolean {
  if (cat === "all") return true;
  return fileCategory(file.extension) === cat;
}

export function matchesSearch(file: FileEntry, query: string): boolean {
  if (!query) return true;
  return file.name.toLowerCase().includes(query.toLowerCase());
}

// --- Human-friendly type label ---

const TYPE_MAP: Record<string, string> = {
  doc: "Word", docx: "Word", rtf: "Word", odt: "Word",
  ppt: "PowerPoint", pptx: "PowerPoint", key: "Keynote", odp: "Slides",
  xls: "Excel", xlsx: "Excel", csv: "CSV", numbers: "Numbers", ods: "Sheets",
  pdf: "PDF",
  txt: "Text", md: "Markdown", pages: "Pages",
  png: "Image", jpg: "Image", jpeg: "Image", gif: "Image", svg: "SVG", webp: "Image",
  zip: "Archive", gz: "Archive", tar: "Archive", rar: "Archive",
  js: "JavaScript", ts: "TypeScript", py: "Python", rs: "Rust",
};

export function fileTypeLabel(ext: string): string {
  return TYPE_MAP[ext.toLowerCase()] ?? ext.toUpperCase();
}

// --- Size formatting ---

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// --- Relative date formatting ---

export function relativeDate(
  timestamp: number | undefined,
  now: Date,
  labels: { justNow: string; minutesAgo: string; hoursAgo: string; yesterday: string },
): string {
  if (!timestamp) return "";
  const diff = now.getTime() - timestamp;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return labels.justNow;
  if (mins < 60) return labels.minutesAgo.replace("{{count}}", String(mins));
  const hours = Math.floor(mins / 60);
  if (hours < 24) return labels.hoursAgo.replace("{{count}}", String(hours));
  if (hours < 48) return labels.yesterday;
  return new Date(timestamp).toLocaleDateString([], { day: "numeric", month: "short" });
}
