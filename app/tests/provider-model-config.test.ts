import { ok, strictEqual } from "node:assert";
import { describe, it } from "node:test";
import {
  getEffortLevels,
  getProvider,
  PROVIDERS,
  type EffortLevel,
} from "../src/lib/providers.ts";

/**
 * The effort levels each provider accepts ENGINE-side, mirrored from
 * `Provider::effort_levels` in
 * `engine/qaio-terminal-manager/src/types.rs`.
 *
 * The frontend must never offer a level the engine rejects: the picker would
 * hand the engine a value `is_valid_effort` refuses, and the user's choice
 * would silently not apply. Keep this table in sync when the Rust enum
 * changes.
 */
const ENGINE_EFFORT_LEVELS: Record<string, readonly EffortLevel[]> = {
  anthropic: ["low", "medium", "high", "max"],
  openai: ["low", "medium", "high", "xhigh"],
  gemini: [],
  kimi: [],
};

describe("provider model config", () => {
  it("offers no effort level the engine would reject", () => {
    for (const provider of PROVIDERS) {
      const allowed = ENGINE_EFFORT_LEVELS[provider.id];
      ok(allowed, `provider "${provider.id}" missing from the engine table`);

      for (const model of provider.models) {
        for (const level of model.effortLevels ?? []) {
          ok(
            allowed.includes(level),
            `${provider.id}/${model.id} offers "${level}", but the engine only accepts [${allowed.join(", ")}]`,
          );
        }
      }
    }
  });

  it("gives every provider a default model that exists in its list", () => {
    for (const provider of PROVIDERS) {
      const ids = provider.models.map((m) => m.id);
      ok(
        ids.includes(provider.defaultModel),
        `${provider.id} defaults to "${provider.defaultModel}", which is not in [${ids.join(", ")}]`,
      );
    }
  });

  it("keeps model ids unique within a provider", () => {
    for (const provider of PROVIDERS) {
      const ids = provider.models.map((m) => m.id);
      strictEqual(
        new Set(ids).size,
        ids.length,
        `${provider.id} has duplicate model ids: [${ids.join(", ")}]`,
      );
    }
  });

  it("exposes the newest model families", () => {
    // Guards against the picker silently falling behind the CLIs we bundle.
    const anthropic = getProvider("anthropic");
    ok(anthropic, "anthropic provider missing");
    ok(
      anthropic.models.some((m) => m.id === "fable"),
      "Anthropic is missing the Fable family",
    );

    const openai = getProvider("openai");
    ok(openai, "openai provider missing");
    ok(
      openai.models.some((m) => m.id.startsWith("gpt-5.6")),
      "OpenAI is missing the GPT-5.6 family",
    );
  });

  it("reports no effort levels for providers without effort control", () => {
    for (const id of ["gemini", "kimi"]) {
      const provider = getProvider(id);
      ok(provider, `${id} provider missing`);
      for (const model of provider.models) {
        strictEqual(
          getEffortLevels(id, model.id).length,
          0,
          `${id}/${model.id} should expose no effort levels`,
        );
      }
    }
  });
});
