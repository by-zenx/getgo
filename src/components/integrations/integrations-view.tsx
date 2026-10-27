"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Icon } from "@/components/icons/svg-sprite";
import { INTEGRATION_CATEGORIES, INTEGRATION_PERMISSIONS, INTEGRATION_STORAGE_KEY, createInitialIntegrations, integrationSyncLabel, type IntegrationCategory, type IntegrationRecord } from "@/data/integrations-data";

function readIntegrations(raw: string): IntegrationRecord[] | null {
  try {
    const parsed = JSON.parse(raw) as IntegrationRecord[];
    return Array.isArray(parsed) && parsed.every((item) => typeof item.id === "string" && typeof item.name === "string" && typeof item.connected === "boolean") ? parsed : null;
  } catch { return null; }
}

function Logo({ integration, small = false }: { integration: IntegrationRecord; small?: boolean }) {
  return <span className={`int-logo${small ? " int-logo--sm" : ""}`} style={{ "--h": integration.hue } as CSSProperties} aria-hidden="true">{integration.name[0]}</span>;
}

function SyncIcon({ className = "" }: { className?: string }) {
  return <svg className={`ico ${className}`} viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4" /></svg>;
}

export function IntegrationsView() {
  const rootRef = useRef<HTMLDivElement>(null);
  const connectDialogRef = useRef<HTMLDialogElement>(null);
  const disconnectDialogRef = useRef<HTMLDialogElement>(null);
  const syncTweenRef = useRef<gsap.core.Tween | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationRecord[]>(createInitialIntegrations);
  const integrationsRef = useRef(integrations);
  const [activeCategory, setActiveCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [disconnectId, setDisconnectId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectionProgress, setConnectionProgress] = useState(false);
  const [connectDone, setConnectDone] = useState(false);
  const [toast, setToast] = useState("");
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const flipCardIdRef = useRef<string | null>(null);
  const connectTimelineRef = useRef<gsap.core.Timeline | null>(null);

  const connectedCount = integrations.filter((integration) => integration.connected).length;
  const selected = integrations.find((integration) => integration.id === selectedId) ?? null;
  const disconnectTarget = integrations.find((integration) => integration.id === disconnectId) ?? null;
  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return integrations.filter((integration) => (activeCategory === "All" || integration.cat === activeCategory) && (!search || `${integration.name} ${integration.cat} ${integration.desc}`.toLowerCase().includes(search)));
  }, [integrations, activeCategory, query]);

  useEffect(() => { integrationsRef.current = integrations; }, [integrations]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(INTEGRATION_STORAGE_KEY);
      if (saved) {
        const parsed = readIntegrations(saved);
        if (parsed) { setIntegrations(parsed); integrationsRef.current = parsed; }
      } else localStorage.setItem(INTEGRATION_STORAGE_KEY, JSON.stringify(createInitialIntegrations()));
    } catch { /* Keep the integration cards available if storage is unavailable. */ }
  }, []);
  useEffect(() => () => connectTimelineRef.current?.kill(), []);
  useEffect(() => {
    const id = flipCardIdRef.current;
    if (!id) return;
    flipCardIdRef.current = null;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const card = rootRef.current?.querySelector<HTMLElement>(`.int-card[data-id="${id}"]`);
    if (card) gsap.fromTo(card, { rotationY: -90, scale: 0.97, transformPerspective: 900 }, { rotationY: 0, scale: 1, duration: 0.62, ease: "back.out(1.5)", clearProps: "transform" });
  }, [integrations]);
  useEffect(() => {
    if (!menuId) return;
    const closeOnOutside = (event: PointerEvent) => {
      const card = rootRef.current?.querySelector<HTMLElement>(`.int-card[data-id="${menuId}"]`);
      if (card && !card.contains(event.target as Node)) setMenuId(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuId(null); };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuId]);

  useEffect(() => {
    const dialog = connectDialogRef.current;
    if (!dialog) return;
    if (selected && !dialog.open) {
      setConnecting(false);
      setConnectionProgress(false);
      setConnectDone(false);
      dialog.showModal();
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) gsap.fromTo(dialog.querySelector(".modal__box"), { opacity: 0, y: 14, scale: 0.98 }, { opacity: 1, y: 0, scale: 1, duration: 0.42, ease: "power3.out" });
    } else if (!selected && dialog.open) dialog.close();
  }, [selected]);
  useEffect(() => {
    const dialog = disconnectDialogRef.current;
    if (!dialog) return;
    if (disconnectTarget && !dialog.open) {
      dialog.showModal();
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) gsap.fromTo(dialog.querySelector(".modal__box"), { opacity: 0, y: 12, scale: 0.98 }, { opacity: 1, y: 0, scale: 1, duration: 0.36, ease: "power3.out" });
    } else if (!disconnectTarget && dialog.open) dialog.close();
  }, [disconnectTarget]);

  useGSAP(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cards = rootRef.current?.querySelectorAll<HTMLElement>(".int-card");
    if (cards?.length) gsap.fromTo(cards, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.48, stagger: 0.035, delay: 0.15, ease: "power3.out", clearProps: "transform,opacity" });
    gsap.fromTo(".int-head__meter .meter__fill", { scaleX: 0 }, { scaleX: connectedCount / integrations.length, duration: 0.8, delay: 0.28, ease: "expo.out", transformOrigin: "left" });
  }, { dependencies: [activeCategory, query], scope: rootRef });

  const persist = (next: IntegrationRecord[]) => {
    integrationsRef.current = next;
    setIntegrations(next);
    try { localStorage.setItem(INTEGRATION_STORAGE_KEY, JSON.stringify(next)); } catch { /* Changes remain in memory for this visit. */ }
  };
  const announce = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3000);
  };
  const finishConnect = () => {
    if (!selected) return;
    flipCardIdRef.current = selected.id;
    persist(integrationsRef.current.map((integration) => integration.id === selected.id ? { ...integration, connected: true, synced: Date.now() } : integration));
    setConnecting(false);
    setConnectionProgress(true);
    setConnectDone(true);
    announce(`${selected.name} connected`);
  };
  const startConnect = () => {
    if (!selected || connecting || connectDone) return;
    const integration = selected;
    setConnecting(true);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { window.setTimeout(finishConnect, 0); return; }
    const dialog = connectDialogRef.current;
    const permissions = dialog?.querySelector<HTMLElement>(".int-cx__perms");
    const run = dialog?.querySelector<HTMLElement>(".int-cx__run");
    const fill = dialog?.querySelector<HTMLElement>(".int-cx__meter .meter__fill");
    const label = dialog?.querySelector<HTMLElement>("[data-step]");
    const stages = dialog?.querySelectorAll<HTMLElement>(".int-cx__steps li");
    const check = dialog?.querySelector<HTMLElement>(".int-cx__done");
    if (!permissions || !run || !fill || !label || !stages || !check) { finishConnect(); return; }
    connectTimelineRef.current?.kill();
    gsap.set(fill, { scaleX: 0, transformOrigin: "left" });
    const timeline = gsap.timeline({ onComplete: finishConnect });
    connectTimelineRef.current = timeline;
    timeline.to(permissions, { opacity: 0, y: -8, duration: 0.2, ease: "power2.in" })
      .add(() => { setConnectionProgress(true); permissions.hidden = true; run.hidden = false; stages[0].classList.add("is-now"); gsap.fromTo(run, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4, ease: "expo.out" }); })
      .to(fill, { scaleX: 0.38, duration: 0.45, ease: "power2.inOut" })
      .add(() => { label.textContent = integration.cat === "Payments" ? "Syncing payouts…" : integration.cat === "Point of sale" ? "Syncing products…" : integration.cat === "Shipping" ? "Syncing orders…" : integration.cat === "Accounting" ? "Syncing sales…" : integration.cat === "Marketing" ? "Syncing products…" : "Syncing conversations…"; stages[0].classList.replace("is-now", "is-done"); stages[1].classList.add("is-now"); })
      .to(fill, { scaleX: 1, duration: 0.72, ease: "power1.inOut" })
      .add(() => { label.textContent = "Done"; stages[1].classList.replace("is-now", "is-done"); stages[2].classList.add("is-done"); check.hidden = false; gsap.fromTo(check, { scale: 0.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, ease: "back.out(2)" }); });
  };
  const syncNow = (integration: IntegrationRecord) => {
    const card = rootRef.current?.querySelector<HTMLElement>(`.int-card[data-id="${integration.id}"]`);
    const syncIcon = card?.querySelector<HTMLElement>(".int-sync");
    setMenuId(null);
    const done = () => {
      const next = integrationsRef.current.map((item) => item.id === integration.id ? { ...item, synced: Date.now() } : item);
      persist(next);
      setSyncingId(null);
      announce(`${integration.name} is up to date`);
    };
    setSyncingId(integration.id);
    if (!syncIcon || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { done(); return; }
    syncTweenRef.current?.kill();
    syncTweenRef.current = gsap.to(syncIcon, { rotation: 360, duration: 0.85, ease: "power2.inOut", transformOrigin: "50% 50%", onComplete: done });
  };
  const disconnect = () => {
    if (!disconnectTarget) return;
    flipCardIdRef.current = disconnectTarget.id;
    persist(integrationsRef.current.map((integration) => integration.id === disconnectTarget.id ? { ...integration, connected: false, synced: undefined } : integration));
    setDisconnectId(null);
    announce(`${disconnectTarget.name} disconnected`);
  };

  return <div ref={rootRef} data-view="integrations" className="view int-view">
    <section className="card int-head" aria-labelledby="int-count">
      <div className="int-head__txt"><h2 id="int-count"><b>{connectedCount}</b> of {integrations.length} apps connected</h2><p className="card__sub">Apps that sync orders, stock and customers with Corbel.</p></div>
      <div className="int-head__meter"><div className="int-stack" role="img" aria-label={`Connected: ${integrations.filter((integration) => integration.connected).map((integration) => integration.name).join(", ") || "none"}`}>{integrations.filter((integration) => integration.connected).map((integration) => <span key={integration.id} className="int-stack__item" title={integration.name}><Logo integration={integration} small /></span>)}</div><div className="meter int-meter" role="presentation"><div className="meter__fill" style={{ transform: `scaleX(${integrations.length ? connectedCount / integrations.length : 0})` }} /></div></div>
    </section>
    <div className="toolbar int-bar"><div className="chips" role="group" aria-label="Category">{["All", ...INTEGRATION_CATEGORIES].map((category) => {
      const total = integrations.filter((integration) => category === "All" || integration.cat === category).length;
      const connected = integrations.filter((integration) => integration.connected && (category === "All" || integration.cat === category)).length;
      return <button key={category} className="chip" type="button" data-cat={category} aria-pressed={activeCategory === category} onClick={() => setActiveCategory(category)}>{category}<small>{connected}/{total}</small></button>;
    })}</div><div className="toolbar__end"><label className="input-icon int-search"><Icon name="search" /><span className="sr-only">Search apps</span><input className="input" type="search" placeholder="Search apps" autoComplete="off" value={query} onChange={(event) => setQuery(event.target.value)} /></label></div></div>
    <section className="int-grid" aria-label="Integrations">{filtered.length ? filtered.map((integration) => <article key={integration.id} className={`card int-card${integration.connected ? " is-on" : ""}`} data-id={integration.id}>
      <div className="int-card__top"><Logo integration={integration} /><div className="int-card__name"><h3>{integration.name}</h3><small>{integration.cat}</small></div>{integration.connected && <span className="pill pill--mint">Connected</span>}</div>
      <p className="int-card__desc">{integration.desc}</p>
      <div className="int-card__foot">{integration.connected ? <span className="int-status is-on"><SyncIcon className="int-sync" /><span>{syncingId === integration.id ? "Syncing…" : integrationSyncLabel(integration.synced)}</span></span> : <span className="int-status">Not connected</span>}
        {integration.connected ? <button className="btn btn--sm" type="button" aria-haspopup="menu" aria-expanded={menuId === integration.id} aria-label={`Manage ${integration.name}`} onClick={() => setMenuId(menuId === integration.id ? null : integration.id)}>Manage<Icon name="chev-down" /></button> : <button className="btn btn--sm btn--primary" type="button" onClick={() => setSelectedId(integration.id)}><Icon name="link" />Connect</button>}
      </div>
      {integration.connected && menuId === integration.id && <div className="pop int-menu" role="menu" aria-label={`Manage ${integration.name}`}><p className="int-menu__name">{integration.name}</p><button className="int-menu__item" type="button" role="menuitem" onClick={() => syncNow(integration)}><SyncIcon className="int-sync" />Sync now</button><button className="int-menu__item is-danger" type="button" role="menuitem" onClick={() => { setMenuId(null); setDisconnectId(integration.id); }}><Icon name="x" />Disconnect</button></div>}
    </article>) : <div className="card int-empty"><div className="empty"><Icon name="plug" /><b>No apps match</b><span>Try another name or category.</span></div></div>}</section>
    <dialog ref={connectDialogRef} className="modal is-wide" aria-label={selected ? `Connect ${selected.name}` : "Connect integration"} onCancel={() => !connecting && setSelectedId(null)} onClose={() => { if (!connectDone) setSelectedId(null); }} onClick={(event) => { if (event.target === connectDialogRef.current && !connecting) setSelectedId(null); }}>
      {selected && <div className="modal__box"><header className="modal__head"><h2 className="modal__title">{connectDone ? `${selected.name} connected` : `Connect ${selected.name}`}</h2>{!connecting && <button className="icon-btn" type="button" aria-label="Close" onClick={() => setSelectedId(null)}><Icon name="x" /></button>}</header><div className="modal__body"><div className="int-cx">
        <div className="int-cx__brand"><Logo integration={selected} /><span className="int-cx__link" aria-hidden="true"><i /><i /><i /></span><span className="int-logo int-logo--lg int-logo--corbel" aria-hidden="true"><Icon name="logo" /></span></div>
        <p className="int-cx__lead">{selected.desc}</p>
        <div className="int-cx__perms" hidden={connectionProgress || connectDone}><p className="label">{selected.name} will be able to</p><ul>{INTEGRATION_PERMISSIONS[selected.cat].map((permission) => <li key={permission}><span className="int-tick"><Icon name="check" /></span>{permission}</li>)}</ul><p className="card__sub">You can disconnect at any time from Manage.</p></div>
        <div className="int-cx__run" aria-live="polite" hidden={!connectionProgress && !connectDone}><div className="int-cx__done" hidden={!connectDone}><svg viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="23" pathLength="100" /><path d="m16 27 7 7 13-15" pathLength="100" /></svg></div><div className="int-cx__label"><span data-step>{connectDone ? "Done" : "Authorising…"}</span></div><div className="meter int-cx__meter"><div className="meter__fill" /></div><ol className="int-cx__steps"><li className={connectDone ? "is-done" : "is-now"}>Authorise</li><li className={connectDone ? "is-done" : connecting ? "is-now" : ""}>{selected.cat === "Payments" ? "Syncing payouts" : selected.cat === "Point of sale" || selected.cat === "Marketing" ? "Syncing products" : selected.cat === "Shipping" ? "Syncing orders" : selected.cat === "Accounting" ? "Syncing sales" : "Syncing conversations"}</li><li className={connectDone ? "is-done" : ""}>Done</li></ol></div>
      </div></div><footer className="modal__foot">{connectDone ? <button className="btn btn--primary" type="button" onClick={() => setSelectedId(null)}>Done</button> : <><button className="btn" type="button" disabled={connecting} onClick={() => setSelectedId(null)}>Cancel</button><button className="btn btn--primary" type="button" disabled={connecting} onClick={startConnect}><Icon name="link" />{connecting ? "Connecting…" : `Connect ${selected.name}`}</button></>}</footer></div>}
    </dialog>
    <dialog ref={disconnectDialogRef} className="modal" aria-label="Disconnect integration" onCancel={() => setDisconnectId(null)} onClose={() => setDisconnectId(null)} onClick={(event) => { if (event.target === disconnectDialogRef.current) setDisconnectId(null); }}>
      {disconnectTarget && <div className="modal__box"><header className="modal__head"><h2 className="modal__title">Disconnect {disconnectTarget.name}?</h2><button className="icon-btn" type="button" aria-label="Close" onClick={() => setDisconnectId(null)}><Icon name="x" /></button></header><div className="modal__body"><p className="card__sub">{disconnectTarget.name} will stop syncing straight away. Nothing already synced will be deleted, and you can reconnect later.</p></div><footer className="modal__foot"><button className="btn" type="button" onClick={() => setDisconnectId(null)}>Cancel</button><button className="btn btn--danger" type="button" onClick={disconnect}>Disconnect</button></footer></div>}
    </dialog>
    {toast && <div className="toasts" aria-live="polite"><div className="toast" role="status"><span className="toast__ico"><Icon name="check" /></span><span>{toast}</span></div></div>}
  </div>;
}
