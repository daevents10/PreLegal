"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ChatError, GREETING, sendChat, type ChatMessage } from "@/lib/chat";
import type { NdaData } from "@/lib/nda";

interface Props {
  data: NdaData;
  onChange: (data: NdaData) => void;
}

/** Freeform chat with the AI assistant, which fills in the NDA fields from the conversation. */
export default function NdaChat({ data, onChange }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLOListElement>(null);

  // Keep the latest message in view by scrolling the conversation only (never the page).
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, sending]);

  // Return focus to the input whenever a reply arrives (or fails) so the user can keep typing.
  useEffect(() => {
    if (!sending) inputRef.current?.focus();
  }, [sending]);

  async function send(event?: FormEvent) {
    event?.preventDefault();
    const content = input.trim();
    if (!content || sending) return;

    const history: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(history);
    setInput("");
    setError(null);
    setSending(true);
    try {
      const { reply, fields } = await sendChat(history, data);
      onChange(fields);
      setMessages([...history, { role: "assistant", content: reply }]);
    } catch (err) {
      // Roll back so the user can retry the same message.
      setMessages(messages);
      setInput(content);
      setError(err instanceof ChatError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  }

  return (
    <div className="flex h-[70vh] min-h-[28rem] flex-col rounded-lg border border-gray-200 bg-white shadow-sm">
      <ol ref={listRef} aria-label="Conversation" aria-live="polite" className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((message, i) => (
          <li key={i} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={`max-w-[85%] whitespace-pre-line rounded-lg px-3 py-2 text-sm ${
                message.role === "user" ? "bg-primary text-white" : "bg-gray-100 text-navy"
              }`}
            >
              <span className="sr-only">{message.role === "user" ? "You: " : "Assistant: "}</span>
              {message.content}
            </div>
          </li>
        ))}
        {sending && (
          <li className="flex justify-start">
            <div role="status" className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-muted">
              Thinking…
            </div>
          </li>
        )}
      </ol>

      {error && (
        <p role="alert" className="mx-4 mb-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <form onSubmit={send} className="flex items-end gap-2 border-t border-gray-200 p-3">
        <label htmlFor="chat-input" className="sr-only">
          Message
        </label>
        <textarea
          id="chat-input"
          ref={inputRef}
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your answer… (Enter to send, Shift+Enter for a new line)"
          className="flex-1 resize-none rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="rounded-md bg-secondary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
