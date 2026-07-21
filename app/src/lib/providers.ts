export type EffortLevel = "low" | "medium" | "high" | "xhigh" | "max";

export const DEFAULT_EFFORT: EffortLevel = "medium";

export interface ModelOption {
  id: string;
  label: string;
  description: string;
  /** Accepted effort levels for this model. Empty/undefined = no effort control. */
  effortLevels?: readonly EffortLevel[];
}

export interface ProviderInfo {
  id: string;
  name: string;
  subtitle: string;
  cliName: string;
  installUrl: string;
  loginCommand: string;
  cost: string;
  models: readonly ModelOption[];
  defaultModel: string;
}

export const PROVIDERS: readonly ProviderInfo[] = [
  {
    id: "openai",
    name: "OpenAI",
    subtitle: "Codex",
    cliName: "codex",
    installUrl: "https://github.com/openai/codex",
    loginCommand: "codex login",
    cost: "Your ChatGPT subscription",
    models: [
      { id: "gpt-5.6-sol", label: "GPT-5.6 Sol", description: "Newest frontier model. Deepest reasoning.", effortLevels: ["low", "medium", "high", "xhigh"] },
      { id: "gpt-5.6-terra", label: "GPT-5.6 Terra", description: "Balanced mid-tier of the newest family.", effortLevels: ["low", "medium", "high", "xhigh"] },
      { id: "gpt-5.6-luna", label: "GPT-5.6 Luna", description: "Fast and cost-efficient for simpler tasks.", effortLevels: ["low", "medium", "high", "xhigh"] },
      { id: "gpt-5.4", label: "GPT-5.4", description: "Flagship. Best reasoning and tool use.", effortLevels: ["low", "medium", "high", "xhigh"] },
      { id: "gpt-5.4-mini", label: "GPT-5.4 Mini", description: "Faster and cheaper for lighter tasks.", effortLevels: ["low", "medium", "high", "xhigh"] },
      { id: "gpt-5.3-codex", label: "Codex", description: "Purpose-built for coding agents.", effortLevels: ["low", "medium", "high", "xhigh"] },
      { id: "gpt-5.3-codex-spark", label: "Codex Spark", description: "Ultra-fast coding model.", effortLevels: ["low", "medium", "high", "xhigh"] },
    ],
    defaultModel: "gpt-5.4",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    subtitle: "Claude Code",
    cliName: "claude",
    installUrl: "https://docs.anthropic.com/en/docs/claude-code/overview",
    loginCommand: "claude login",
    cost: "Your Claude subscription",
    models: [
      // Aliases (not pinned ids) so each entry tracks the newest model in its
      // family as the bundled Claude Code CLI updates. `claude --model` accepts
      // both; the alias keeps existing agent configs valid across releases.
      { id: "fable", label: "Fable", description: "Most capable. Best for hard, multi-step work. Uses more credits.", effortLevels: ["low", "medium", "high", "max"] },
      { id: "sonnet", label: "Sonnet", description: "Best balance of speed and quality.", effortLevels: ["low", "medium", "high", "max"] },
      // No `xhigh` here: the engine's Anthropic effort set is
      // low/medium/high/max, so offering xhigh produced a value the engine
      // rejects. `max` is the top tier for Claude.
      { id: "opus", label: "Opus", description: "Most capable. Slower, more tokens.", effortLevels: ["low", "medium", "high", "max"] },
      { id: "haiku", label: "Haiku", description: "Fastest and cheapest for simple tasks.", effortLevels: ["low", "medium", "high", "max"] },
    ],
    defaultModel: "sonnet",
  },
  {
    id: "gemini",
    name: "Google",
    subtitle: "Antigravity CLI",
    cliName: "agy",
    installUrl: "https://github.com/google-antigravity/antigravity-cli",
    loginCommand: "agy",
    cost: "Your Google subscription",
    models: [
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", description: "Most capable. Deep reasoning and complex tasks." },
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", description: "Fast and efficient with built-in thinking." },
      { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash", description: "Latest generation. Fast with medium reasoning." },
    ],
    defaultModel: "gemini-3.5-flash",
  },
  {
    id: "kimi",
    name: "Moonshot",
    subtitle: "Kimi Code",
    cliName: "kimi",
    installUrl: "https://github.com/MoonshotAI/kimi-cli",
    loginCommand: "kimi",
    cost: "Moonshot API credits",
    models: [
      { id: "moonshot-v1-auto", label: "Moonshot V1 Auto", description: "Auto-selects the best model for the task." },
    ],
    defaultModel: "moonshot-v1-auto",
  },
] as const;

/** Find a provider by id. */
export function getProvider(id: string): ProviderInfo | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

/** Find the model object for a provider + model id. */
export function getModel(providerId: string, modelId: string): ModelOption | undefined {
  return getProvider(providerId)?.models.find((m) => m.id === modelId);
}

/** Get the default provider + model for a provider id. */
export function getDefaultModel(providerId: string): string {
  return getProvider(providerId)?.defaultModel ?? "sonnet";
}

/** Get the accepted effort levels for a specific model. Empty = no effort control. */
export function getEffortLevels(providerId: string, modelId: string): readonly EffortLevel[] {
  return getModel(providerId, modelId)?.effortLevels ?? [];
}

/**
 * Validate an effort value against a model's accepted levels.
 * Returns the effort if valid, otherwise the default, or `null` if
 * the model doesn't support effort at all.
 */
export function validEffortOrDefault(
  providerId: string,
  modelId: string,
  effort: string | null | undefined,
): EffortLevel | null {
  const levels = getEffortLevels(providerId, modelId);
  if (levels.length === 0) return null;
  if (effort && levels.includes(effort as EffortLevel)) return effort as EffortLevel;
  return DEFAULT_EFFORT;
}

