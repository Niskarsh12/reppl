"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownToLine, ArrowLeft, Check, Copy, FileText, Pencil } from "lucide-react";
import { availableAssets, roleOptions, type PartnershipDraft } from "@/lib/partnerships/strategy";
import type { BrandInvestigation, EventBrief, PartnershipCandidate, PartnershipResearch } from "@/lib/partnerships/types";
import { Brand } from "./Brand";

export function Approach({ brief, candidate, research, investigation, draft, example, onChange, onRole, onBack, onExport }: {
  brief: EventBrief; candidate: PartnershipCandidate; research: PartnershipResearch; investigation: BrandInvestigation; draft: PartnershipDraft; example: boolean;
  onChange: (key: keyof PartnershipDraft, value: string) => void; onRole: (roleId: string) => void; onBack: () => void; onExport: () => void;
}) {
  const [view, setView] = useState<"edit" | "proposal">("edit");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const appendix = useRef<HTMLDetailsElement>(null);
  const wasOpen = useRef(false);
  const selected = roleOptions(brief, candidate, investigation).find(o => o.asset.id === draft.roleId);
  useEffect(() => {
    const before = () => { if (appendix.current) { wasOpen.current = appendix.current.open; appendix.current.open = true; } };
    const after = () => { if (appendix.current) appendix.current.open = wasOpen.current; };
    window.addEventListener("beforeprint", before); window.addEventListener("afterprint", after);
    return () => { window.removeEventListener("beforeprint", before); window.removeEventListener("afterprint", after); };
  }, []);
  async function copy() {
    try { await navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.email}`); setCopied(true); setCopyError(""); }
    catch { setCopyError("Select the email text to copy it, or export the approach."); }
  }
  return <div className="calm-approach">
    <div className="approach-context"><button className="text-action" onClick={onBack}><ArrowLeft size={15} />Back to the fit check</button><div className="approach-view"><button aria-pressed={view === "edit"} onClick={() => setView("edit")}><Pencil size={14} />Idea & email</button><button aria-pressed={view === "proposal"} onClick={() => setView("proposal")}><FileText size={14} />Proposal</button></div></div>
    {view === "edit" ? <div className="calm-approach-grid">
      <section className="approach-idea"><span className="quiet-label">The idea for {candidate.name}</span><h2>{draft.concept || "A shared cultural moment"}</h2><p className="idea-summary">{draft.experience}</p><label className="role-choice">Partner role<select value={draft.roleId} onChange={e => onRole(e.target.value)}>{availableAssets(brief).map(asset => <option key={asset.id} value={asset.id}>{asset.role}</option>)}</select></label><div className="idea-ask"><span className="quiet-label">What we’d ask for</span><p>{draft.ask}</p></div><span className="hypothesis-label">Proposed idea · not a confirmed partnership</span>
        <details className="edit-plan"><summary>Edit the idea & details</summary><div className="strategy-editor"><label>Concept<input maxLength={240} value={draft.concept} onChange={e => onChange("concept", e.target.value)} /></label><label>Experience<textarea rows={4} maxLength={5000} value={draft.experience} onChange={e => onChange("experience", e.target.value)} /></label><label>Partner contribution<textarea rows={3} maxLength={2500} value={draft.ask} onChange={e => onChange("ask", e.target.value)} /></label><label>Questions to resolve<textarea rows={3} maxLength={3000} value={draft.validation} onChange={e => onChange("validation", e.target.value)} /></label><label>Measurement plan<textarea rows={2} maxLength={2000} value={draft.measurement} onChange={e => onChange("measurement", e.target.value)} /></label></div></details>
      </section>
      <section className="opening-email"><div className="panel-heading"><h3>Your opening email</h3><span className="draft-status">Draft · not sent</span></div><label>Subject<input maxLength={240} value={draft.subject} onChange={e => { onChange("subject", e.target.value); setCopied(false); }} /></label><label>Email<textarea rows={11} maxLength={6000} value={draft.email} onChange={e => { onChange("email", e.target.value); setCopied(false); }} /></label><div className="email-actions"><button className="action action-plain" onClick={copy}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "Copied" : "Copy email"}</button><button className="action action-dark" onClick={() => setView("proposal")}>Review proposal <FileText size={15} /></button></div>{copyError && <p role="status" className="form-error">{copyError}</p>}</section>
    </div> : <div className="proposal-layout"><article className="proposal-document">
      <div className="document-masthead"><Brand /><span>Partnership proposal</span></div><span className="overline">{example ? "Example event · " : ""}For discussion</span><h2>{candidate.name}<span>× {brief.name}</span></h2>
      <div className="document-section"><h3>The opportunity</h3><p>{brief.description || "Event context to be completed by the organizer."}</p></div>
      <div className="document-section"><h3>{draft.concept}</h3><p>{draft.experience}</p></div>
      <div className="document-section"><h3>A role for {candidate.name}</h3><p>{draft.ask}</p></div>
      <div className="document-section"><h3>Why explore it</h3><p>{selected?.support.length ? `Qloo returned cultural descriptors including ${selected.support.map(t => t.name).join(", ")}. These informed the proposed role.` : "The brand appeared in the event's Qloo search. The creative direction still needs validation."}</p><p>{investigation.verdict === "connections-found" ? "Direct cultural connections were found in the follow-up research. They do not establish sponsorship intent or audience overlap." : "No exact connection to the event's seed interests was found in the follow-up research. This remains an exploratory proposal."}</p></div>
      <div className="document-section"><h3>Before moving forward</h3><p>{draft.validation}</p><p>{draft.measurement}</p></div>
      <details className="document-appendix" ref={appendix}><summary>Source appendix</summary><p>Qloo entity: {candidate.id}<br />Raw discovery affinity: {candidate.affinity ?? "Not returned"} (not a fit percentage)<br />Discovery run: {research.generatedAt}<br />Investigation run: {investigation.generatedAt}<br />Location query: {research.locationApplied ? brief.location : "None"}</p><p>Resolved event seeds: {research.seeds.map(s => `${s.name} [${s.id}]`).join("; ")}</p><p>{investigation.summary}</p>{investigation.branches.map(branch => <p key={branch.id}>{branch.label}: {branch.status}. {branch.endpoint} · seed {candidate.id}. {branch.records.slice(0, 4).map(r => `${r.name} [${r.id}]`).join("; ")}</p>)}<p>The Markdown export includes every returned record and query parameter.</p></details><div className="document-foot">Proposed partnership. Fees, rights, availability and outcomes remain unconfirmed.</div>
    </article><aside className="proposal-actions"><h3>Ready for your review.</h3><p>Export the idea, email and evidence together.</p><button className="action action-dark full" onClick={onExport}><ArrowDownToLine size={15} />Export approach</button><button className="action action-plain full" onClick={() => window.print()}><FileText size={15} />Print / save as PDF</button><button className="text-action" onClick={() => setView("edit")}><Pencil size={15} />Back to idea & email</button></aside></div>}
  </div>;
}
