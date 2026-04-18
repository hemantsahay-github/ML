import { useEffect, useState, useRef } from "react";
import api, { formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";
import { PaperPlaneTilt, Sparkle, User } from "@phosphor-icons/react";

const seedPrompts = [
  "Given my properties, which one should I actually buy?",
  "Should I rent for 5 more years and invest in MFs instead?",
  "Is a plot in the suburbs better than a flat in the city for 10-year returns?",
  "Is my loan tenure too long? Should I prepay?",
];

export default function Advisor() {
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [properties, setProperties] = useState([]);
  const bottomRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/properties");
        setProperties(data);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const ask = async (q) => {
    const msg = (q ?? question).trim();
    if (!msg) return;
    setMessages((m) => [...m, { role: "user", text: msg }]);
    setQuestion("");
    setLoading(true);
    try {
      const context = properties.length ? { properties } : null;
      const { data } = await api.post("/advisor/chat", {
        question: msg,
        context,
        session_id: sessionId,
      });
      if (!sessionId) setSessionId(data.session_id);
      setMessages((m) => [...m, { role: "assistant", text: data.reply }]);
    } catch (e) {
      if (e.response?.status === 402) {
        toast.error("Pro plan required", {
          description: "Upgrade to unlock the AI advisor.",
          action: { label: "See plans", onClick: () => (window.location.href = "/pricing") },
        });
        setMessages((m) => [...m, { role: "assistant", text: "Pro plan required — head to Pricing to unlock the advisor. Your trial may have ended." }]);
      } else {
        toast.error(formatApiErrorDetail(e.response?.data?.detail));
        setMessages((m) => [...m, { role: "assistant", text: "The advisor stumbled. Try again in a moment." }]);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-8 py-10 flex flex-col min-h-screen" data-testid="advisor-page">
      <div className="mb-6">
        <div className="eyebrow mb-2">AI Advisor</div>
        <h1 className="font-serif text-5xl">A second opinion, on demand.</h1>
        <p className="text-muted-foreground mt-3 max-w-xl">
          Claude Sonnet 4.5 with your property data in hand. Ask for a verdict, a rent-vs-buy
          take, or a reality check.
        </p>
      </div>

      {messages.length === 0 && (
        <div className="card-flat p-6 mb-6" data-testid="advisor-empty">
          <div className="eyebrow mb-3">Try asking</div>
          <div className="flex flex-wrap gap-2">
            {seedPrompts.map((p) => (
              <button
                key={p}
                onClick={() => ask(p)}
                className="btn-ghost px-4 py-2 text-xs text-left"
                data-testid={`seed-${p.slice(0, 12).replace(/\s/g, "-")}`}
              >
                {p}
              </button>
            ))}
          </div>
          {properties.length > 0 && (
            <div className="mt-4 text-xs text-muted-foreground">
              {properties.length} propert{properties.length === 1 ? "y" : "ies"} will be sent as context.
            </div>
          )}
        </div>
      )}

      <div className="flex-1 space-y-5 mb-6" data-testid="advisor-messages">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-4 ${m.role === "user" ? "justify-end" : ""}`}>
            {m.role === "assistant" && (
              <div className="h-8 w-8 shrink-0 border hairline flex items-center justify-center text-[hsl(var(--secondary))]">
                <Sparkle size={16} weight="duotone" />
              </div>
            )}
            <div
              className={`card-flat p-5 max-w-2xl whitespace-pre-wrap leading-relaxed ${
                m.role === "user"
                  ? "border-[hsl(var(--primary))]"
                  : "border-[hsl(var(--secondary))]"
              }`}
              data-testid={`msg-${m.role}-${i}`}
            >
              {m.text}
            </div>
            {m.role === "user" && (
              <div className="h-8 w-8 shrink-0 border hairline flex items-center justify-center text-muted-foreground">
                <User size={16} />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-4" data-testid="advisor-thinking">
            <div className="h-8 w-8 shrink-0 border hairline flex items-center justify-center text-[hsl(var(--secondary))]">
              <Sparkle size={16} weight="duotone" />
            </div>
            <div className="card-flat p-5 text-muted-foreground italic">Thinking…</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask();
        }}
        className="sticky bottom-0 bg-background pt-4"
      >
        <div className="card-flat flex items-end gap-2 p-2">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={1}
            placeholder="Ask your advisor..."
            className="flex-1 bg-transparent border-none outline-none resize-none px-3 py-2 text-sm"
            data-testid="advisor-input"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask();
              }
            }}
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="btn-primary p-3 disabled:opacity-50"
            data-testid="advisor-send"
          >
            <PaperPlaneTilt size={16} weight="bold" />
          </button>
        </div>
      </form>
    </div>
  );
}
