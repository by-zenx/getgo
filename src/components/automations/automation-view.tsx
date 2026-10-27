"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type RefObject } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Icon } from "@/components/icons/svg-sprite";
import { moveSegmentPill } from "@/lib/segment-motion";
import { AUTOMATION_ADDABLE_STEPS, AUTOMATION_STORAGE_KEY, AUTOMATION_STEP_TYPES, AUTOMATION_TEMPLATES, automationConversions, automationRevenue, createInitialAutomations, type AutomationFilter, type AutomationRecord, type AutomationRun, type AutomationStep, type AutomationStepKind } from "@/data/automations-data";

function readAutomations(raw: string): AutomationRecord[] | null {
  try {
    const parsed = JSON.parse(raw) as AutomationRecord[];
    return Array.isArray(parsed) && parsed.every((item) => typeof item.id === "string" && typeof item.name === "string" && Array.isArray(item.steps)) ? parsed : null;
  } catch { return null; }
}
function saveAutomations(items: AutomationRecord[]) {
  try { localStorage.setItem(AUTOMATION_STORAGE_KEY, JSON.stringify(items)); }
  catch { /* Keep changes available for the current session. */ }
}
function editedText(at: number) {
  const days = Math.max(0, Math.floor((Date.UTC(2026, 9, 26, 12) - at) / 86400000));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(at);
}
function runTime(at: number) {
  const date = new Date(at);
  const now = Date.UTC(2026, 9, 26, 12);
  const days = Math.floor((now - at) / 86400000);
  if (days === 0) return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(at);
  if (days === 1) return "Yesterday";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(date);
}
function int(value: number) { return Math.round(value).toLocaleString("en-US"); }
function currency(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value); }
function pct(value: number) { return `${(value * 100).toFixed(1)}%`; }

function loadFilterSegment(ref: RefObject<HTMLDivElement | null>, pillRef: RefObject<HTMLSpanElement | null>, value: AutomationFilter, ready: { current: boolean }) {
  const group = ref.current;
  const pill = pillRef.current;
  const active = group?.querySelector<HTMLButtonElement>(`button[data-value="${value}"]`);
  if (!group || !pill || !active) return;
  moveSegmentPill(pill, active, !ready.current);
  ready.current = true;
}

