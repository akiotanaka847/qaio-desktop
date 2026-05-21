export interface ModelOption {
  id: string;
  label: string;
  description: string;
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
      { id: "gpt-5.4", label: "GPT-5.4", description: "Flagship. Best reasoning and tool use." },
      { id: "gpt-5.4-mini", label: "GPT-5.4 Mini", description: "Faster and cheaper for lighter tasks." },
      { id: "gpt-5.3-codex", label: "Codex", description: "Purpose-built for coding agents." },
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
      { id: "sonnet", label: "Sonnet", description: "Best balance of speed and quality." },
      { id: "opus", label: "Opus", description: "Most capable. Slower, more tokens." },
      { id: "haiku", label: "Haiku", description: "Fastest and cheapest for simple tasks." },
    ],
    defaultModel: "sonnet",
  },
  {
    id: "gemini",
    name: "Google",
    subtitle: "Gemini CLI",
    cliName: "gemini",
    installUrl: "https://github.com/google-gemini/gemini-cli",
    loginCommand: "gemini",
    cost: "Free tier or API key",
    models: [
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", description: "Most capable. Deep reasoning and complex tasks." },
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", description: "Fast and efficient with built-in thinking." },
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", description: "Lightweight. Fastest responses." },
    ],
    defaultModel: "gemini-2.5-flash",
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

