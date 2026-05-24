import { cn } from "@qaio-ai/core";

interface ProfileHeaderProps {
  name: string;
  description: string;
  color?: string;
  initials: string;
}

export function ProfileHeader({ name, description, color, initials }: ProfileHeaderProps) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-6">
      <div className="flex items-center gap-4">
        <div
          className={cn(
            "size-14 rounded-full flex items-center justify-center text-lg font-bold text-white shrink-0",
          )}
          style={{ backgroundColor: color ?? "var(--color-accent)" }}
        >
          {initials}
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-foreground">{name}</h2>
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      </div>
    </div>
  );
}