function AutomationFilterTabs({ value, onChange }: { value: AutomationFilter; onChange: (value: AutomationFilter) => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const readyRef = useRef(false);
  useGSAP(() => loadFilterSegment(rootRef, pillRef, value, readyRef), { dependencies: [value], scope: rootRef });
  const values: { value: AutomationFilter; label: string }[] = [{ value: "all", label: "All" }, { value: "active", label: "Active" }, { value: "paused", label: "Paused" }];
  return <div ref={rootRef} className="seg au-filter" role="group" aria-label="Show automations"><span ref={pillRef} className="seg__pill" aria-hidden="true" />{values.map((item) => <button key={item.value} type="button" data-value={item.value} aria-pressed={value === item.value} onClick={() => onChange(item.value)}>{item.label}</button>)}</div>;
}

function FlowPreview({ steps, hue = 208 }: { steps: AutomationStep[]; hue?: number }) {
  return <div className="au-mini" aria-label={`${steps.length} steps: ${steps.map((step) => AUTOMATION_STEP_TYPES[step.kind].name).join(", ")}`}>
    {steps.map((step, index) => <span key={`${step.kind}-${index}`} className="au-mini__group">{index > 0 && <span className="au-mini__line" aria-hidden="true" />}<span className="au-mini__step" style={{ "--h": AUTOMATION_STEP_TYPES[step.kind].hue ?? hue } as CSSProperties} title={step.label} aria-hidden="true"><Icon name={AUTOMATION_STEP_TYPES[step.kind].icon} /></span></span>)}
  </div>;
}

export function AutomationListView() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const createDialogRef = useRef<HTMLDialogElement>(null);
  const [automations, setAutomations] = useState<AutomationRecord[]>(createInitialAutomations);
  const [filter, setFilter] = useState<AutomationFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [templateIndex, setTemplateIndex] = useState(0);
  const [newName, setNewName] = useState(AUTOMATION_TEMPLATES[0].name);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const autosRef = useRef(automations);

  const filtered = automations.filter((automation) => filter === "all" || (filter === "active" ? automation.enabled : !automation.enabled));
  const activeCount = automations.filter((automation) => automation.enabled).length;
  const runCount = automations.reduce((sum, automation) => sum + automation.runs30, 0);
  const conversionCount = automations.reduce((sum, automation) => sum + automationConversions(automation), 0);
  const influencedRevenue = automations.reduce((sum, automation) => sum + automationRevenue(automation), 0);

  useEffect(() => { autosRef.current = automations; }, [automations]);
  useEffect(() => {
    try {
      const stored = localStorage.getItem(AUTOMATION_STORAGE_KEY);
      if (stored) {
        const parsed = readAutomations(stored);
        if (parsed) { setAutomations(parsed); autosRef.current = parsed; }
      } else saveAutomations(createInitialAutomations());
    } catch { /* Use the starter workflows when storage is unavailable. */ }
  }, []);
  const persist = (next: AutomationRecord[]) => { autosRef.current = next; setAutomations(next); saveAutomations(next); };

  useGSAP(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.fromTo(".au-stats .au-stat", { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.42, stagger: 0.055, delay: 0.1, ease: "power3.out", clearProps: "transform,opacity" });
    const cards = rootRef.current?.querySelectorAll<HTMLElement>(".au-card, .au-grid__empty");
    if (cards?.length) gsap.fromTo(cards, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.48, stagger: 0.045, delay: 0.2, ease: "power3.out", clearProps: "transform,opacity" });
    rootRef.current?.querySelectorAll<HTMLElement>(".au-mini__step").forEach((step, index) => gsap.fromTo(step, { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.48, delay: 0.3 + index * 0.025, ease: "back.out(2.2)", clearProps: "transform,opacity" }));
    rootRef.current?.querySelectorAll<HTMLElement>(".au-mini__line").forEach((line, index) => gsap.fromTo(line, { scaleX: 0 }, { scaleX: 1, duration: 0.35, delay: 0.34 + index * 0.025, ease: "power2.out", clearProps: "transform" }));
  }, { dependencies: [filter, automations.map((automation) => `${automation.id}:${automation.enabled}:${automation.steps.length}`).join("|")], scope: rootRef });

  useEffect(() => {
    const dialog = createDialogRef.current;
    if (!dialog) return;
    if (createOpen && !dialog.open) {
      dialog.showModal();
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) gsap.fromTo(dialog.querySelector(".modal__box"), { opacity: 0, y: 14, scale: 0.98 }, { opacity: 1, y: 0, scale: 1, duration: 0.42, ease: "power3.out" });
    } else if (!createOpen && dialog.open) dialog.close();
  }, [createOpen]);

  const toggleAutomation = (id: string, enabled: boolean) => {
    persist(autosRef.current.map((automation) => automation.id === id ? { ...automation, enabled, edited: Date.now() } : automation));
    setToast(enabled ? "Automation turned on" : "Automation paused");
    window.setTimeout(() => setToast(""), 3400);
  };
  const chooseTemplate = (index: number) => { setTemplateIndex(index); setNewName(AUTOMATION_TEMPLATES[index].name); };
  const createAutomation = () => {
    const name = newName.trim();
    if (!name) { setError("Give the automation a name."); return; }
    const template = AUTOMATION_TEMPLATES[templateIndex];
    const numericIds = autosRef.current.map((automation) => Number(automation.id.replace(/^a/, ""))).filter(Number.isFinite);
    const id = `a${Math.max(0, ...numericIds) + 1}`;
    const automation: AutomationRecord = { id, name, desc: template.desc, enabled: false, runs30: 0, conv: 0, edited: Date.now(), hue: template.hue, steps: template.steps.map((step) => ({ ...step })), history: [] };
    persist([automation, ...autosRef.current]);
    setCreateOpen(false);
    router.push(`/automations/${id}`);
  };

  return <div ref={rootRef} data-view="automations" className="view au-list">
    <section className="card statbar au-stats" style={{ "--n": 4 } as CSSProperties} aria-label="Automations at a glance">
      <div className="stat au-stat"><span className="stat__label">Active automations</span><b className="stat__val">{activeCount}</b><span className="stat__meta">of {automations.length} workflows</span></div>
      <div className="stat au-stat"><span className="stat__label">Runs in 30 days</span><b className="stat__val">{int(runCount)}</b><span className="stat__meta">Across active flows</span></div>
      <div className="stat au-stat"><span className="stat__label">Revenue influenced</span><b className="stat__val">{currency(influencedRevenue)}</b><span className="stat__meta">From attributed orders</span></div>
      <div className="stat au-stat"><span className="stat__label">Conversions</span><b className="stat__val">{int(conversionCount)}</b><span className="stat__meta">In the last 30 days</span></div>
    </section>
    <div className="toolbar"><AutomationFilterTabs value={filter} onChange={setFilter} /><div className="toolbar__end"><button className="btn btn--primary" type="button" onClick={() => { setTemplateIndex(0); setNewName(AUTOMATION_TEMPLATES[0].name); setError(""); setCreateOpen(true); }}><Icon name="plus" />New automation</button></div></div>
    <section className="au-grid" aria-label="Automations">
      {filtered.length ? filtered.map((automation) => <article key={automation.id} className={`card au-card${automation.enabled ? "" : " is-off"}`}>
        <div className="au-card__top"><div className="au-card__name"><h3><Link className="au-card__link" href={`/automations/${automation.id}`}>{automation.name}</Link></h3><p>{automation.desc}</p></div><label className="switch" onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={automation.enabled} aria-label={`${automation.name} is on`} onChange={(event) => toggleAutomation(automation.id, event.target.checked)} /><span className="switch__track" /><span className="switch__knob" /></label></div>
        <FlowPreview steps={automation.steps} hue={automation.hue} />
        <dl className="au-card__stats"><div><dt>Runs, 30 days</dt><dd>{int(automation.runs30)}</dd></div><div><dt>Conversion</dt><dd>{automation.runs30 && automation.steps.some((step) => step.kind === "email") ? pct(automation.conv) : "—"}</dd></div><div><dt>Edited</dt><dd>{editedText(automation.edited)}</dd></div></dl>
        <footer className="au-card__foot"><span className={`pill pill--${automation.enabled ? "mint" : "gray"}`}>{automation.enabled ? "Active" : "Paused"}</span><Link className="au-card__open" href={`/automations/${automation.id}`}>Open builder</Link></footer>
      </article>) : <div className="card au-grid__empty"><div className="empty"><Icon name="zap" /><b>No {filter === "active" ? "active" : "paused"} automations</b><span>Try another filter or create a workflow.</span></div></div>}
    </section>
    <dialog ref={createDialogRef} className="modal is-wide" aria-label="New automation" onCancel={() => setCreateOpen(false)} onClose={() => setCreateOpen(false)} onClick={(event) => { if (event.target === createDialogRef.current) setCreateOpen(false); }}>
      {createOpen && <div className="modal__box"><header className="modal__head"><h2 className="modal__title">New automation</h2><button className="icon-btn" type="button" aria-label="Close" onClick={() => setCreateOpen(false)}><Icon name="x" /></button></header>
        <div className="modal__body"><p className="card__sub au-new__lead">Start from a template. You can change every step in the builder.</p><div className="au-tpls" role="radiogroup" aria-label="Choose a template">{AUTOMATION_TEMPLATES.map((template, index) => <button key={template.name} className="au-tpl" type="button" role="radio" aria-checked={templateIndex === index} tabIndex={templateIndex === index ? 0 : -1} onClick={() => chooseTemplate(index)}><span className="au-tpl__head"><b>{template.name}</b><span className="au-tpl__tick" aria-hidden="true"><Icon name="check" /></span></span><span className="au-tpl__desc">{template.desc}</span><FlowPreview steps={template.steps} hue={template.hue} /></button>)}</div>
          <label className="field"><span className="label">Name</span><input className="input" value={newName} maxLength={60} autoComplete="off" onChange={(event) => setNewName(event.target.value)} /></label>{error && <p className="em-form__err" role="alert">{error}</p>}
        </div><footer className="modal__foot"><button className="btn" type="button" onClick={() => setCreateOpen(false)}>Cancel</button><button className="btn btn--primary" type="button" onClick={createAutomation}><Icon name="plus" />Create automation</button></footer>
      </div>}
    </dialog>
    {toast && <div className="toasts" aria-live="polite"><div className="toast" role="status"><span className="toast__ico"><Icon name="check" /></span><span>{toast}</span></div></div>}
  </div>;
}

