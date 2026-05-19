import { useCallback, useRef } from "react";
import type { ClipboardEvent } from "react";
import type { AttachmentRejection, PrepareAttachments } from "./chat-panel-types";
import { mergeUniqueFiles } from "./use-file-drop-zone";

export interface UseChatFilesOptions {
  files: File[];
  setFiles: (files: File[]) => void;
  onNotice?: (message: string) => void;
  prepareAttachments?: PrepareAttachments;
  onAttachmentRejections?: (rejections: AttachmentRejection[]) => void;
}

export function useChatFiles({
  files,
  setFiles,
  onNotice,
  prepareAttachments,
  onAttachmentRejections,
}: UseChatFilesOptions) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    (incoming: File[]) => {
      const prepared = prepareAttachments
        ? prepareAttachments(incoming, files)
        : { accepted: incoming, rejected: [] };
      if (prepared.rejected.length > 0) {
        onAttachmentRejections?.(prepared.rejected);
      }
      const merged = mergeUniqueFiles(files, prepared.accepted);
      if (merged.length < files.length + prepared.accepted.length) {
        onNotice?.("File already in chat");
      }
      setFiles(merged);
    },
    [files, setFiles, onNotice, prepareAttachments, onAttachmentRejections],
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const pasted: File[] = [];
      for (const item of items) {
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) pasted.push(file);
        }
      }
      if (pasted.length > 0) {
        e.preventDefault();
        addFiles(pasted);
      }
    },
    [addFiles],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || e.target.files.length === 0) return;
      addFiles(Array.from(e.target.files));
      e.target.value = "";
    },
    [addFiles],
  );

  const openFilePicker = useCallback(() => {
    const input = fileInputRef.current;
    if (!input) return;
    // Reset BEFORE click so the same file can be re-picked and so WKWebView
    // doesn't hold onto stale state between invocations.
    input.value = "";
    input.click();
  }, []);

  const removeFile = useCallback(
    (index: number) => setFiles(files.filter((_, i) => i !== index)),
    [files, setFiles],
  );

  return {
    fileInputRef,
    addFiles,
    handlePaste,
    handleFileChange,
    openFilePicker,
    removeFile,
  };
}
