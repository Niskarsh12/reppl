"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpRight, Bookmark, Check, CheckCheck, ChevronRight, CircleHelp, Fingerprint, LoaderCircle, MapPin, Pencil, Plus, Search, X } from "lucide-react";
import { SCENE_LABELS } from "@/lib/campaign/catalog";
import { ASSETS, availableAssets, createDraft, exportApproach, type PartnershipDraft } from "@/lib/partnerships/strategy";
import { EMPTY_BRIEF, EXAMPLE_BRIEF, type BrandInvestigation, type EventBrief, type PartnershipCandidate, type PartnershipResearch } from "@/lib/partnerships/types";
import { Brand } from "./Brand";
import { BriefEditor, StudioDialog } from "./StudioDialogs";
import { Investigation } from "./Investigation";
import { Approach } from "./Approach";

type Step = "brief" | "discover" | "investigate" | "approach";
interface Project {
  brief: EventBrief; research: PartnershipResearch | null;
  investigations: Record<string, BrandInvestigation>; drafts: Record<string, PartnershipDraft>;
  selected: string | null; partners: string[]; example: boolean;
}
const INITIAL: Project = { brief: EMPTY_BRIEF, research: null, investigations: {}, drafts: {}, selected: null, partners: [], example: false };
const STEPS = [
  { id: "brief" as const, name: "Event brief", short: "Event" },
  { id: "discover" as const, name: "Find partners", short: "Partners" },
  { id: "investigate" as const, name: "Check the fit", short: "Fit" },
  { id: "approach" as const, name: "Prepare the approach", short: "Approach" },
];
const STORAGE = "reppl:architect:v2";
const isStep = (s: string | null): s is Step => STEPS.some(step => step.id === s);

function canEnter(step: Step, p: Project) {
  const candidate = p.research?.candidates.find(c => c.id === p.selected);
  if (step === "brief") return true;
  if (step === "discover") return Boolean(p.brief.name && p.brief.scenes.length && availableAssets(p.brief).length);
  if (step === "investigate") return Boolean(candidate);
  return Boolean(candidate && p.investigations[candidate.id] && p.partners.includes(candidate.id) && availableAssets(p.brief).length);
}

function restoreProject(value: unknown): Project | null {
  if (!value || typeof value !== "object") return null;
  const p = value as Partial<Project>;
  const b = p.brief;
  if (!b || ![b.name, b.location, b.description, b.artists, b.objective].every(s => typeof s === "string") || !Array.isArray(b.scenes) || !b.scenes.every(s => SCENE_LABELS.includes(s))) return null;
  const research = p.research;
  if (research && (!Array.isArray(research.candidates) || !Array.isArray(research.seeds) || !research.candidates.every(c => typeof c.id === "string" && typeof c.name === "string" && Array.isArray(c.tags)))) return null;
  const ids = new Set(research?.candidates.map(c => c.id) || []);
  const investigations = Object.fromEntries(Object.entries(p.investigations || {}).filter(([id, i]) => ids.has(id) && i.candidateId === id && Array.isArray(i.branches) && Array.isArray(i.connections)));
  return { brief: { ...b, assets: ASSETS.filter(a => b.assets?.includes(a.id)).map(a => a.id) }, research: research || null, investigations, drafts: p.drafts && typeof p.drafts === "object" ? p.drafts : {}, selected: p.selected && ids.has(p.selected) ? p.selected : null, partners: Array.isArray(p.partners) ? p.partners.filter(id => ids.has(id)) : [], example: Boolean(p.example) };
}

export function Workspace() {
  const params = useSearchParams();
  // A mode switch remounts the project, while step changes preserve its state.
  return <ArchitectWorkspace key={params.get("example") === "1" ? "example" : "real"} />;
}

