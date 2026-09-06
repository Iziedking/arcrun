"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { BnbChain, LpHiringReadiness } from "./types";
import type { LpRun } from "./providers/lp-runs";
import { checkLpHiring, readLpAnalysis, startLpAnalysis } from "./client";

const BUTTON = "inline-flex min-h-11 items-center justify-center border border-[color:var(--hairline-strong)] px-4 py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-ink hover:bg-canvas-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50";
const INPUT = "mt-2 h-12 w-full border border-[color:var(--hairline-strong)] bg-canvas px-4 font-mono text-sm text-ink focus:outline focus:outline-2 focus:outline-accent";
const HIRING_BLOCKERS: Record<string, string> = {
  testnet_only: "This service is available on BNB Testnet while it is being proven.",
  hiring_flag_disabled: "This service is not accepting paid requests yet.",
  agent_identity_unconfigured: "The service identity is still being set up.",
  provider_wallet_unconfigured: "The service payment account is still being set up.",
  exact_price_unconfigured: "The service price is still being set up.",
  public_provider_url_unconfigured: "The service is not reachable at its public address yet.",
  altana_session_unconfigured: "The service is not ready to sign requests yet.",
  registration_not_qualified: "The service identity could not be confirmed.",
  provider_wallet_mismatch: "The service payment account needs attention.",
  provider_endpoint_mismatch: "The service address needs attention.",
  registration_unavailable: "The service identity could not be checked right now.",
  provider_execution_unavailable: "The service is not online for paid requests yet.",
};

