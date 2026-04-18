import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api, { formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";
import { Chat, X, PaperPlaneTilt, Bug, Lightbulb, Heart, ChatCircleDots } from "@phosphor-icons/react";

const CATEGORIES = [
  { id: "general", label: "General", Icon: ChatCircleDots },
  { id: "bug", label: "Bug", Icon: Bug },
  { id: "idea", label: "Idea", Icon: Lightbulb },
  { id: "love", label: "Love", Icon: Heart },
];

export default function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("idea");
  const [rating, setRating] = useState(5);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!message.trim()) {
      toast.error("Please add a message.");
      return;
    }
    setSending(true);
    try {
      await api.post("/feedback", {
        category,
        rating,
        message: message.trim(),
        page: window.location.pathname,
      });
      toast.success("Thank you. Noted.");
      setOpen(false);
      setMessage("");
      setRating(5);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-40 z-40 h-12 px-4 rounded-full bg-[hsl(var(--card))] border hairline text-foreground flex items-center gap-2 shadow hover:border-[hsl(var(--secondary))] transition text-sm"
        data-testid="feedback-trigger"
        title="Send feedback"
      >
        <Chat size={16} weight="duotone" /> Feedback
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[55] flex items-end md:items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            data-testid="feedback-modal"
          >
            <div className="absolute inset-0 bg-background/70" onClick={() => setOpen(false)} />
            <motion.form
              onSubmit={submit}
              className="relative card-flat w-full md:max-w-lg mx-0 md:mx-6 p-8"
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 8, opacity: 0 }}
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="absolute top-4 right-4 btn-ghost p-2"
                data-testid="feedback-close"
              >
                <X size={14} />
              </button>
              <div className="eyebrow mb-2">Feedback</div>
              <h2 className="font-serif text-3xl mb-2">Help us sharpen Estima.</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Bugs, ideas, compliments — everything lands in our inbox.
              </p>

              <div className="flex gap-2 mb-5">
                {CATEGORIES.map((c) => {
                  const Icon = c.Icon;
                  return (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => setCategory(c.id)}
                      className={`px-3 py-2 text-xs border inline-flex items-center gap-1.5 ${
                        category === c.id
                          ? "border-[hsl(var(--primary))] text-foreground"
                          : "hairline text-muted-foreground hover:text-foreground"
                      }`}
                      data-testid={`feedback-category-${c.id}`}
                    >
                      <Icon size={12} weight="duotone" /> {c.label}
                    </button>
                  );
                })}
              </div>

              <div className="mb-5">
                <div className="eyebrow mb-2">How is your experience?</div>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      type="button"
                      key={n}
                      onClick={() => setRating(n)}
                      className={`h-9 w-9 border ${
                        n <= rating
                          ? "bg-[hsl(var(--primary))] border-[hsl(var(--primary))] text-white"
                          : "hairline text-muted-foreground hover:text-foreground"
                      }`}
                      data-testid={`feedback-rating-${n}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder="Tell us what's on your mind…"
                className="input-dark w-full px-3 py-2 mb-4"
                data-testid="feedback-message"
                required
              />

              <button
                type="submit"
                disabled={sending}
                className="btn-primary w-full py-3 text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60"
                data-testid="feedback-submit"
              >
                <PaperPlaneTilt size={14} weight="bold" />
                {sending ? "Sending…" : "Send feedback"}
              </button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
