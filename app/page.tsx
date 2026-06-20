"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Verdict, CompareResult } from "@/lib/claude";

/* ── Types ── */
type SourceInfo = { service: string; ok: boolean };
type SingleResponse = { query: string; sources: SourceInfo[]; verdict: Verdict };
type CompareResponse = {
  queryA: string; queryB: string;
  sourcesA: SourceInfo[]; sourcesB: SourceInfo[];
  comparison: CompareResult;
};
type HistoryItem = { query: string; response: SingleResponse; timestamp: number };

/* ── Constants ── */
const VC: Record<string, { bg: string; text: string; ring: string; glow: string; hex: string }> = {
  BUY:  { bg:"bg-emerald-500/15", text:"text-emerald-400", ring:"ring-emerald-500/40", glow:"shadow-emerald-500/20", hex:"#34d399" },
  WAIT: { bg:"bg-amber-500/15",   text:"text-amber-400",   ring:"ring-amber-500/40",   glow:"shadow-amber-500/20",   hex:"#fbbf24" },
  SKIP: { bg:"bg-rose-500/15",    text:"text-rose-400",    ring:"ring-rose-500/40",     glow:"shadow-rose-500/20",    hex:"#fb7185" },
};

const SUGGESTIONS = ["Sony WH-1000XM5","iPhone 16 Pro","Air Fryer","Tesla Model 3","Mechanical Keyboard","Standing Desk"];
const COMPARE_SUGGESTIONS = [
  ["iPhone 16 Pro","Samsung Galaxy S24"],
  ["AirPods Pro","Sony WF-1000XM5"],
  ["MacBook Air M3","Dell XPS 14"],
];

/* ── Confidence Ring ── */
function ConfidenceRing({ value, color, size = 112 }: { value: number; color: string; size?: number }) {
  const r = size * 0.45, c = 2 * Math.PI * r, offset = c - (value / 100) * c;
  const vb = `0 0 ${size} ${size}`;
  const cx = size / 2;
  return (
    <svg viewBox={vb} style={{ width: size, height: size }}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="currentColor" className="text-white/10" strokeWidth="7" />
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="currentColor" className={color} strokeWidth="7" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={offset}
        style={{ transition:"stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)", transform:"rotate(-90deg)", transformOrigin:"center" }} />
      <text x={cx} y={cx - 4} textAnchor="middle" className="fill-white font-bold" style={{ fontSize: size * 0.22 }}>{value}</text>
      <text x={cx} y={cx + size * 0.12} textAnchor="middle" className="fill-white/50" style={{ fontSize: size * 0.09, letterSpacing:"0.12em" }}>CONF</text>
    </svg>
  );
}