export function AutomationBuilder({ automationId }: { automationId: string }) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const nodeRefs = useRef<(HTMLElement | null)[]>([]);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const [automations, setAutomations] = useState<AutomationRecord[]>(createInitialAutomations);
  const [storageReady, setStorageReady] = useState(false);
  const autosRef = useRef(automations);
  const [testRunning, setTestRunning] = useState(false);
  const [addAt, setAddAt] = useState<number | null>(null);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const cancelEditRef = useRef(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [toast, setToast] = useState("");
  const automation = automations.find((item) => item.id === automationId) ?? null;

  useEffect(() => { autosRef.current = automations; }, [automations]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUTOMATION_STORAGE_KEY);
      if (saved) {
        const parsed = readAutomations(saved);
        if (parsed) { setAutomations(parsed); autosRef.current = parsed; }
      } else saveAutomations(createInitialAutomations());
    } catch { /* The builder remains usable with starter data. */ }
    finally { setStorageReady(true); }
  }, []);
  useEffect(() => () => timelineRef.current?.kill(), []);
  useEffect(() => {
    const dialog = deleteDialogRef.current;
    if (!dialog) return;
    if (deleteOpen && !dialog.open) dialog.showModal();
    else if (!deleteOpen && dialog.open) dialog.close();
  }, [deleteOpen]);

  const persist = (next: AutomationRecord[]) => { autosRef.current = next; setAutomations(next); saveAutomations(next); };
  const updateCurrent = (updater: (record: AutomationRecord) => AutomationRecord) => {
    persist(autosRef.current.map((record) => record.id === automationId ? updater(record) : record));
  };
  const announce = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 3500); };

  useGSAP(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const nodes = flowRef.current?.querySelectorAll<HTMLElement>(".au-node");
    const links = flowRef.current?.querySelectorAll<SVGLineElement>(".au-link__line line");
    if (reduced) return;
    if (nodes?.length) gsap.fromTo(nodes, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.42, stagger: 0.06, delay: 0.15, ease: "power3.out", clearProps: "transform,opacity" });
    if (links?.length) gsap.fromTo(links, { strokeDasharray: "0 100" }, { strokeDasharray: "100 0", duration: 0.4, stagger: 0.07, delay: 0.3, ease: "power2.out", clearProps: "strokeDasharray" });
  }, { dependencies: [automationId, automation?.steps.length], scope: rootRef });

  useGSAP(() => {
    if (!automation?.enabled || testRunning || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const flow = flowRef.current;
    const dot = flow?.querySelector<HTMLElement>(".au-dot");
    const nodes = Array.from(flow?.querySelectorAll<HTMLElement>(".au-node") ?? []);
    if (!dot || nodes.length < 2) return;
    const first = nodes[0].offsetTop + nodes[0].offsetHeight / 2;
    const last = nodes[nodes.length - 1].offsetTop + nodes[nodes.length - 1].offsetHeight / 2;
    gsap.set(dot, { y: first, opacity: 0.8, scale: 1 });
    const tween = gsap.to(dot, { y: last, duration: Math.max(1.8, nodes.length * 0.5), ease: "sine.inOut", repeat: -1, yoyo: true, repeatDelay: 0.5 });
    return () => tween.kill();
  }, { dependencies: [automation?.enabled, automation?.steps.length, testRunning], scope: rootRef });

  const renameStep = (index: number, label: string) => {
    const clean = label.trim();
    if (!clean || !automation) { setEditIndex(null); return; }
    updateCurrent((record) => ({ ...record, edited: Date.now(), steps: record.steps.map((step, stepIndex) => stepIndex === index ? { ...step, label: clean } : step) }));
    setEditIndex(null);
    announce("Changes saved");
  };
  const addStep = (at: number, kind: AutomationStepKind) => {
    updateCurrent((record) => ({ ...record, edited: Date.now(), steps: [...record.steps.slice(0, at), { kind, label: AUTOMATION_STEP_TYPES[kind].defaultLabel }, ...record.steps.slice(at)] }));
    setAddAt(null);
    announce(`${AUTOMATION_STEP_TYPES[kind].name} step added`);
  };
  const removeStep = (index: number) => {
    if (index === 0 || !automation) return;
    updateCurrent((record) => ({ ...record, edited: Date.now(), steps: record.steps.filter((_, stepIndex) => stepIndex !== index) }));
    announce("Step removed");
  };
  const toggleEnabled = (enabled: boolean) => {
    updateCurrent((record) => ({ ...record, enabled, edited: Date.now() }));
    announce(enabled ? "Automation turned on" : "Automation paused");
  };
  const deleteAutomation = () => {
    persist(autosRef.current.filter((record) => record.id !== automationId));
    setDeleteOpen(false);
    router.replace("/automations");
  };
  const runTest = () => {
    if (!automation || testRunning || !flowRef.current) return;
    timelineRef.current?.kill();
    const flow = flowRef.current;
    const dot = flow.querySelector<HTMLElement>(".au-dot");
    const nodes = Array.from(flow.querySelectorAll<HTMLElement>(".au-node"));
    if (!dot || !nodes.length) return;
    setTestRunning(true);
    const passes = flow.querySelectorAll<HTMLElement>(".au-node__pass");
    gsap.set(passes, { opacity: 0, scale: 0.4 });
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timeline = gsap.timeline({ onComplete: () => {
      const run: AutomationRun = { who: `${automation.name} (test)`, hue: automation.hue, what: "Passed", tone: "mint", at: Date.now() };
      updateCurrent((record) => ({ ...record, history: [run, ...record.history].slice(0, 6) }));
      setTestRunning(false);
      announce("Test run passed");
      if (automation.enabled) gsap.to(dot, { opacity: 0, duration: 0.24, delay: 0.8 });
    } });
    timelineRef.current = timeline;
    nodes.forEach((node, index) => {
      const center = node.offsetTop + node.offsetHeight / 2;
      const pass = node.querySelector<HTMLElement>(".au-node__pass");
      const glow = node.querySelector<HTMLElement>(".au-node__glow");
      if (reduced) {
        timeline.set(dot, { y: center, opacity: 0 });
        if (pass) timeline.set(pass, { opacity: 1, scale: 1 });
      } else {
        timeline.to(dot, { y: center, opacity: 1, duration: index === 0 ? 0.1 : 0.38, ease: "power2.inOut" });
        if (glow) timeline.fromTo(glow, { opacity: 0, scale: 0.98 }, { opacity: 0.8, scale: 1.02, duration: 0.18, yoyo: true, repeat: 1 }, "<");
        if (pass) timeline.fromTo(pass, { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.35, ease: "back.out(2.4)" }, "<0.12");
      }
      timeline.to({}, { duration: reduced ? 0 : 0.1 });
    });
  };

  if (!automation && !storageReady) return <div data-view="automations" className="view au-detail" aria-busy="true"><div className="card empty"><Icon name="clock" /><span>Loading automation…</span></div></div>;
  if (!automation) return <div data-view="automations" className="view au-detail"><div className="card empty"><Icon name="alert" /><b>Automation not found</b><span>It may have been removed from this workspace.</span><Link className="btn" href="/automations">Back to automations</Link></div></div>;

  return <div ref={rootRef} data-view="automations" className="view au-detail">
    <div className="toolbar au-dbar"><Link className="btn btn--ghost au-back" href="/automations"><Icon name="chev" />All automations</Link><span className="card__sub" data-f="saved">Changes save automatically</span><div className="toolbar__end"><button className="btn btn--ghost btn--danger" type="button" onClick={() => setDeleteOpen(true)}><Icon name="trash" />Delete</button></div></div>
    <div className="au-builder">
      <section className="card au-canvas" aria-labelledby="au-flow-title"><header className="au-canvas__head"><div><h2 id="au-flow-title">{automation.name}</h2><p className="card__sub">{automation.desc}</p></div><span className={`pill pill--${automation.enabled ? "mint" : "gray"}`}>{automation.enabled ? "Active" : "Paused"}</span></header>
        <div ref={flowRef} className="au-flow" data-flow>
          <span className="au-dot" aria-hidden="true" />
          {automation.steps.map((step, index) => <div key={`${step.kind}-${index}`} className="au-flow__item">
            {index > 0 && <div className={`au-link${addAt === index ? " is-open" : ""}`} data-at={index}>
              <svg className="au-link__line" viewBox="0 0 100 64" preserveAspectRatio="none" aria-hidden="true"><line x1="50" x2="50" y1="0" y2="64" vectorEffect="non-scaling-stroke" /></svg>
              <button className="au-add" type="button" aria-label={`Add a step before ${AUTOMATION_STEP_TYPES[step.kind].name}`} aria-expanded={addAt === index} onClick={() => setAddAt(addAt === index ? null : index)}><Icon name="plus" /></button>
              {addAt === index && <div className="au-menu" role="menu" aria-label="Choose a workflow step"><div className="au-menu__head">Add step</div>{AUTOMATION_ADDABLE_STEPS.map((kind) => { const item = AUTOMATION_STEP_TYPES[kind]; return <button key={kind} className="au-menu__item" type="button" role="menuitem" onClick={() => addStep(index, kind)}><span className="au-kind" style={{ "--h": item.hue } as CSSProperties}><Icon name={item.icon} /></span><span><b>{item.name}</b><small>{item.hint}</small></span></button>; })}</div>}
            </div>}
            <article ref={(node) => { nodeRefs.current[index] = node; }} className={`au-node${index === 0 ? " is-trigger" : ""}`} data-i={index}>
              <span className="au-node__ico" style={{ "--h": AUTOMATION_STEP_TYPES[step.kind].hue } as CSSProperties}><Icon name={AUTOMATION_STEP_TYPES[step.kind].icon} /></span>
              <span className="au-node__txt"><small>{AUTOMATION_STEP_TYPES[step.kind].name}</small>{editIndex === index ? <input className="input au-node__input" autoFocus aria-label="Step label" maxLength={80} value={editText} onChange={(event) => setEditText(event.target.value)} onBlur={() => { if (!cancelEditRef.current) renameStep(index, editText); cancelEditRef.current = false; }} onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => { if (event.key === "Enter") { event.preventDefault(); renameStep(index, editText); } else if (event.key === "Escape") { cancelEditRef.current = true; setEditIndex(null); } }} /> : <b className="au-node__label">{step.label}</b>}</span>
              {index > 0 && <div className="au-node__act"><button className="icon-btn au-ib" type="button" aria-label={`Rename ${step.label}`} onClick={() => { cancelEditRef.current = false; setEditIndex(index); setEditText(step.label); }}><Icon name="edit" /></button><button className="icon-btn au-ib au-ib--danger" type="button" aria-label={`Remove ${step.label}`} onClick={() => removeStep(index)}><Icon name="trash" /></button></div>}
              <span className="au-node__glow" aria-hidden="true" /><span className="au-node__pass" aria-hidden="true"><Icon name="check" /></span>
            </article>
          </div>)}
          <div className={`au-link is-tail${addAt === automation.steps.length ? " is-open" : ""}`} data-at={automation.steps.length}><svg className="au-link__line" viewBox="0 0 100 52" preserveAspectRatio="none" aria-hidden="true"><line x1="50" x2="50" y1="0" y2="52" vectorEffect="non-scaling-stroke" /></svg><button className="au-add" type="button" aria-label="Add a step at the end" aria-expanded={addAt === automation.steps.length} onClick={() => setAddAt(addAt === automation.steps.length ? null : automation.steps.length)}><Icon name="plus" /></button>
            {addAt === automation.steps.length && <div className="au-menu" role="menu" aria-label="Choose a workflow step"><div className="au-menu__head">Add step</div>{AUTOMATION_ADDABLE_STEPS.map((kind) => { const item = AUTOMATION_STEP_TYPES[kind]; return <button key={kind} className="au-menu__item" type="button" role="menuitem" onClick={() => addStep(automation.steps.length, kind)}><span className="au-kind" style={{ "--h": item.hue } as CSSProperties}><Icon name={item.icon} /></span><span><b>{item.name}</b><small>{item.hint}</small></span></button>; })}</div>}
          </div>
          <div className="au-end"><span>Flow complete</span></div>
        </div>
      </section>
      <aside className="au-side">
        <section className="card au-panel" aria-label="Automation settings"><div className="au-panel__row"><span><b>Running</b><small>{automation.enabled ? "Customers enter this flow" : "Paused — nobody enters"}</small></span><label className="switch"><input type="checkbox" checked={automation.enabled} aria-label="Automation on" onChange={(event) => toggleEnabled(event.target.checked)} /><span className="switch__track" /><span className="switch__knob" /></label></div>
          <dl className="au-panel__stats"><div><dt>Runs, 30 days</dt><dd>{int(automation.runs30)}</dd></div><div><dt>Conversion</dt><dd>{automation.runs30 && automation.steps.some((step) => step.kind === "email") ? pct(automation.conv) : "—"}</dd></div><div><dt>Conversions</dt><dd>{int(automationConversions(automation))}</dd></div><div><dt>Edited</dt><dd data-f="edited">{editedText(automation.edited)}</dd></div></dl>
          <div className="au-panel__btns"><button className="btn btn--dark" type="button" disabled={testRunning} onClick={runTest}><Icon name={testRunning ? "clock" : "play"} />{testRunning ? "Running…" : "Test run"}</button><button className="btn btn--ghost btn--danger" type="button" onClick={() => setDeleteOpen(true)}><Icon name="trash" />Delete</button></div>
        </section>
        <section className="card au-runcard" aria-labelledby="au-runs-title"><div className="card__head"><h3 className="card__title" id="au-runs-title">Recent runs</h3></div>{automation.history.length ? <ul className="au-runs">{automation.history.slice(0, 6).map((run, index) => <li key={`${run.at}-${index}`}><span className="av av--sm" style={{ "--h": run.hue } as CSSProperties}>{run.who.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span><span className="au-runs__who"><b>{run.who}</b><small>{runTime(run.at)}</small></span><span className={`pill pill--${run.tone}`}>{run.what}</span></li>)}</ul> : <div className="empty au-runcard__empty"><Icon name="play" /><b>No runs yet</b><span>{automation.enabled ? "Runs show here as customers enter the flow." : "Turn it on, or try a test run."}</span></div>}</section>
      </aside>
    </div>
    <dialog ref={deleteDialogRef} className="modal" aria-label="Delete automation" onCancel={() => setDeleteOpen(false)} onClose={() => setDeleteOpen(false)} onClick={(event) => { if (event.target === deleteDialogRef.current) setDeleteOpen(false); }}><div className="modal__box"><header className="modal__head"><h2 className="modal__title">Delete automation?</h2><button className="icon-btn" type="button" aria-label="Close" onClick={() => setDeleteOpen(false)}><Icon name="x" /></button></header><div className="modal__body"><p className="card__sub">“{automation.name}” and its workflow steps will be deleted. This can’t be undone.</p></div><footer className="modal__foot"><button className="btn" type="button" onClick={() => setDeleteOpen(false)}>Cancel</button><button className="btn btn--danger" type="button" onClick={deleteAutomation}><Icon name="trash" />Delete automation</button></footer></div></dialog>
    {toast && <div className="toasts" aria-live="polite"><div className="toast" role="status"><span className="toast__ico"><Icon name="check" /></span><span>{toast}</span></div></div>}
  </div>;
}