function HiringReadiness({ chainId }: { chainId: BnbChain }) {
  const [readiness, setReadiness] = useState<LpHiringReadiness | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setReadiness(null); setError(null);
    checkLpHiring(chainId, controller.signal).then(setReadiness).catch((failure: unknown) => {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Hiring readiness could not be checked.");
    });
    return () => controller.abort();
  }, [chainId, retry]);
  return <aside className="mt-6 border-t border-[color:var(--hairline-strong)] pt-5" aria-label="Service availability">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="font-mono text-[10px] uppercase tracking-widest text-accent">USE THIS AGENT</p>
        <p className="mt-2 max-w-[85ch] font-mono text-[11px] leading-relaxed text-ink-2">We check whether this service is ready before showing the paid action.</p></div>
      <span className="border border-[color:var(--hairline-strong)] px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-ink-2">{readiness?.enabled ? "AVAILABLE" : readiness ? "NOT YET" : error ? "CHECK FAILED" : "CHECKING…"}</span>
    </div>
    {error ? <div role="alert" className="mt-4 border-l-2 border-accent pl-4 font-mono text-[11px] leading-relaxed text-ink-2"><p>{error}</p><button type="button" className={`${BUTTON} mt-3`} onClick={() => setRetry((value) => value + 1)}>TRY AGAIN →</button></div> : null}
    {readiness && !readiness.enabled ? <details className="mt-4 font-mono text-[11px] leading-relaxed text-ink-2"><summary className="min-h-11 cursor-pointer py-3 uppercase tracking-widest">WHY NOT YET?</summary><ul className="list-disc space-y-2 pl-5">{readiness.blockers.map((blocker) => <li key={blocker}>{HIRING_BLOCKERS[blocker] ?? "The service needs attention before it can accept paid requests."}</li>)}</ul></details> : null}
    {readiness?.enabled ? <p role="status" className="mt-4 border-l-2 border-accent pl-4 font-mono text-[11px] leading-relaxed text-ink-2">Available at {readiness.priceDisplay} {readiness.token?.symbol} per request. Sign in when you are ready to continue.</p> : null}
  </aside>;
}
function rememberRun(id: string | null) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("lpRun", id); else url.searchParams.delete("lpRun");
  window.history.replaceState(null, "", url);
}
export function LpGuardianPanel({ chainId }: { chainId: BnbChain }) {
  const [positionId, setPositionId] = useState(""); const [width, setWidth] = useState("10"); const [deviation, setDeviation] = useState("100");
  const [busy, setBusy] = useState(false); const [run, setRun] = useState<LpRun | null>(null); const [error, setError] = useState<string | null>(null);
  const key = useRef<string | null>(null); const request = useRef<AbortController | null>(null);
  useEffect(() => {
    if (chainId !== 97) return;
    const id = new URL(window.location.href).searchParams.get("lpRun");
    const controller = new AbortController(); request.current = controller;
    if (id) { setBusy(true); readLpAnalysis(chainId, id, controller.signal).then((saved) => {
      setRun(saved);
      if (saved.report) { key.current = saved.id; setPositionId(saved.report.input.positionId); setWidth(String(saved.report.input.halfWidthSteps)); setDeviation(String(saved.report.input.maxDeviationTicks)); }
    })
      .catch((e: unknown) => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "The saved report could not be loaded."); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); }); }
    return () => { controller.abort(); request.current?.abort(); };
  }, [chainId]);
  useEffect(() => {
    if (run?.status !== "running") return;
    const controller = new AbortController();
    const timer = setTimeout(() => { readLpAnalysis(chainId, run.id, controller.signal).then(setRun)
      .catch((e: unknown) => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "The report could not be refreshed."); }); }, 3000);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [chainId, run]);
  function clearResult() { key.current = null; setRun(null); setError(null); rememberRun(null); }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy || run?.status === "running") return;
    setBusy(true); setError(null); key.current ??= crypto.randomUUID();
    const controller = new AbortController(); request.current?.abort(); request.current = controller;
    try {
      const result = await startLpAnalysis(chainId, key.current, { positionId, halfWidthSteps: Number(width), maxDeviationTicks: Number(deviation) }, controller.signal);
      setRun(result); rememberRun(result.id);
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Analysis failed. Retry uses the same run ID."); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  function download() {
    if (!run?.reportJson) return;
    const url = URL.createObjectURL(new Blob([run.reportJson], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = `agon-lp-${run.id}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const waiting = busy || run?.status === "running";
  const report = run?.report;
  return <section className="border border-[color:var(--hairline-strong)] bg-canvas-2 p-5 sm:p-6" aria-labelledby="lp-guardian-title">
    <p className="font-mono text-[10px] uppercase tracking-widest text-accent">LIVE POSITION CHECK</p>
    <h2 id="lp-guardian-title" className="mt-4 font-stencil text-3xl uppercase">LIQUIDITY CHECK</h2>
    <p className="mt-4 max-w-[85ch] font-mono text-sm leading-relaxed text-ink-2">See whether your PancakeSwap position is in range and get a suggested range to review.</p>
    <p className="mt-3 font-mono text-[11px] leading-relaxed text-ink-3">Free read-only check. No wallet needed. Nothing in your position is changed.</p>
    {chainId !== 97 ? <p role="status" className="mt-6 border-l-2 border-accent pl-4 font-mono text-sm text-ink-2">Select BNB Testnet to run LP Guardian. It does not read Testnet positions under a Mainnet label.</p> : <>
      <form onSubmit={submit} className="mt-6 space-y-5">
        <fieldset disabled={waiting} className="grid gap-4 md:grid-cols-3">
          <legend className="sr-only">PancakeSwap Testnet position settings</legend>
          <label className="font-mono text-[11px] uppercase text-ink-2">POSITION ID<input className={INPUT} required inputMode="numeric" pattern="[0-9]+" value={positionId} onChange={(e) => { clearResult(); setPositionId(e.target.value); }} placeholder="PancakeSwap position ID" /></label>
          <label className="font-mono text-[11px] uppercase text-ink-2">RANGE SIZE<input className={INPUT} required type="number" min="1" max="1000" step="1" value={width} onChange={(e) => { clearResult(); setWidth(e.target.value); }} /></label>
          <label className="font-mono text-[11px] uppercase text-ink-2">PRICE DEVIATION<input className={INPUT} required type="number" min="0" max="10000" step="1" value={deviation} onChange={(e) => { clearResult(); setDeviation(e.target.value); }} /></label>
        </fieldset>
        <p className="max-w-[85ch] font-mono text-[11px] leading-relaxed text-ink-3">These settings control how wide the suggested range can be and how much price movement the check will accept.</p>
        <button className={`${BUTTON} bg-accent !text-accent-ink`} disabled={waiting}>{waiting ? "CHECKING POSITION…" : key.current && error ? "TRY AGAIN →" : "CHECK POSITION →"}</button>
        {run && run.status !== "running" ? <button type="button" disabled={busy} className={`${BUTTON} ml-3`} onClick={clearResult}>NEW ANALYSIS</button> : null}
      </form>
      {waiting ? <p role="status" className="mt-5 font-mono text-sm text-ink-2">Checking the latest position data. This can take up to 45 seconds.</p> : null}
      {error || run?.error ? <p role="alert" className="mt-5 border-l-2 border-accent pl-4 font-mono text-sm text-ink-2">{error ?? run?.error}</p> : null}
      {report ? <div className="mt-6 border-t border-[color:var(--hairline-strong)] pt-6">
        <p role="status" className="font-mono text-[11px] uppercase tracking-widest text-accent">{report.decision.action === "hold" ? "IN RANGE / HOLD" : report.decision.action === "review_rebalance" ? "OUT OF RANGE / REVIEW PROPOSAL" : "PROPOSAL WITHHELD"}</p>
        <p className="mt-3 max-w-[85ch] font-mono text-sm leading-relaxed text-ink">{report.decision.reason}</p>
        <dl className="mt-5 grid gap-5 font-mono text-[12px] sm:grid-cols-3">
          <div><dt className="text-ink-3">CURRENT TICK</dt><dd className="mt-2">{report.state.tick}</dd></div>
          <div><dt className="text-ink-3">POSITION RANGE</dt><dd className="mt-2">{report.state.tickLower} to {report.state.tickUpper}</dd></div>
          <div><dt className="text-ink-3">10-MINUTE AVERAGE</dt><dd className="mt-2">{report.state.twapTick ?? "Unavailable"}</dd></div>
        </dl>
        {report.decision.proposedRange ? <p className="mt-5 font-mono text-sm">PROPOSED RANGE: {report.decision.proposedRange.tickLower} to {report.decision.proposedRange.tickUpper}. Review only.</p> : null}
        <p className="mt-5 font-mono text-[11px] text-ink-2">Snapshot: {new Date(report.evidence.blockTimestamp).toLocaleString()} · <a className="underline" href={report.evidence.blockUrl} target="_blank" rel="noreferrer">BLOCK {report.evidence.blockNumber} ↗</a></p>
        <details className="mt-5 font-mono text-[11px] leading-relaxed text-ink-2"><summary className="min-h-11 cursor-pointer py-3 uppercase">EVIDENCE AND LIMITATIONS</summary><p className="break-all">RUN {run?.id}<br/>{run?.reportHash}</p>{report.limitations.map((line) => <p key={line} className="mt-3">{line}</p>)}<p className="mt-3 break-all">POOL {report.evidence.pool}</p><a className="mt-3 inline-block underline" href={report.evidence.positionUrl} target="_blank" rel="noreferrer">INSPECT SOURCE POSITION ↗</a></details>
        <button className={`${BUTTON} mt-4`} onClick={download}>DOWNLOAD REPORT →</button>
      </div> : null}
    </>}
    <HiringReadiness chainId={chainId} />
  </section>;
}
