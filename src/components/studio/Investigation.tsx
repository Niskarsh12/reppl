"use client";

import { ArrowLeft, ArrowRight, CircleHelp, LoaderCircle, Search } from "lucide-react";
import type { BrandInvestigation, EventBrief, PartnershipCandidate, PartnershipResearch } from "@/lib/partnerships/types";
import { roleOptions } from "@/lib/partnerships/strategy";

export function Investigation({ brief, candidate, research, investigation, busy, onRun, onCancel, onBack, onContinue, onEdit }: {
  brief: EventBrief; candidate: PartnershipCandidate; research: PartnershipResearch; investigation?: BrandInvestigation; busy: boolean;
  onRun: () => void; onCancel: () => void; onBack: () => void; onContinue: () => void; onEdit: () => void;
}) {
  const option = roleOptions(brief, candidate, investigation)[0];
  const failed = investigation?.branches.some(b => b.status === "failed");
  const descriptors = [...new Set((option?.support.length ? option.support : candidate.tags).map(t => t.name))].slice(0, 3);
  const status = investigation?.verdict === "connections-found" ? "Cultural connection found" : investigation?.verdict === "needs-validation" ? "Worth a closer look" : "More evidence needed";
  const explanation = investigation?.verdict === "connections-found"
    ? `Qloo connected this brand to ${investigation.connections.slice(0, 3).map(c => c.input).join(", ")}.`
    : investigation?.verdict === "needs-validation"
      ? "Qloo returned cultural context, but no exact link to your event’s interests. Treat this as an exploratory pitch."
      : "The follow-up search added little evidence. Validate the cultural case before making a confident pitch.";

  return <div className="decision-view">
    <button className="text-action context-back" onClick={onBack}><ArrowLeft size={15} />Back to brands</button>
    <div className="decision-identity"><span className="brand-initial">{candidate.name.slice(0, 2)}</span><div><h2>{candidate.name}</h2><p>Potential partner for {brief.name}</p></div></div>
    {busy ? <div className="decision-loading" role="status"><LoaderCircle size={24} className="spin" /><div><h3>Checking the cultural connection</h3><p>Looking up this brand’s music and lifestyle signals in Qloo.</p></div><button className="text-action" onClick={onCancel}>Cancel</button></div> : !investigation ? <div className="decision-loading"><Search size={24} /><div><h3>Take a closer look.</h3><p>Check the evidence before choosing a partnership idea.</p></div><button className="action action-dark" onClick={onRun}>Check the fit <ArrowRight size={15} /></button></div> : <>
      <div className="decision-card">
        <section className="decision-idea"><span className="quiet-label">A role to explore</span><h3>{option?.asset.concept || "Define the experience"}</h3><p>{option ? `Invite ${candidate.name} to support ${option.asset.activity} at ${brief.name}.` : "Confirm an available event experience before building the approach."}</p>{option ? <div className="decision-asset"><span>{option.asset.name}</span><small>Available at your event</small></div> : <button className="action action-plain" onClick={onEdit}>Add an event experience</button>}<span className="hypothesis-label">Proposed idea · needs brand approval</span></section>
        <section className="decision-case"><div><span className="quiet-label">Why explore it?</span><h3>{status}</h3><p>{explanation}</p>{descriptors.length > 0 && <div className="tag-wrap">{descriptors.map(name => <span key={name}>{name}</span>)}</div>}{failed && <p className="partial-evidence"><CircleHelp size={14} />Some research sources were unavailable.</p>}</div><div className="decision-question"><span className="quiet-label">Ask before pitching</span><p>{option ? `Would ${option.asset.name.toLowerCase()} support ${candidate.name}’s current plans?` : `What would ${candidate.name} want to achieve at this event?`}</p></div></section>
      </div>
      <div className="decision-actions"><p>Interest, budget and availability are unconfirmed.</p><button className="action action-dark" disabled={!option} onClick={onContinue}>Build the approach <ArrowRight size={16} /></button></div>
    </>}

    <details className="decision-evidence"><summary>View evidence <span>Qloo sources, signals & limitations</span></summary>
      <div className="evidence-intro"><p>{candidate.description || "No brand description was returned."}</p><dl className="evidence-details"><div><dt>Qloo entity ID</dt><dd>{candidate.id}</dd></div><div><dt>Raw affinity</dt><dd>{candidate.affinity ?? "Not returned"}</dd></div><div><dt>Discovery run</dt><dd>{new Date(research.generatedAt).toLocaleString()}</dd></div></dl><p>Raw affinity is not a fit percentage or audience overlap. Entity tags describe cultural context, not sponsorship intent.</p></div>
      {investigation && <><div className="evidence-assessment"><h3>Research assessment</h3><p>{investigation.summary}</p><ul>{investigation.limitations.map(l => <li key={l}>{l}</li>)}</ul></div>
        <div className="connection-findings"><h3>Direct connections</h3>{investigation.connections.length ? investigation.connections.map(c => <div key={`${c.id}-${c.input}`}><span>{c.input}</span><ArrowRight size={14} /><span>{c.name}<small>{c.source} · {c.matchedBy === "id" ? "Same returned ID" : "Same label; IDs may differ"}</small></span></div>) : <p>No exact ID or canonical-label match was found. Absence is unknown affinity, not proof of poor fit.</p>}</div>
        <div className="research-branches">{investigation.branches.map(branch => <article key={branch.id}><h3>{branch.label} <span className="branch-result">{branch.status === "retrieved" ? `${branch.records.length} records` : branch.status}</span></h3><p>{branch.note}</p><div className="tag-wrap">{branch.records.map(record => <span key={record.id} title={record.id}>{record.name}</span>)}</div><details><summary>Query & record IDs</summary><p>Qloo {branch.endpoint}</p><code>{JSON.stringify(branch.params, null, 2)}</code>{branch.records.map(record => <p className="source-record" key={record.id}>{record.name}<code>{record.id}</code>{record.affinity !== undefined && <span>Raw affinity: {record.affinity}</span>}</p>)}</details></article>)}</div>
        <button className="text-action" disabled={busy} onClick={onRun}>{failed ? "Retry research" : "Refresh research"}<Search size={14} /></button>
      </>}
      <details className="original-evidence"><summary>Discovery tags & event seeds</summary><div className="tag-wrap">{candidate.tags.map(tag => <span key={tag.id} title={tag.id}>{tag.name}</span>)}</div><p>{research.seeds.map(s => `${s.name} [${s.id}]`).join("; ")}</p><p>Investigation run: {investigation?.generatedAt || "Not completed"}</p></details>
    </details>
  </div>;
}
