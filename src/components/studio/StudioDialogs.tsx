"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, Check, X } from "lucide-react";
import { SCENE_LABELS } from "@/lib/campaign/catalog";
import { ASSETS } from "@/lib/partnerships/strategy";
import type { EventBrief } from "@/lib/partnerships/types";

export function StudioDialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => { dialog?.close(); previous?.focus(); };
  }, []);
  return <div className="modal-backdrop"><dialog ref={ref} className="studio-dialog" aria-labelledby="dialog-title" onCancel={onClose} onClick={e => {
    if (e.target !== e.currentTarget) return;
    const r = e.currentTarget.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose();
  }}>
    <div className="dialog-heading"><h2 id="dialog-title">{title}</h2><button aria-label="Close dialog" onClick={onClose}><X size={20} /></button></div>
    {children}
  </dialog></div>;
}

export function BriefEditor({ brief, onClose, onSave, hasResearch }: { brief: EventBrief; onClose: () => void; onSave: (value: EventBrief) => void; hasResearch: boolean }) {
  const [value, setValue] = useState(brief);
  const [error, setError] = useState("");
  function change<K extends keyof EventBrief>(key: K, next: EventBrief[K]) { setValue(v => ({ ...v, [key]: next })); }
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!value.name.trim() || !value.scenes.length || !value.assets?.length) {
      setError("Add an event name, at least one cultural interest and one available experience.");
      return;
    }
    onSave({ ...value, name: value.name.trim() });
  }
  return <StudioDialog title="Event brief" onClose={onClose}><form className="brief-form" onSubmit={submit}>
    <p>Start with the culture and what a partner could support.</p>
    <label>Event name <span>Required</span><input required autoFocus maxLength={100} placeholder="e.g. After Hours" value={value.name} onChange={e => change("name", e.target.value)} /></label>
    <fieldset><legend>Cultural interests <span>Choose 1–8</span></legend><div className="scene-picker">{SCENE_LABELS.map(scene => <button type="button" key={scene} aria-pressed={value.scenes.includes(scene)} disabled={!value.scenes.includes(scene) && value.scenes.length >= 8} onClick={() => change("scenes", value.scenes.includes(scene) ? value.scenes.filter(s => s !== scene) : [...value.scenes, scene])}>{value.scenes.includes(scene) && <Check size={13} />}{scene}</button>)}</div></fieldset>
    <fieldset><legend>What can partners support? <span>Choose at least one</span></legend><div className="asset-picker">{ASSETS.map(asset => <button type="button" key={asset.id} aria-pressed={value.assets?.includes(asset.id) || false} onClick={() => change("assets", value.assets?.includes(asset.id) ? value.assets.filter(id => id !== asset.id) : [...(value.assets || []), asset.id])}><span className="check-box">{value.assets?.includes(asset.id) && <Check size={13} />}</span>{asset.name}</button>)}</div></fieldset>
    <details className="brief-optional"><summary>Add context <span>Location, story, artists & goal</span></summary>
    <label>City or region<input maxLength={90} placeholder="e.g. London" value={value.location} onChange={e => change("location", e.target.value)} /></label>
    <label>Event story<textarea rows={3} maxLength={3000} placeholder="Your format and creative community…" value={value.description} onChange={e => change("description", e.target.value)} /></label>
    <label>Reference artists <span>Optional · comma separated, up to 5</span><input maxLength={300} placeholder="Artist names to resolve in Qloo" value={value.artists} onChange={e => change("artists", e.target.value)} /></label>
    <label>Partnership ambition<textarea rows={2} maxLength={1000} placeholder="What should the right partnership make possible?" value={value.objective} onChange={e => change("objective", e.target.value)} /></label>
    </details>
    {hasResearch && <p className="edit-warning">Changing the brief resets its research and drafts. Export anything you want to keep first.</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="dialog-actions"><button type="button" className="action action-plain" onClick={onClose}>Cancel</button><button type="submit" className="action action-dark">Save event brief <ArrowRight size={15} /></button></div>
  </form></StudioDialog>;
}
