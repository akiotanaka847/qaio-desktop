import { useTranslation } from "react-i18next";
import { useSkills, useRoutines, useActivity } from "../../hooks/queries";
import type { TabProps } from "../../lib/types";
import { ProfileHeader } from "./profile-tab-header";
import { ProfileSidebar } from "./profile-tab-sidebar";

function agentInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export default function ProfileTab({ agent, agentDef }: TabProps) {
  const { t } = useTranslation("profile");
  const path = agent.folderPath;

  const { data: skills = [] } = useSkills(path);
  const { data: routines = [] } = useRoutines(path);
  const { data: activities = [] } = useActivity(path);

  const config = agentDef.config;
  const initials = agentInitials(agent.name);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-background">
      <div className="max-w-5xl mx-auto px-6 py-7">
        <div className="flex gap-6">
          {/* Main column */}
          <div className="flex-1 min-w-0 space-y-5">
            <ProfileHeader
              name={agent.name}
              description={config.description}
              color={agent.color ?? config.color}
              initials={initials}
            />

            {/* Job description */}
            {config.description && (
              <Section title={t("jobDescription")}>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {config.description}
                </p>
              </Section>
            )}

            {/* Active skills */}
            {skills.length > 0 && (
              <Section title={t("activeSkills")}>
                <div className="flex flex-wrap gap-2">
                  {skills.map((skill) => (
                    <span
                      key={skill.name}
                      className="inline-flex h-7 items-center rounded-full bg-accent/10 px-3 text-xs font-medium text-accent"
                    >
                      {skill.name}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {/* Configuration */}
            <Section title={t("configuration")}>
              <div className="divide-y divide-border/40">
                <ConfigRow label={t("config.model")} value={config.agents?.[0]?.name ?? "Claude"} />
                {config.integrations && config.integrations.length > 0 && (
                  <ConfigRow
                    label={t("config.integrations")}
                    value={config.integrations.join(", ")}
                  />
                )}
              </div>
            </Section>
          </div>

          {/* Sidebar */}
          <div className="w-72 shrink-0">
            <ProfileSidebar
              routines={routines}
              activityCount={activities.length}
              labels={{
                performance: t("sidebar.performance"),
                totalTasks: t("sidebar.totalTasks"),
                activeRoutines: t("sidebar.activeRoutines"),
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-3">{title}</h3>
      {children}
    </div>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}
