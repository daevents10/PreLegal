/** Client for the stateless /api/chat NDA assistant. */

import type { NdaData } from "@/lib/nda";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResult {
  reply: string;
  fields: NdaData;
}

/** Shown before the first request, and sent as history so the model knows what it already asked. */
export const GREETING: ChatMessage = {
  role: "assistant",
  content:
    "Hi! I'll help you draft a Mutual Non-Disclosure Agreement. To start, who are the two parties " +
    "(company names), and what's the purpose of sharing confidential information?",
};

export class ChatError extends Error {}

/** Send the conversation and current fields; resolves with the reply and the updated fields. */
export async function sendChat(messages: ChatMessage[], fields: NdaData): Promise<ChatResult> {
  let response: Response;
  try {
    response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, fields }),
    });
  } catch {
    throw new ChatError("Could not reach the server. Check your connection and try again.");
  }
  if (!response.ok) {
    const detail = await response
      .json()
      .then((body) => (typeof body?.detail === "string" ? body.detail : null))
      .catch(() => null);
    throw new ChatError(detail ?? "The AI assistant is unavailable. Please try again.");
  }
  return (await response.json()) as ChatResult;
}
