"use client";

import React, { useEffect, useRef } from "react";
import { cn } from "../cn";
import { Icon } from "../icons";

export interface ChatPanelMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  time?: string;
}

export interface ChatSuggestion {
  label: string;
  /** Text sent when the suggestion is clicked. Defaults to the label. */
  prompt?: string;
}

export interface ChatPanelProps {
  title?: string;
  subtitle?: string;
  messages: ChatPanelMessage[];
  input: string;
  onInputChange: (value: string) => void;
  onSend: (text: string) => void;
  suggestions?: ChatSuggestion[];
  placeholder?: string;
  /** light: stone surfaces. dark: ink surfaces for dark layouts. */
  tone?: "light" | "dark";
  className?: string;
}

export function ChatPanel({
  title = "Cervos Assistant",
  subtitle = "Ask about stock, sales, or deliveries.",
  messages,
  input,
  onInputChange,
  onSend,
  suggestions = [],
  placeholder = "Type a question",
  tone = "light",
  className,
}: ChatPanelProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const dark = tone === "dark";

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (text) onSend(text);
  };

  return (
    <section
      aria-label={title}
      className={cn(
        "flex flex-col overflow-hidden rounded-[12px] border",
        dark ? "border-white/10 bg-[#161B19] text-white" : "border-[#DDD8CE] bg-white text-[#1E2522]",
        className
      )}
    >
      <header className={cn("flex items-center gap-3 border-b px-4 py-3", dark ? "border-white/10" : "border-[#DDD8CE]")}>
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full",
            dark ? "bg-white/10 text-white" : "bg-[#E2EEEC] text-[#1F5F5B]"
          )}
        >
          <Icon name="message" size={18} />
        </span>
        <div className="min-w-0">
          <h3 className="text-base font-semibold leading-6">{title}</h3>
          <p className={cn("truncate text-sm", dark ? "text-white/60" : "text-[#545C57]")}>{subtitle}</p>
        </div>
      </header>

      <div ref={listRef} className="flex max-h-80 min-h-48 flex-col gap-3 overflow-y-auto overscroll-contain px-4 py-4" aria-live="polite">
        {messages.map((m) => {
          const mine = m.role === "user";
          return (
            <div key={m.id} className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-[12px] px-3.5 py-2.5 text-base leading-6",
                  mine
                    ? "bg-[#1F5F5B] text-white"
                    : dark
                      ? "bg-white/[0.08] text-white"
                      : "bg-[#F5F3EE] text-[#1E2522]"
                )}
              >
                {m.text}
              </div>
              {m.time && <span className={cn("text-xs tabular-nums", dark ? "text-white/45" : "text-[#7A817C]")}>{m.time}</span>}
            </div>
          );
        })}
      </div>

      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 pb-3">
          {suggestions.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => onSend(s.prompt ?? s.label)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors duration-150",
                dark ? "border-white/15 text-white hover:bg-white/10" : "border-[#DDD8CE] text-[#1E2522] hover:bg-[#EDEAE3]"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={submit} className={cn("flex items-center gap-2 border-t p-3", dark ? "border-white/10" : "border-[#DDD8CE]")}>
        <label className="sr-only" htmlFor="cervos-chat-input">
          Message
        </label>
        <input
          id="cervos-chat-input"
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            "h-11 flex-1 rounded-[8px] border px-3 text-base focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1F5F5B]",
            dark ? "border-white/15 bg-white/5 text-white placeholder:text-white/40" : "border-[#DDD8CE] bg-white placeholder:text-[#7A817C]"
          )}
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="inline-flex h-11 items-center gap-2 rounded-[8px] bg-[#1F5F5B] px-4 text-base font-semibold text-white transition-colors duration-150 hover:bg-[#184C49] disabled:opacity-50"
        >
          <Icon name="send" size={18} />
          Send
        </button>
      </form>
    </section>
  );
}
