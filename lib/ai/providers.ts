import "server-only";
import { getProviderConfig } from "@/lib/credentials/server";

// AI model providers, read from SIG Credentials (dashboard value → Coolify env var).
// OpenAI powers today's features; Claude, Grok and OpenRouter are ready for new ones.

export type AIProviderId = "openai" | "anthropic" | "xai" | "openrouter";

export type AIProviderConfig = {
  id: AIProviderId;
  apiKey: string | undefined;
  /** No trailing slash, e.g. https://api.openai.com/v1 */
  baseUrl: string;
  /** Chat / default model. Empty string when none is configured and there is no default. */
  model: string;
  /** OpenAI transcription model. */
  transcribeModel?: string;
  /** xAI realtime voice. */
  voiceModel?: string;
  voice?: string;
};

const usable = (v: string | undefined) => (v && !v.includes("your_") ? v.trim() : "");
const trimSlash = (s: string) => s.replace(/\/+$/, "");

export async function getAIProvider(id: AIProviderId): Promise<AIProviderConfig> {
  const cfg = await getProviderConfig(id);
  switch (id) {
    case "openai":
      return {
        id,
        apiKey: usable(cfg.api_key) || undefined,
        baseUrl: trimSlash(cfg.base_url || "https://api.openai.com/v1"),
        model: usable(cfg.chat_model) || "gpt-4o",
        transcribeModel: usable(cfg.transcribe_model) || "whisper-1",
      };
    case "anthropic":
      return { id, apiKey: usable(cfg.api_key) || undefined, baseUrl: "https://api.anthropic.com/v1", model: usable(cfg.model) };
    case "xai":
      return {
        id,
        apiKey: usable(cfg.api_key) || undefined,
        baseUrl: "https://api.x.ai/v1",
        model: usable(cfg.chat_model),
        voiceModel: usable(cfg.voice_model) || undefined,
        voice: usable(cfg.voice) || undefined,
      };
    case "openrouter":
      return { id, apiKey: usable(cfg.api_key) || undefined, baseUrl: trimSlash(cfg.base_url || "https://openrouter.ai/api/v1"), model: usable(cfg.model) };
  }
}