/* ── Source Chip ── */
function SourceChip({ source }: { source: SourceInfo }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-full border ${
      source.ok ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10" : "border-white/10 text-white/30 line-through bg-white/5"
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${source.ok ? "bg-emerald-400" : "bg-white/20"}`} />
      {source.service}
    </span>
  );
}

/* ── Mic Button (Web Speech API) ── */
function MicButton({ onResult, disabled }: { onResult: (text: string) => void; disabled: boolean }) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);

  const toggle = useCallback(() => {
    if (listening) { recRef.current?.stop(); return; }

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert("Your browser doesn't support voice input. Try Chrome."); return; }

    const rec = new SR();
    rec.lang = "en-US"; rec.interimResults = false; rec.maxAlternatives = 1;
    rec.onresult = (e: any) => { onResult(e.results[0][0].transcript); setListening(false); };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  }, [listening, onResult]);

  return (
    <button type="button" onClick={toggle} disabled={disabled} title="Voice search"
      className={`p-3 rounded-xl border transition-all ${
        listening
          ? "bg-rose-500/20 border-rose-500/50 text-rose-400 animate-pulse"
          : "bg-white/[0.06] border-white/10 text-white/50 hover:text-white hover:border-white/20"
      } disabled:opacity-30`}>
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
      </svg>
    </button>
  );
}

/* ── Verdict Card (shared between single + compare) ── */
function VerdictCard({ v, query, sources, compact }: { v: Verdict; query: string; sources: SourceInfo[]; compact?: boolean }) {
  const vc = VC[v.verdict];
  const [tab, setTab] = useState<"evidence"|"risks">("evidence");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {sources.map((s) => <SourceChip key={s.service} source={s} />)}
      </div>
      <div className={`backdrop-blur-xl bg-white/[0.06] border border-white/10 rounded-2xl p-5 shadow-lg ${vc.glow}`}>
        <div className={`flex ${compact ? "flex-col" : "flex-col sm:flex-row"} items-center gap-5`}>
          <div className={`px-5 py-2.5 rounded-xl ring-2 ${vc.ring} ${vc.bg} stamp stamp-animate`}>
            <span className={`font-display font-bold ${compact ? "text-2xl" : "text-3xl"} ${vc.text} tracking-wider`}>{v.verdict}</span>
          </div>
          <ConfidenceRing value={v.confidence} color={vc.text} size={compact ? 90 : 112} />
          <div className="flex-1 text-center sm:text-left">
            <p className={`text-white/90 ${compact ? "text-base" : "text-lg"} font-display italic leading-relaxed`}>&ldquo;{v.summary}&rdquo;</p>
            <p className="text-white/40 text-xs mt-1 font-mono">for &ldquo;{query}&rdquo;</p>
          </div>
        </div>
      </div>
      {/* Tabs */}
      <div className="backdrop-blur-xl bg-white/[0.06] border border-white/10 rounded-2xl overflow-hidden">
        <div className="flex border-b border-white/10">
          {(["evidence","risks"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-[10px] font-mono uppercase tracking-widest transition-all ${
                tab === t ? "text-white bg-white/[0.06] border-b-2 border-sky-400" : "text-white/40 hover:text-white/60"
              }`}>
              {t === "evidence" ? "✓ Supporting" : "⚠ Risks"}
            </button>
          ))}
        </div>
        <div className="p-4 space-y-2">
          {(tab === "evidence" ? v.supporting : v.risks).map((item, i) => (
            <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-colors">
              <span className={`mt-0.5 text-xs ${tab === "evidence" ? "text-emerald-400" : "text-amber-400"}`}>
                {tab === "evidence" ? "✓" : "⚠"}
              </span>
              <span className="text-sm text-white/80 leading-relaxed">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Share Button ── */
function ShareButton({ query, verdict }: { query: string; verdict: Verdict }) {
  const [copied, setCopied] = useState(false);

  const shareText = `🏛️ Verdict for "${query}"\n\n${verdict.verdict === "BUY" ? "✅" : verdict.verdict === "WAIT" ? "⏳" : "❌"} ${verdict.verdict} (${verdict.confidence}% confidence)\n\n${verdict.summary}\n\n✓ ${verdict.supporting.join("\n✓ ")}\n\n⚠ ${verdict.risks.join("\n⚠ ")}\n\n— verdict.app`;

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: `Verdict: ${query}`, text: shareText });
        return;
      } catch {}
    }
    await navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button onClick={handleShare}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.06] border border-white/10 text-white/60 hover:text-white hover:bg-white/[0.1] transition-all text-xs font-medium">
      {copied ? (
        <><svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> Copied!</>
      ) : (
        <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg> Share Verdict</>
      )}
    </button>
  );
}

