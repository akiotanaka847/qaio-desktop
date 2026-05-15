import { useState } from "react";
import { useTranslation } from "react-i18next";
import { QaioLogo } from "../shell/experience-card";
import { MeetMission } from "./missions/meet";
import { BrainMission } from "./missions/brain";

type Step = "name" | "provider";

interface SetupTutorialProps {
  onComplete: (opts: {
    name: string;
    color: string;
    provider: string;
    model: string;
  }) => Promise<void>;
}

export function SetupTutorial({ onComplete }: SetupTutorialProps) {
  const { t } = useTranslation(["setup", "providers"]);
  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState(() =>
    t("setup:tutorial.defaults.assistantName"),
  );
  const [color, setColor] = useState("navy");
  const [provider, setProvider] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);

  const stepIndex = step === "name" ? 0 : 1;

  return (
    <div className="h-screen overflow-y-auto bg-background text-foreground">
      <header className="sticky top-0 z-10 bg-background/95 px-5 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <QaioLogo size={24} />
            <span className="text-sm font-medium">{t("setup:tutorial.brand")}</span>
          </div>
          <div className="flex items-center gap-1.5" aria-hidden>
            {[0, 1].map((i) => (
              <span
                key={i}
                className={`size-2 rounded-full transition-colors ${
                  i < stepIndex
                    ? "bg-foreground/60"
                    : i === stepIndex
                      ? "bg-foreground"
                      : "bg-foreground/15"
                }`}
              />
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-72px)] max-w-3xl flex-col px-5 pb-12 pt-8">
        {step === "name" && (
          <>
            <header>
              <p className="text-xs text-muted-foreground">
                {t("setup:tutorial.eyebrow", { number: 1 })}
              </p>
              <h1 className="mt-2 text-[28px] font-normal leading-tight">
                {t("setup:tutorial.missions.meet.title")}
              </h1>
              <p className="mt-3 text-base text-muted-foreground">
                {t("setup:tutorial.missions.meet.body")}
              </p>
            </header>
            <section className="mt-8 flex flex-1 flex-col">
              <MeetMission
                name={name}
                color={color}
                namePlaceholder={t("setup:tutorial.defaults.assistantName")}
                beginLabel={t("common:actions.continue")}
                onNameChange={setName}
                onColorChange={setColor}
                onBegin={() => setStep("provider")}
              />
            </section>
          </>
        )}

        {step === "provider" && (
          <>
            <header>
              <p className="text-xs text-muted-foreground">
                {t("setup:tutorial.eyebrow", { number: 2 })}
              </p>
              <h1 className="mt-2 text-[28px] font-normal leading-tight">
                {t("setup:tutorial.missions.brain.title")}
              </h1>
              <p className="mt-3 text-base text-muted-foreground">
                {t("setup:tutorial.missions.brain.body")}
              </p>
            </header>
            <section className="mt-8 flex flex-1 flex-col">
              <BrainMission
                provider={provider}
                onSelect={(p, m) => {
                  setProvider(p);
                  setModel(m);
                }}
                onContinue={async () => {
                  if (!provider || !model) return;
                  await onComplete({
                    name: name.trim() || t("setup:tutorial.defaults.assistantName"),
                    color,
                    provider,
                    model,
                  });
                }}
              />
            </section>
          </>
        )}
      </main>
    </div>
  );
}