function ArchitectWorkspace() {
  const [project, setProject] = useState<Project>(INITIAL);
  const [step, setStep] = useState<Step>("brief");
  const [ready, setReady] = useState(false);
  const [storageKey, setStorageKey] = useState(STORAGE);
  const [saveStatus, setSaveStatus] = useState("Saved locally");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [editing, setEditing] = useState(false);
  const [help, setHelp] = useState(false);
  const [busy, setBusy] = useState<"discovery" | "investigation" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [onlyPartners, setOnlyPartners] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const projectRef = useRef(project);
  const controller = useRef<AbortController | null>(null);
  const { brief, research, investigations, partners, selected } = project;
  const candidates = research?.candidates || [];
  const candidate = candidates.find(c => c.id === selected);
  const investigation = selected ? investigations[selected] : undefined;
  const chosen = candidates.filter(c => partners.includes(c.id));
  const draft = candidate ? { ...createDraft(brief, candidate, investigation), ...project.drafts[candidate.id] } : null;
  const filtered = candidates.filter(c => (!onlyPartners || partners.includes(c.id)) && `${c.name} ${c.tags.map(t => t.name).join(" ")}`.toLowerCase().includes(query.toLowerCase()));
  const visible = expanded || query || onlyPartners ? filtered : filtered.slice(0, 6);

  useEffect(() => { projectRef.current = project; }, [project]);
  useEffect(() => {
    let active = true;
    const status = new AbortController();
    void Promise.resolve().then(() => {
      if (!active) return;
      const params = new URLSearchParams(window.location.search);
      const example = params.get("example") === "1";
      const key = example ? `${STORAGE}:example` : STORAGE;
      let restored: Project | null = null;
      try {
        const raw = localStorage.getItem(key);
        if (raw) restored = restoreProject(JSON.parse(raw));
        if (!restored && !example) {
          const legacy = localStorage.getItem("reppl:partnership-studio:v1");
          if (legacy) { const p = JSON.parse(legacy); restored = restoreProject({ ...p, partners: p.shortlist || [], investigations: {}, selected: null }); }
        }
      } catch { /* Corrupt or unavailable storage must not block onboarding. */ }
      const next = restored || (example ? { ...INITIAL, brief: EXAMPLE_BRIEF, example: true } : INITIAL);
      const requested = params.get("step");
      if (params.get("brand") && next.research?.candidates.some(c => c.id === params.get("brand"))) next.selected = params.get("brand");
      const initialStep = isStep(requested) && canEnter(requested, next) ? requested : "brief";
      setProject(next); setStorageKey(key); setStep(initialStep); setReady(true); projectRef.current = next;
      const url = new URL(window.location.href); url.searchParams.set("step", initialStep);
      window.history.replaceState({}, "", url);
    });
    fetch("/api/partnerships", { signal: status.signal }).then(r => r.json()).then(s => setConfigured(s.configured === true)).catch(() => {});
    const onPop = () => {
      const params = new URLSearchParams(window.location.search);
      const p = projectRef.current;
      const brand = params.get("brand");
      const next = brand && p.research?.candidates.some(c => c.id === brand) ? { ...p, selected: brand } : p;
      const wanted = params.get("step");
      setProject(next); setStep(isStep(wanted) && canEnter(wanted, next) ? wanted : "brief"); setError(""); setNotice("");
    };
    window.addEventListener("popstate", onPop);
    return () => { active = false; status.abort(); controller.current?.abort(); window.removeEventListener("popstate", onPop); };
  }, []);
  useEffect(() => {
    if (!ready) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      try { localStorage.setItem(storageKey, JSON.stringify(project)); setSaveStatus("Saved locally"); }
      catch { setSaveStatus("Storage unavailable · export to keep your work"); }
    });
    return () => { active = false; };
  }, [project, ready, storageKey]);
  useEffect(() => {
    if (!ready) return;
    document.title = `${STEPS.find(s => s.id === step)?.name} · Reppl`;
    document.getElementById("workspace-title")?.focus({ preventScroll: true });
  }, [step, ready]);

  function navigate(next: Step, p = project) {
    if (!canEnter(next, p)) {
      setNotice(next === "discover" ? "Add an event and an available experience first." : next === "investigate" ? "Choose a brand first." : "Check the fit before building an approach."); return;
    }
    if (busy && next !== step) { controller.current?.abort(); controller.current = null; setBusy(null); }
    setStep(next); setError(""); setNotice("");
    const url = new URL(window.location.href); url.searchParams.set("step", next);
    if (p.selected && (next === "investigate" || next === "approach")) url.searchParams.set("brand", p.selected); else url.searchParams.delete("brand");
    window.history.pushState({}, "", url); window.scrollTo({ top: 0, behavior: "instant" });
  }
  function cancel() { controller.current?.abort(); controller.current = null; setBusy(null); setNotice("Research cancelled. Your work is saved."); }
  function saveBrief(value: EventBrief) {
    if (JSON.stringify(value) !== JSON.stringify(brief)) {
      controller.current?.abort(); controller.current = null; setBusy(null);
      setProject(p => ({ ...INITIAL, brief: value, example: p.example })); setStep("brief");
      const url = new URL(window.location.href); url.searchParams.set("step", "brief"); url.searchParams.delete("brand"); window.history.replaceState({}, "", url);
      setNotice("Brief saved.");
    }
    setEditing(false); setError("");
  }
  async function discover() {
    if (!brief.name || !brief.scenes.length || !availableAssets(brief).length) { setEditing(true); return; }
    controller.current?.abort(); const request = new AbortController(); controller.current = request;
    setBusy("discovery"); setError(""); navigate("discover");
    try {
      const r = await fetch("/api/partnerships", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(brief), signal: request.signal });
      const data = await r.json(); if (!r.ok) throw new Error(data.error || "Discovery could not finish.");
      if (request.signal.aborted) return;
      const ids = new Set((data as PartnershipResearch).candidates.map(c => c.id));
      setProject(p => ({ ...p, research: data, selected: p.selected && ids.has(p.selected) ? p.selected : null, partners: p.partners.filter(id => ids.has(id)), investigations: Object.fromEntries(Object.entries(p.investigations).filter(([id]) => ids.has(id))), drafts: Object.fromEntries(Object.entries(p.drafts).filter(([id]) => ids.has(id))) }));
    } catch (e) { if (!request.signal.aborted) setError(e instanceof Error ? e.message : "Discovery could not finish. Try again."); }
    finally { if (controller.current === request) { setBusy(null); controller.current = null; } }
  }
  function selectBrand(c: PartnershipCandidate) {
    if (busy) cancel();
    const next = { ...project, selected: c.id }; setProject(next); navigate("investigate", next);
    if (!project.investigations[c.id]) void investigate(c);
  }
  async function investigate(target = candidate) {
    if (!target) return;
    const id = target.id;
    controller.current?.abort(); const request = new AbortController(); controller.current = request;
    setBusy("investigation"); setError(""); setNotice("");
    try {
      const r = await fetch("/api/partnerships/investigate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brief, candidateId: id }), signal: request.signal });
      const data = await r.json(); if (!r.ok) throw new Error(data.error || "Investigation could not finish.");
      if (request.signal.aborted) return;
      setProject(p => ({ ...p, investigations: { ...p.investigations, [id]: data } }));
    } catch (e) { if (!request.signal.aborted) setError(e instanceof Error ? e.message : "Investigation could not finish. Try again."); }
    finally { if (controller.current === request) { setBusy(null); controller.current = null; } }
  }
  function usePartnership() {
    if (!candidate || !investigation || !availableAssets(brief).length) return;
    const next = { ...project, partners: [...new Set([...partners, candidate.id])], drafts: { ...project.drafts, [candidate.id]: draft || createDraft(brief, candidate, investigation) } };
    setProject(next); navigate("approach", next);
  }
  function updateDraft(key: keyof PartnershipDraft, value: string) {
    if (!candidate || !draft) return;
    setProject(p => ({ ...p, drafts: { ...p.drafts, [candidate.id]: { ...draft, [key]: value } } }));
  }
  function changeRole(roleId: string) {
    if (!candidate || !draft) return;
    const oldDefault = createDraft(brief, candidate, investigation, draft.roleId);
    const next = { ...createDraft(brief, candidate, investigation, roleId) };
    for (const field of Object.keys(next) as (keyof PartnershipDraft)[]) if (field !== "roleId" && draft[field] !== oldDefault[field]) next[field] = draft[field];
    setProject(p => ({ ...p, drafts: { ...p.drafts, [candidate.id]: next } }));
    setNotice("Role updated. Your edits were kept.");
  }
  function downloadApproach() {
    if (!candidate || !research || !investigation || !draft) return;
    const url = URL.createObjectURL(new Blob([exportApproach(brief, candidate, research, investigation, draft, project.example)], { type: "text/markdown;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `${brief.name}-${candidate.name}-partnership.md`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); setNotice("Exported with email and sources.");
  }
  const currentIndex = STEPS.findIndex(s => s.id === step);
  const completed = (id: Step) => id === "brief" ? Boolean(brief.name && brief.scenes.length && availableAssets(brief).length) : id === "discover" ? Boolean(research) : id === "investigate" ? Boolean(investigation) : Boolean(candidate && partners.includes(candidate.id));

  return <div className="studio-shell architect-shell calm-shell">
    <a className="skip-link" href="#workspace-main">Skip to workspace</a>
    <aside className="studio-sidebar"><Brand /><div className="workspace-label">Partnership Architect</div>
      <button className="event-switcher" onClick={() => setEditing(true)}><span className="event-monogram">{brief.name ? brief.name.slice(0, 2).toUpperCase() : "+"}</span><span>{brief.name || "New event"}{project.example && <small>Example event</small>}</span><Pencil size={14} /></button>
      <nav aria-label="Partnership workflow">{STEPS.map((s, i) => <button key={s.id} className={step === s.id ? "selected" : ""} onClick={() => navigate(s.id)} aria-current={step === s.id ? "step" : undefined} aria-disabled={!canEnter(s.id, project)}><span className={`workflow-number ${completed(s.id) ? "complete" : ""}`}>{completed(s.id) ? <Check size={12} /> : i + 1}</span><span>{s.name}</span></button>)}</nav>
      {chosen.length > 0 && <div className="chosen-partners"><span className="sidebar-group">Your approaches</span>{chosen.map(c => <button key={c.id} onClick={() => { const next = { ...project, selected: c.id }; setProject(next); navigate(investigations[c.id] && availableAssets(brief).length ? "approach" : "investigate", next); }}><Bookmark size={13} /><span>{c.name}</span><ChevronRight size={12} /></button>)}</div>}
      <div className="sidebar-bottom"><div className="connection-state"><span className={`signal-dot ${configured ? "connected" : ""}`} /><span>{configured === null ? "Checking Qloo…" : configured ? "Qloo configured" : "Qloo not configured"}</span></div><button onClick={() => setHelp(true)}><CircleHelp size={16} />How it works</button><Link href="/"><ArrowLeft size={16} />Back to website</Link></div>
    </aside>
    <div className="studio-content"><header className="workspace-topbar"><div className="mobile-brand"><Brand /></div><span><Link href="/">Home</Link><ChevronRight size={13} /><button onClick={() => navigate("brief")}>{brief.name || "New event"}</button>{candidate && (step === "investigate" || step === "approach") && <><ChevronRight size={13} /><span>{candidate.name}</span></>}</span><span className="save-state"><CheckCheck size={14} />{saveStatus}</span></header>
      <main id="workspace-main" className="workspace-sheet">
        <div className="workspace-heading"><div><span className="quiet-label">Step {currentIndex + 1} of 4 {project.example && <span className="example-label">Example</span>}</span><h1 id="workspace-title" tabIndex={-1}>{STEPS[currentIndex].name}</h1><p>{step === "brief" ? project.example ? "A music and makers festival needs partners who add to the experience." : "Your culture, and what a partner could support." : step === "discover" ? "Choose a brand to explore. These are prospects, not confirmed sponsors." : step === "investigate" ? "A possible role, the evidence, and the question to ask." : "Give this brand a specific reason to talk."}</p></div>{step === "brief" && brief.name && <button className="action action-plain" onClick={() => setEditing(true)}><Pencil size={14} />Edit brief</button>}{step === "discover" && research && <button className="text-action" onClick={discover} disabled={Boolean(busy)}><Search size={15} />Refresh</button>}</div>
        <nav className="journey-progress" aria-label="Your progress">{STEPS.map((s, i) => <button key={s.id} aria-label={s.name} aria-current={step === s.id ? "step" : undefined} aria-disabled={!canEnter(s.id, project)} onClick={() => navigate(s.id)}><span className={`workflow-number ${completed(s.id) ? "complete" : ""}`}>{completed(s.id) ? <Check size={12} /> : i + 1}</span><span>{s.short}</span></button>)}</nav>
        {!ready && <div className="workspace-restoring" role="status"><LoaderCircle className="spin" size={20} />Opening your workspace…</div>}
        {notice && <div className="notice" role="status"><Check size={16} />{notice}<button aria-label="Dismiss notification" onClick={() => setNotice("")}><X size={15} /></button></div>}
        {error && <div className="error-notice" role="alert"><CircleHelp size={18} /><div><strong>Research needs attention</strong><p>{error}</p><small>Your saved work is unchanged.</small></div></div>}
        {ready && step === "brief" && <>{brief.name ? <>
          <div className="brief-mobile-action"><button className="action action-dark" onClick={discover}>Find partners <ArrowRight size={16} /></button></div>
          <div className="culture-grid"><section className="event-profile"><div className="event-profile-art"><span>{project.example ? "Example event" : "Your event"}</span><div>{brief.name}<Fingerprint size={58} strokeWidth={1} aria-hidden="true" /></div><span><MapPin size={14} />{brief.location || "Location not set"}</span></div><details className="event-story"><summary>Event story & goal</summary><p>{brief.description || "No event description added."}</p>{brief.objective && <p><strong>Goal:</strong> {brief.objective}</p>}{brief.artists && <p><strong>Reference artists:</strong> {brief.artists}</p>}</details></section>
          <section className="culture-inputs"><h2>The culture</h2><div className="tag-wrap brief-scenes">{brief.scenes.map(s => <span key={s}>{s}</span>)}</div><h3 className="asset-heading">What a partner could support</h3>{availableAssets(brief).length ? <div className="confirmed-assets">{availableAssets(brief).map(asset => <div key={asset.id}><Check size={15} /><span>{asset.name}</span></div>)}</div> : <div className="missing-assets"><p>Add an experience your event can offer.</p><button className="text-action" onClick={() => setEditing(true)}>Add experiences <Plus size={14} /></button></div>}<div className="culture-next"><button className="action action-dark" onClick={discover}>Find partners <ArrowRight size={16} /></button></div></section></div>
        </> : <div className="first-brief"><Fingerprint size={36} strokeWidth={1} /><h2>Find your next partnership.</h2><p>Start with an event. Leave with brands to explore and a specific pitch for each.</p><div><button className="action action-dark" onClick={() => setEditing(true)}>Create an event <Plus size={16} /></button><Link className="action action-plain" href="/workspace?example=1">Try the demo <ArrowUpRight size={16} /></Link></div></div>}</>}
        {ready && step === "discover" && <>
          {busy === "discovery" && <div className="research-loading" role="status"><LoaderCircle className="spin" size={24} /><div><h2>Finding brands with Qloo</h2><p>Using your event’s cultural interests.</p></div><button className="text-action" onClick={cancel}>Cancel</button></div>}
          {research ? <><div className="candidate-toolbar"><label className="search-control"><Search size={16} /><input aria-label="Search brand prospects" placeholder="Search brands" value={query} onChange={e => setQuery(e.target.value)} /></label>{chosen.length > 0 && <button className={`filter-button ${onlyPartners ? "active" : ""}`} onClick={() => setOnlyPartners(v => !v)} aria-pressed={onlyPartners}><Bookmark size={15} />Selected ({chosen.length})</button>}</div><div className="results-summary"><span>{filtered.length} {onlyPartners ? "selected" : "brands to explore"}</span><span>From Qloo · {new Date(research.generatedAt).toLocaleDateString()}</span></div>
            <div className="prospect-list">{visible.map(c => <article className="prospect-row" key={c.id}><span className="brand-initial">{c.name.slice(0, 2)}</span><div className="prospect-copy"><h2>{c.name}</h2><p>{[...new Set(c.tags.map(t => t.name))].slice(0, 2).join(" · ") || "Open the cultural research"}</p>{partners.includes(c.id) && <span>Approach saved</span>}</div><button className="action action-plain" disabled={Boolean(busy)} onClick={() => selectBrand(c)}>Explore <ArrowRight size={14} /></button></article>)}</div>
            {!visible.length && <div className="no-results"><h3>No brands in this view</h3><p>Try another search or broaden the event’s interests.</p></div>}{!expanded && !query && !onlyPartners && filtered.length > 6 && <button className="text-action show-prospects" onClick={() => setExpanded(true)}>Show all {filtered.length} brands <ArrowDownToLine size={14} /></button>}
            <details className="research-provenance"><summary>View search evidence</summary><p>Retrieved {new Date(research.generatedAt).toLocaleString()}. Raw affinity is available in each brand’s evidence panel.</p><div className="seed-list">{research.seeds.map(seed => <div key={seed.id}><span>{seed.name}<small>Resolved {seed.kind}</small></span><code>{seed.id}</code></div>)}</div>{research.unresolved.length > 0 && <p className="unresolved">Excluded inputs: {research.unresolved.join(", ")}</p>}{research.notes.map(note => <p key={note}>{note}</p>)}</details>
          </> : busy !== "discovery" && <div className="empty-state"><Search size={30} strokeWidth={1} /><h2>Who could belong here?</h2><p>Find brands connected to your event’s culture.</p><button className="action action-dark" onClick={discover}>Find partners <ArrowRight size={16} /></button></div>}
        </>}
        {ready && step === "investigate" && candidate && research && <Investigation brief={brief} candidate={candidate} research={research} investigation={investigation} busy={busy === "investigation"} onRun={() => void investigate()} onCancel={cancel} onBack={() => navigate("discover")} onContinue={usePartnership} onEdit={() => setEditing(true)} />}
        {ready && step === "approach" && candidate && research && investigation && draft && <Approach key={candidate.id} brief={brief} candidate={candidate} research={research} investigation={investigation} draft={draft} example={project.example} onChange={updateDraft} onRole={changeRole} onBack={() => navigate("investigate")} onExport={downloadApproach} />}
      </main><footer className="workspace-footer"><span>Reppl · Partnership Architect</span><button onClick={() => setHelp(true)}>How it works <CircleHelp size={13} /></button></footer>
    </div>
    {editing && <BriefEditor brief={brief} hasResearch={Boolean(research)} onSave={saveBrief} onClose={() => setEditing(false)} />}
    {help && <StudioDialog title="From event to conversation" onClose={() => setHelp(false)}><div className="methodology"><h3>The problem</h3><p>Finding sponsors takes more than a list of brands. Each one needs a relevant reason to get involved.</p><h3>What Reppl does</h3><p>Qloo finds cultural connections. Reppl investigates a brand, suggests a role in your event, and prepares an editable idea, email and proposal.</p><h3>What the evidence means</h3><p>Qloo records are retrieved evidence. Role suggestions and drafts use planning rules; they are hypotheses. Cultural affinity does not prove audience overlap, buying intent or ROI.</p><details><summary>Research method & storage</summary><p>Event interests and reference artists seed Qloo brand discovery. Investigations retrieve brand-seeded music and lifestyle tags. Missing direct links or reference artists trigger an artist cross-check. Exact IDs and canonical labels identify direct connections; failures and missing records stay unknown. Responses may use the private 30-minute Qloo cache.</p><p>Available experiences come from you. Drafts are rule-based and editable. No brand objective, contact, price or commercial commitment is invented. Nothing is sent automatically.</p><p>Work saves in this browser. Example and real events save separately. Export before clearing browser storage.</p><Link className="text-action" href="/campaign">Brand-side campaign tools <ArrowUpRight size={15} /></Link></details></div></StudioDialog>}
  </div>;
}