/* ══════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════ */
export default function Home() {
  const [mode, setMode] = useState<"single" | "compare">("single");

  // Single mode
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadPhase, setLoadPhase] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SingleResponse | null>(null);

  // Compare mode
  const [queryA, setQueryA] = useState("");
  const [queryB, setQueryB] = useState("");
  const [compareLoading, setCompareLoading] = useState(false);
  const [comparePhase, setComparePhase] = useState(0);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [compareResult, setCompareResult] = useState<CompareResponse | null>(null);

  // History
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Load history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("verdict-history");
      if (saved) setHistory(JSON.parse(saved));
    } catch {}
  }, []);

  // Save history
  useEffect(() => {
    try { localStorage.setItem("verdict-history", JSON.stringify(history)); } catch {}
  }, [history]);

  // Loading phase tickers
  useEffect(() => {
    if (!loading) { setLoadPhase(0); return; }
    let i = 0;
    const id = setInterval(() => { i = Math.min(i + 1, 3); setLoadPhase(i); }, 1800);
    return () => clearInterval(id);
  }, [loading]);

  useEffect(() => {
    if (!compareLoading) { setComparePhase(0); return; }
    let i = 0;
    const id = setInterval(() => { i = Math.min(i + 1, 5); setComparePhase(i); }, 1500);
    return () => clearInterval(id);
  }, [compareLoading]);

  /* ── Single verdict ── */
  async function fileCase(q?: string) {
    const topic = (q ?? query).trim();
    if (!topic || loading) return;
    setQuery(topic); setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch("/api/verdict", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: topic }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Something went wrong.");
      setResult(data);
      setHistory((h) => [{ query: topic, response: data, timestamp: Date.now() }, ...h].slice(0, 20));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally { setLoading(false); }
  }

  /* ── Compare ── */
  async function fileCompare(a?: string, b?: string) {
    const tA = (a ?? queryA).trim(), tB = (b ?? queryB).trim();
    if (!tA || !tB || compareLoading) return;
    setQueryA(tA); setQueryB(tB); setCompareLoading(true); setCompareError(null); setCompareResult(null);
    try {
      const res = await fetch("/api/compare", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queryA: tA, queryB: tB }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Something went wrong.");
      setCompareResult(data);
    } catch (err) {
      setCompareError(err instanceof Error ? err.message : "Something went wrong.");
    } finally { setCompareLoading(false); }
  }

  const v = result?.verdict;
  const vc = v ? VC[v.verdict] : null;
  const isLoading = loading || compareLoading;

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-10 sm:py-14 relative overflow-hidden">
      {/* BG */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-sky-600/10 blur-[120px]" />
        <div className="absolute -bottom-60 -right-40 w-[600px] h-[600px] rounded-full bg-violet-600/10 blur-[140px]" />
      </div>

      <div className="relative z-10 w-full max-w-3xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
            <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-sky-400/80">Live Research Engine</span>
          </div>
          <h1 className="font-display italic text-5xl sm:text-6xl font-semibold text-white tracking-tight">Verdict</h1>
          <p className="text-sm text-white/50 mt-3 max-w-lg mx-auto leading-relaxed">
            Research any product with live data from Amazon, Reddit &amp; Google Trends.
            Get a clear ruling — or compare two products head-to-head.
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex rounded-xl bg-white/[0.06] border border-white/10 p-1">
            {(["single", "compare"] as const).map((m) => (
              <button key={m} onClick={() => { setMode(m); setError(null); setCompareError(null); }}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                  mode === m ? "bg-sky-500 text-white shadow-lg shadow-sky-500/25" : "text-white/50 hover:text-white"
                }`}>
                {m === "single" ? "🔍 Single Verdict" : "⚖️ Compare"}
              </button>
            ))}
          </div>
        </div>

        {/* ═══════ SINGLE MODE ═══════ */}
        {mode === "single" && (
          <>
            <div className="backdrop-blur-xl bg-white/[0.06] border border-white/10 rounded-2xl p-5 sm:p-6 shadow-2xl">
              <form onSubmit={(e) => { e.preventDefault(); fileCase(); }} className="flex gap-2">
                <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
                  placeholder="e.g. Sony WH-1000XM5 headphones"
                  className="flex-1 bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/30 transition-all text-sm"
                  disabled={isLoading} maxLength={200} />
                <MicButton onResult={(t) => { setQuery(t); fileCase(t); }} disabled={isLoading} />
                <button type="submit" disabled={isLoading || !query.trim()}
                  className="px-5 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-semibold text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap shadow-lg shadow-sky-500/25">
                  {loading ? "Analyzing…" : "Get Verdict"}
                </button>
              </form>
              {!result && !loading && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="text-white/30 text-xs self-center mr-1">Try:</span>
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => { setQuery(s); fileCase(s); }}
                      className="text-xs px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/10 text-white/60 hover:text-white hover:bg-white/[0.1] hover:border-white/20 transition-all">
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Loading */}
            {loading && (
              <div className="mt-6 backdrop-blur-xl bg-white/[0.04] border border-white/10 rounded-2xl p-6 space-y-4">
                {["Pulling Amazon data…","Scanning Reddit discussions…","Checking Google Trends…","Synthesizing verdict…"].map((msg, i) => (
                  <div key={msg} className={`flex items-center gap-3 transition-all duration-500 ${i <= loadPhase ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4"}`}>
                    {i < loadPhase ? (
                      <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      </span>
                    ) : i === loadPhase ? (
                      <span className="w-5 h-5 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
                    ) : (
                      <span className="w-5 h-5 rounded-full border border-white/10" />
                    )}
                    <span className={`text-sm ${i <= loadPhase ? "text-white/80" : "text-white/30"}`}>{msg}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Error */}
            {error && !loading && (
              <div className="mt-6 backdrop-blur-xl bg-rose-500/10 border border-rose-500/20 rounded-2xl p-5">
                <p className="font-mono text-xs uppercase tracking-wide text-rose-400 mb-1">Error</p>
                <p className="text-sm text-white/70">{error}</p>
                <button onClick={() => fileCase()} className="mt-3 text-xs text-rose-400 hover:text-rose-300 underline underline-offset-4">Retry</button>
              </div>
            )}

            {/* Result */}
            {v && vc && !loading && (
              <div className="mt-6 animate-in">
                <VerdictCard v={v} query={result.query} sources={result.sources} />
                <div className="mt-4 flex justify-center">
                  <ShareButton query={result.query} verdict={v} />
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══════ COMPARE MODE ═══════ */}
        {mode === "compare" && (
          <>
            <div className="backdrop-blur-xl bg-white/[0.06] border border-white/10 rounded-2xl p-5 sm:p-6 shadow-2xl">
              <form onSubmit={(e) => { e.preventDefault(); fileCompare(); }} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-widest text-white/40 mb-1.5">Product A</label>
                    <div className="flex gap-2">
                      <input type="text" value={queryA} onChange={(e) => setQueryA(e.target.value)}
                        placeholder="e.g. iPhone 16 Pro"
                        className="flex-1 bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 outline-none focus:border-sky-500/50 text-sm"
                        disabled={isLoading} maxLength={200} />
                      <MicButton onResult={(t) => setQueryA(t)} disabled={isLoading} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-widest text-white/40 mb-1.5">Product B</label>
                    <div className="flex gap-2">
                      <input type="text" value={queryB} onChange={(e) => setQueryB(e.target.value)}
                        placeholder="e.g. Samsung Galaxy S24"
                        className="flex-1 bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 outline-none focus:border-sky-500/50 text-sm"
                        disabled={isLoading} maxLength={200} />
                      <MicButton onResult={(t) => setQueryB(t)} disabled={isLoading} />
                    </div>
                  </div>
                </div>
                <button type="submit" disabled={isLoading || !queryA.trim() || !queryB.trim()}
                  className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-semibold text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-sky-500/25">
                  {compareLoading ? "⚖️ Comparing…" : "⚖️ Compare Head-to-Head"}
                </button>
              </form>
              {!compareResult && !compareLoading && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="text-white/30 text-xs self-center mr-1">Try:</span>
                  {COMPARE_SUGGESTIONS.map(([a, b]) => (
                    <button key={a+b} onClick={() => { setQueryA(a); setQueryB(b); fileCompare(a, b); }}
                      className="text-xs px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/10 text-white/60 hover:text-white hover:bg-white/[0.1] hover:border-white/20 transition-all">
                      {a} vs {b}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Compare loading */}
            {compareLoading && (
              <div className="mt-6 backdrop-blur-xl bg-white/[0.04] border border-white/10 rounded-2xl p-6 space-y-3">
                {[`Researching ${queryA}…`, `Researching ${queryB}…`, "Pulling Amazon data…", "Scanning Reddit…", "Checking Trends…", "Comparing verdicts…"].map((msg, i) => (
                  <div key={msg} className={`flex items-center gap-3 transition-all duration-500 ${i <= comparePhase ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4"}`}>
                    {i < comparePhase ? (
                      <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      </span>
                    ) : i === comparePhase ? (
                      <span className="w-5 h-5 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
                    ) : (
                      <span className="w-5 h-5 rounded-full border border-white/10" />
                    )}
                    <span className={`text-sm ${i <= comparePhase ? "text-white/80" : "text-white/30"}`}>{msg}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Compare error */}
            {compareError && !compareLoading && (
              <div className="mt-6 backdrop-blur-xl bg-rose-500/10 border border-rose-500/20 rounded-2xl p-5">
                <p className="font-mono text-xs uppercase tracking-wide text-rose-400 mb-1">Error</p>
                <p className="text-sm text-white/70">{compareError}</p>
                <button onClick={() => fileCompare()} className="mt-3 text-xs text-rose-400 hover:text-rose-300 underline underline-offset-4">Retry</button>
              </div>
            )}

            {/* Compare result */}
            {compareResult && !compareLoading && (
              <div className="mt-6 space-y-4 animate-in">
                {/* Winner banner */}
                <div className="backdrop-blur-xl bg-white/[0.06] border border-white/10 rounded-2xl p-5 text-center">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-white/40 mb-2">Winner</p>
                  <p className="text-2xl font-display font-bold text-sky-400">
                    {compareResult.comparison.winner === "A" ? `🏆 ${compareResult.queryA}` :
                     compareResult.comparison.winner === "B" ? `🏆 ${compareResult.queryB}` :
                     "🤝 It's a Tie"}
                  </p>
                  <p className="text-sm text-white/60 mt-2 italic">{compareResult.comparison.reason}</p>
                </div>

                {/* Side by side */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <p className="font-mono text-xs text-white/40 mb-2 uppercase tracking-wider flex items-center gap-2">
                      {compareResult.comparison.winner === "A" && <span>🏆</span>} Product A
                    </p>
                    <VerdictCard v={compareResult.comparison.productA} query={compareResult.queryA} sources={compareResult.sourcesA} compact />
                  </div>
                  <div>
                    <p className="font-mono text-xs text-white/40 mb-2 uppercase tracking-wider flex items-center gap-2">
                      {compareResult.comparison.winner === "B" && <span>🏆</span>} Product B
                    </p>
                    <VerdictCard v={compareResult.comparison.productB} query={compareResult.queryB} sources={compareResult.sourcesB} compact />
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══════ HISTORY ═══════ */}
        {history.length > 0 && (
          <div className="mt-8">
            <button onClick={() => setShowHistory(!showHistory)}
              className="text-xs font-mono text-white/40 hover:text-white/70 transition-colors flex items-center gap-2">
              <svg className={`w-3 h-3 transition-transform ${showHistory ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              {history.length} past verdict{history.length > 1 ? "s" : ""}
              <span className="text-white/20 ml-2">saved locally</span>
            </button>
            {showHistory && (
              <div className="mt-3 space-y-2">
                {history.map((h, i) => {
                  const hc = VC[h.response.verdict.verdict];
                  return (
                    <button key={i} onClick={() => { setMode("single"); setQuery(h.query); setResult(h.response); setError(null); }}
                      className="w-full text-left flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/5 hover:bg-white/[0.08] transition-all">
                      <span className={`text-xs font-bold ${hc.text} w-10`}>{h.response.verdict.verdict}</span>
                      <span className="text-sm text-white/70 flex-1 truncate">{h.query}</span>
                      <span className="text-[10px] text-white/30 font-mono">{h.response.verdict.confidence}%</span>
                      <span className="text-[10px] text-white/20 font-mono">{new Date(h.timestamp).toLocaleDateString()}</span>
                    </button>
                  );
                })}
                <button onClick={() => { setHistory([]); setShowHistory(false); }}
                  className="text-[10px] text-white/30 hover:text-rose-400 transition-colors font-mono mt-1">
                  Clear history
                </button>
              </div>
            )}
          </div>
        )}

        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/20 mt-10 text-center">
          Live data via Anakin Wire · Reasoning by Groq + Llama 3.3
        </p>
      </div>
    </main>
  );
}
