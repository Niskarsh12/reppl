"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, ArrowRight, Check, Fingerprint, Plus } from "lucide-react";
import { Brand } from "./Brand";

const previews = [
  { title: "Define the culture.", label: "Event brief", copy: "Capture the culture and what partners could support.", tags: ["Vinyl & DJ culture", "Makers workshop", "Hospitality area"] },
  { title: "Find your prospects.", label: "Find partners", copy: "Qloo finds brands connected to your event’s culture. Choose one to explore.", tags: ["Real brand records", "Cultural connections", "Live Qloo search"] },
  { title: "Test the connection.", label: "Check the fit", copy: "See a possible role, the supporting evidence and the question to ask next.", tags: ["Possible role", "Cultural evidence", "Open question"] },
  { title: "Make the approach.", label: "Prepare the approach", copy: "Turn the idea into an opening email and a proposal. Edit, review and export.", tags: ["Specific brand role", "Opening email", "Evidence appendix"] },
];

export function Marketing() {
  const [preview, setPreview] = useState(0);
  const p = previews[preview];
  return <div className="marketing">
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="marketing-nav page-width"><Brand /><nav aria-label="Main navigation"><a href="#workflow">How it works</a><a href="#evidence">The evidence</a><Link href="/workspace">Open workspace <ArrowUpRight size={16} /></Link></nav><Link className="action action-dark nav-cta" href="/workspace">Build your brief <ArrowUpRight size={16} /></Link></header>
    <main id="main">
      <section className="hero page-width">
        <div className="hero-intro"><h1>Culture first.<br /><em>Partnerships follow.</em></h1><div className="hero-bottom"><p>Find brands that fit your event. Give each one a specific reason to get involved.</p><div><Link className="action action-dark" href="/workspace">Build a partnership <ArrowUpRight size={18} /></Link><Link className="text-action" href="/workspace?example=1">Try the demo <ArrowRight size={16} /></Link></div></div></div>
        <div className="hero-board" aria-label="Example partnership workflow">
          <div className="event-art"><div className="poster-top"><ArrowUpRight size={24} /></div><div className="poster-title">AFTER<br /><span>HOURS</span></div><div className="poster-bottom"><span>Illustrative event brief.<br />Independent music & creative culture.</span><span>London<br />Culture festival</span></div></div>
          <div className="preview-sheet" data-ui><div className="preview-top"><span><span className="signal-dot" /> Partnership Architect</span><span>Example workflow</span></div><div className="preview-event"><Fingerprint size={20} /><span>After Hours <small>London · Independent culture festival</small></span></div><div className="preview-trail"><span>Event brief</span><ArrowRight size={16} /><span>Qloo research</span><ArrowRight size={16} /><span>Specific approach</span></div><div className="preview-body"><div className="preview-number">0{preview + 1}</div><div><span className="overline">{p.label}</span><h2>{p.title}</h2><p>{p.copy}</p><div className="preview-tags">{p.tags.map(t => <span key={t}>{t}</span>)}</div></div></div><div className="preview-tabs" aria-label="Explore the workflow">{previews.map((item, i) => <button key={item.label} onClick={() => setPreview(i)} aria-pressed={preview === i}><span>0{i + 1}</span> {item.label}{preview === i && <ArrowUpRight size={15} />}</button>)}</div></div>
        </div>
        <div className="audience-line"><span>Built for the people behind the experience.</span><div><span>Event organizers</span><Plus size={13} /><span>Rights holders</span><Plus size={13} /><span>Experiential agencies</span></div></div>
      </section>
      <section id="workflow" className="workflow-section page-width"><div className="section-intro"><h2>Better leads.<br />A better pitch.</h2><p>You have an event to fund. Brands need a reason to care. Reppl helps you find that common ground.</p></div><div className="workflow-stories">
        <article><h3>Your event is the starting point.</h3><p>Capture its cultural DNA. Use interests and reference artists to seed a Qloo search for brands connected to that world.</p><div className="mini-ui" data-ui><span className="mini-label">Cultural inputs · organizer supplied</span><strong>Vinyl & DJ culture</strong><div className="mini-connection"><span />Resolve to Qloo interest<span /></div><span className="mini-label">A traceable seed for discovery</span></div></article>
        <article><h3>Know what backs the match.</h3><p>Investigate brand-seeded music and lifestyle signals. See direct connections, missing evidence and the strongest question before the pitch.</p><div className="mini-ui" data-ui><div className="mini-evidence"><Check size={17} /><span>Entity ID and source</span></div><div className="mini-evidence"><Check size={17} /><span>Retrieved cultural tags</span></div><div className="mini-evidence muted"><span>—</span><span>Commercial availability unverified</span></div></div></article>
        <article><h3>Give each brand a reason to talk.</h3><p>Shape a distinct role, address the weak points and prepare an opening email. Export the proposal when you are ready.</p><div className="mini-ui proposal-mini" data-ui><span className="mini-label">Partnership proposal</span><strong>A role in the experience.</strong><p>A specific role + an opening email + the evidence.</p><span className="mini-label">Editable. Exportable. Yours.</span></div></article>
      </div></section>
      <section id="evidence" className="evidence-section"><div className="page-width evidence-layout"><div><h2>Evidence into<br />opportunity.</h2><p>Qloo provides cultural intelligence. You bring the context and commercial judgment. Reppl keeps the distinction visible.</p><a className="text-action" href="https://www.qloo.com/" target="_blank" rel="noreferrer">About Qloo <ArrowUpRight size={16} /></a></div><div className="evidence-principles"><div><div><h3>Retrieved evidence</h3><p>Real Qloo entity records, returned tags and raw affinity when available. Every research run retains its seeds and retrieval time.</p></div></div><div><div><h3>Creative hypotheses</h3><p>Activation ideas are starting points to develop and validate. Cultural affinity is never presented as proven audience overlap.</p></div></div><div><div><h3>Commercial reality</h3><p>Availability, rights, fees and ROI need their own evidence. A cultural connection is an invitation to investigate.</p></div></div></div></div></section>
      <section className="closing page-width"><span className="overline">The right partnership starts with understanding.</span><h2>Find your common ground.</h2><Link className="action action-dark" href="/workspace">Build your event brief <ArrowUpRight size={18} /></Link><p>No invented scores. No made-up sponsors. A better starting point.</p></section>
    </main><footer className="marketing-footer page-width"><Brand /><span>Cultural intelligence. Commercial imagination.</span><Link href="/workspace?example=1">Try the Partnership Architect <ArrowUpRight size={14} /></Link></footer>
  </div>;
}
