import { useState, useCallback, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button, cn } from "@qaio-ai/core";
import { ArrowLeft, Sparkles, Loader2 } from "lucide-react";
import { getEngine } from "../../lib/engine";
import { useWorkspaceStore } from "../../stores/workspaces";

interface AiWizardStepProps {
  onBack: () => void;
  onGenerated: (name: string, claudeMd: string) => void;
}

export function AiWizardStep({ onBack, onGenerated }: AiWizardStepProps) {
  const { t } = useTranslation("shell");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsProvider = useWorkspaceStore((s) => s.current?.provider ?? "anthropic");

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const trimmed = description.trim();
      if (!trimmed) return;

      setLoading(true);
      setError(null);
      try {
        const result = await getEngine().generateAgentConfig({
          description: trimmed,
          provider: wsProvider,
        });
        onGenerated(result.name, result.claudeMd);
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    },
    [description, wsProvider, onGenerated],
  );

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6 py-16">
      <button
        onClick={onBack}
        className="absolute top-5 left-5 rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>

      <div className="flex flex-col items-center gap-3 mb-8">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <Sparkles className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-lg font-semibold">
          {t("aiWizard.title")}
        </h2>
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          {t("aiWizard.subtitle")}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
        <textarea
          autoFocus
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("aiWizard.placeholder")}
          rows={4}
          className={cn(
            "w-full resize-none rounded-xl border border-border bg-secondary px-4 py-3",
            "text-sm placeholder:text-muted-foreground",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:bg-background",
            "transition-colors",
          )}
        />

        {error && (
          <p className="text-xs text-destructive text-center">{error}</p>
        )}

        <Button
          type="submit"
          disabled={!description.trim() || loading}
          className="w-full rounded-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("aiWizard.generating")}
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              {t("aiWizard.generate")}
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
