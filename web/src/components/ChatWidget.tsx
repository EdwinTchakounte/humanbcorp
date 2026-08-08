"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { sendChat, type ChatMessage } from "@/lib/api";

const WELCOME_FR = "Bonjour 👋 Je suis l'assistant HBC-RH. Comment puis-je vous aider sur vos besoins RH ?";
const WELCOME_EN = "Hello 👋 I'm the HBC-RH assistant. How can I help with your HR needs?";

export default function ChatWidget() {
  const pathname = usePathname();
  // Le widget est monté dans le layout racine (commun FR/EN) : on déduit la
  // langue de l'URL pour ne pas afficher du français sur le site anglais.
  const WELCOME = pathname?.startsWith("/en") ? WELCOME_EN : WELCOME_FR;
  // Espace apprenant : une barre de navigation basse occupe le bas sur mobile.
  // On surélève la bulle pour ne pas la chevaucher (desktop = position normale).
  const onLearner = pathname?.includes("/mon-espace") ?? false;
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", content: WELCOME }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, open]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    const res = await sendChat(next.filter((m) => m.role !== "assistant" || m.content !== WELCOME));
    setLoading(false);
    setMessages((m) => [
      ...m,
      { role: "assistant", content: res.ok ? res.reply || "" : res.detail || "Indisponible pour le moment." },
    ]);
  }

  return (
    <>
      {/* Bouton flottant */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Assistant HBC-RH"
        className={`fixed right-5 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-hbc-lg transition-transform hover:scale-105 ${
          onLearner ? "bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:bottom-5" : "bottom-5"
        }`}
      >
        <i className={`bx ${open ? "bx-x" : "bx-message-dots"} text-3xl`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.25, ease: [0.22, 0.61, 0.36, 1] }}
            className="fixed bottom-24 right-5 z-[60] flex h-[520px] max-h-[75vh] w-[min(92vw,380px)] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-hbc-lg"
          >
            {/* En-tête */}
            <div className="flex items-center gap-3 bg-brand-deep px-4 py-3 text-white">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
                <i className="bx bxs-bot text-xl" />
              </span>
              <div className="leading-tight">
                <div className="font-heading text-sm font-semibold">Assistant HBC-RH</div>
                <div className="text-xs text-white/70">En ligne · réponse immédiate</div>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-brand-soft/40 p-4">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm ${
                      m.role === "user"
                        ? "rounded-br-sm bg-brand text-white"
                        : "rounded-bl-sm bg-white text-ink shadow-hbc-sm"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-sm bg-white px-4 py-3 shadow-hbc-sm">
                    <span className="flex gap-1">
                      {[0, 1, 2].map((d) => (
                        <span
                          key={d}
                          className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted"
                          style={{ animationDelay: `${d * 0.15}s` }}
                        />
                      ))}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Saisie */}
            <div className="flex items-center gap-2 border-t border-line p-3">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Votre message…"
                className="flex-1 rounded-md border border-line bg-white px-4 py-2 text-sm outline-none focus:border-brand"
              />
              <button
                onClick={send}
                disabled={loading}
                aria-label="Envoyer"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-white disabled:opacity-50"
              >
                <i className="bx bx-send text-xl" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
