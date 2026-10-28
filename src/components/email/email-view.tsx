"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Icon } from "@/components/icons/svg-sprite";
import { moveSegmentPill } from "@/lib/segment-motion";
import { createInitialProducts } from "@/data/products-data";
import { createInitialEmailCampaigns, EMAIL_AUDIENCES, type CampaignStatus, type EmailCampaign } from "@/data/email-data";
import { calculateLeadScore, DEFAULT_LEAD_SCORING, leadScoreLabel, leadScoreTone, LEAD_SCORING_STORAGE_KEY, SEEDED_EMAIL_LEADS, type LeadScoringSettings } from "@/data/messages-data";

const STORAGE_KEY = "corbel:email:campaigns";
const NOW = Date.UTC(2026, 9, 26, 12);
const DAY = 24 * 60 * 60 * 1000;
type CampaignFilter = "all" | CampaignStatus;
type DialogAction = { kind: "create" } | { kind: "edit" | "schedule" | "test" | "send" | "delete"; campaignId: string };

const FILTERS: { value: CampaignFilter; label: string }[] = [
  { value: "all", label: "All" }, { value: "sent", label: "Sent" },
  { value: "scheduled", label: "Scheduled" }, { value: "draft", label: "Drafts" },
];
const STATUS: Record<CampaignStatus, { label: string; tone: string }> = {
  sent: { label: "Sent", tone: "mint" },
  scheduled: { label: "Scheduled", tone: "blue" },
  draft: { label: "Draft", tone: "gray" },
};

function currency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}
function shortDate(at: number) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(at);
}
function timeText(at: number) {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(at);
}
function dateTimeInput(at: number) {
  const date = new Date(at);
  return `${date.toISOString().slice(0, 10)}T${date.toISOString().slice(11, 16)}`;
}
function campaignSort(a: EmailCampaign, b: EmailCampaign) {
  const order: Record<CampaignStatus, number> = { scheduled: 0, draft: 1, sent: 2 };
  return order[a.status] - order[b.status] || (a.status === "scheduled" ? a.at - b.at : b.at - a.at);
}
function campaignHash(value: string) {
  let hash = 2166136261;
  for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0) / 4294967296;
}
function readCampaigns(value: string): EmailCampaign[] | null {
  try {
    const parsed = JSON.parse(value) as EmailCampaign[];
    return Array.isArray(parsed) && parsed.every((item) => typeof item.id === "string" && typeof item.name === "string" && ["sent", "scheduled", "draft"].includes(item.status)) ? parsed : null;
  } catch { return null; }
}
function readLeadScoringSettings(): LeadScoringSettings {
  try {
    const settings = JSON.parse(localStorage.getItem(LEAD_SCORING_STORAGE_KEY) ?? "null") as LeadScoringSettings | null;
    if (settings && Object.values(settings.weights).every(Number.isFinite)
      && settings.weights.fit + settings.weights.intent + settings.weights.engagement === 100
      && Number.isInteger(settings.warmCutoff) && Number.isInteger(settings.hotCutoff)
      && settings.warmCutoff >= 0 && settings.hotCutoff > settings.warmCutoff && settings.hotCutoff <= 100) return settings;
  } catch { /* Use the default scoring setup when storage is unavailable. */ }
  return DEFAULT_LEAD_SCORING;
}

function FilterTabs({ value, onChange }: { value: CampaignFilter; onChange: (value: CampaignFilter) => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const initialized = useRef(false);
  useGSAP(() => {
    const root = rootRef.current;
    const pill = pillRef.current;
    const active = root?.querySelector<HTMLButtonElement>(`[data-filter="${value}"]`);
    if (!root || !pill || !active) return;
    moveSegmentPill(pill, active, !initialized.current);
    initialized.current = true;
  }, { dependencies: [value], scope: rootRef });

  return <div ref={rootRef} className="seg em-filter" role="group" aria-label="Filter campaigns">
    <span ref={pillRef} className="seg__pill" aria-hidden="true" />
    {FILTERS.map((filter) => <button key={filter.value} type="button" data-filter={filter.value} aria-pressed={value === filter.value} onClick={() => onChange(filter.value)}>{filter.label}</button>)}
  </div>;
}

function EmailPreview({ campaign, mode, onModeChange }: { campaign: EmailCampaign; mode: "desktop" | "mobile"; onModeChange: (mode: "desktop" | "mobile") => void }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const products = useMemo(() => {
    const active = createInitialProducts().filter((product) => product.status === "active");
    const text = `${campaign.name} ${campaign.subject} ${campaign.preview} ${campaign.audience}`.toLowerCase();
    const preferred = /support|help/.test(text) ? ["p7", "p15", "p8"]
      : /team|sales|pipeline/.test(text) ? ["p1", "p2", "p11"]
      : /training|admin/.test(text) ? ["p5", "p6", "p14"] : [];
    const picked = preferred.map((id) => active.find((product) => product.id === id)).filter(Boolean);
    for (const product of active.slice().sort((a, b) => campaignHash(`${campaign.id}:${a.id}`) - campaignHash(`${campaign.id}:${b.id}`))) {
      if (picked.length >= 3) break;
      if (!picked.some((item) => item?.id === product.id)) picked.push(product);
    }
    return picked.slice(0, 3);
  }, [campaign.id, campaign.name, campaign.subject, campaign.preview, campaign.audience]);

  useEffect(() => {
    const frame = frameRef.current;
    const stage = stageRef.current;
    if (!frame || !stage) return;
    const resize = () => {
      const width = mode === "mobile" ? 384 : 600;
      stage.classList.toggle("is-mobile", mode === "mobile");
      stage.style.width = `${width}px`;
      const scale = Math.min(1, Math.max(0.35, (frame.clientWidth - 20) / width));
      frame.style.height = `${Math.ceil(stage.scrollHeight * scale + 28)}px`;
      gsap.set(stage, { scale, x: (frame.clientWidth - width * scale) / 2, transformOrigin: "top left" });
    };
    const observer = new ResizeObserver(resize);
    observer.observe(frame);
    const frameId = requestAnimationFrame(resize);
    return () => { cancelAnimationFrame(frameId); observer.disconnect(); };
  }, [mode, campaign.id, campaign.subject, campaign.preview]);

  const previewText = campaign.preview || "A few things from the workshop this week.";
  return <section className="em-prev" aria-label="Email preview">
    <div className="em-prev__bar"><h3>Preview</h3><div className="seg seg--sm em-pmode" role="group" aria-label="Preview size">
      <button type="button" aria-pressed={mode === "desktop"} onClick={() => onModeChange("desktop")}>Desktop</button>
      <button type="button" aria-pressed={mode === "mobile"} onClick={() => onModeChange("mobile")}>Mobile</button>
    </div></div>
    <div ref={frameRef} className="em-frame"><div ref={stageRef} className={`em-stage${mode === "mobile" ? " is-mobile" : ""}`}>
      <article className="em-mail" style={{ "--h": campaign.hue } as CSSProperties}>
        <div className="em-mail__inbox"><span className="em-mail__from-av" aria-hidden="true"><Icon name="logo" /></span><div className="em-mail__from"><b>Corbel Supply Co.</b><small>hello@corbelsupply.co</small></div><small className="em-mail__when">{campaign.status === "sent" ? shortDate(campaign.at) : "Now"}</small><div className="em-mail__subj"><b>{campaign.subject}</b><span>{previewText}</span></div></div>
        <div className="em-mail__body">
          <header className="em-mail__brand"><span className="em-mail__logo"><Icon name="logo" /></span><b>Corbel Supply Co.</b><span className="em-mail__nav"><span>Shop</span><span>Journal</span><span>Visit us</span></span></header>
          <div className="em-mail__hero"><small>{campaign.name}</small><h3>{campaign.subject}</h3><p>{previewText}</p><span className="em-mail__btn">Shop the edit</span></div>
          <div className="em-mail__grid">{products.map((product) => <div className="em-mail__tile" key={product!.id}><span className="thumb" style={{ "--h": product!.hue } as CSSProperties}>{product!.name.split(/[ ,]/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span><b>{product!.name}</b><span>{currency(product!.price)}</span></div>)}</div>
          <div className="em-mail__visit"><b>Come and see them in person</b><span>Our Main St and Harbor shops are open every day, 10 AM to 7 PM.</span></div>
          <footer className="em-mail__foot">You’re getting this because you signed up at corbelsupply.co.<br /><span className="em-mail__links"><u>Unsubscribe</u><u>Email preferences</u></span></footer>
        </div>
      </article>
    </div></div>
  </section>;
}

function Results({ campaign }: { campaign: EmailCampaign }) {
  if (campaign.status !== "sent") return <div className="em-res em-res--wait"><Icon name={campaign.status === "scheduled" ? "clock" : "edit"} /><p>{campaign.status === "scheduled" ? `Sends ${shortDate(campaign.at)} at ${timeText(campaign.at)} to ${campaign.recipients.toLocaleString("en-US")} people. Results show here once it has gone out.` : "This draft hasn’t been sent. Schedule it or send it now to see opens, clicks and revenue here."}</p></div>;
  const opened = Math.round(campaign.recipients * campaign.opens);
  const clicked = Math.round(campaign.recipients * campaign.clicks);
  const orders = Math.max(1, Math.round(campaign.revenue / 120));
  return <div className="em-res" role="group" aria-label={`Results: ${Math.round(campaign.opens * 100)} percent opened, ${Math.round(campaign.clicks * 100)} percent clicked, ${currency(campaign.revenue)} revenue`}>
    <div className="em-res__rings">{[[campaign.opens, "Opened", "open"], [campaign.clicks, "Clicked", "click"]].map(([raw, label, key]) => {
      const value = raw as number;
      return <div className={`em-ring em-ring--${key}`} data-v={value} key={key}><svg viewBox="0 0 100 100" aria-hidden="true"><circle className="em-ring__track" cx="50" cy="50" r="41" /><circle className="em-ring__val" cx="50" cy="50" r="41" pathLength="100" transform="rotate(-90 50 50)" /></svg><div className="em-ring__mid"><b data-ring>{Math.round(value * 100)}%</b><small>{label}</small></div></div>;
    })}</div>
    <dl className="em-res__list"><div><dt>Delivered</dt><dd>{campaign.recipients.toLocaleString("en-US")}</dd></div><div><dt>Opened</dt><dd>{opened.toLocaleString("en-US")}</dd></div><div><dt>Clicked</dt><dd>{clicked.toLocaleString("en-US")}</dd></div><div><dt>Orders</dt><dd>{orders.toLocaleString("en-US")}</dd></div><div className="em-res__rev"><dt>Revenue</dt><dd data-rev>{currency(campaign.revenue)}</dd></div></dl>
  </div>;
}

export function EmailView() {
  const rootRef = useRef<HTMLDivElement>(null);
  const rowsRef = useRef<HTMLUListElement>(null);
  const detailsRef = useRef<HTMLDialogElement>(null);
  const actionDialogRef = useRef<HTMLDialogElement>(null);
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>(createInitialEmailCampaigns);
  const campaignsRef = useRef(campaigns);
  const [filter, setFilter] = useState<CampaignFilter>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [action, setAction] = useState<DialogAction | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [scoreSettings, setScoreSettings] = useState<LeadScoringSettings>(DEFAULT_LEAD_SCORING);
  const [campaignSerial, setCampaignSerial] = useState(7);

  const selected = campaigns.find((campaign) => campaign.id === selectedId) ?? null;
  const actionCampaign = action && "campaignId" in action ? campaigns.find((campaign) => campaign.id === action.campaignId) ?? null : null;
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return campaigns.filter((campaign) => filter === "all" || campaign.status === filter)
      .filter((campaign) => !term || `${campaign.name} ${campaign.subject} ${campaign.audience}`.toLowerCase().includes(term))
      .sort(campaignSort);
  }, [campaigns, filter, query]);
  const sent = campaigns.filter((campaign) => campaign.status === "sent");
  const totalRecipients = sent.reduce((sum, campaign) => sum + campaign.recipients, 0) || 1;
  const averageOpen = sent.reduce((sum, campaign) => sum + campaign.opens * campaign.recipients, 0) / totalRecipients;
  const averageClick = sent.reduce((sum, campaign) => sum + campaign.clicks * campaign.recipients, 0) / totalRecipients;
  const recentSent = sent.filter((campaign) => campaign.at >= NOW - 30 * DAY);
  const recentRevenue = recentSent.reduce((sum, campaign) => sum + campaign.revenue, 0);

  useEffect(() => { campaignsRef.current = campaigns; }, [campaigns]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = readCampaigns(saved);
        if (parsed) {
          // Restore saved campaigns in the existing mount effect to preserve startup behavior.
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setCampaigns(parsed);
          campaignsRef.current = parsed;
          setCampaignSerial(Math.max(7, ...parsed.map((campaign) => Number(campaign.id.replace(/^e/, "")) + 1 || 7)));
        }
      } else localStorage.setItem(STORAGE_KEY, JSON.stringify(createInitialEmailCampaigns()));
    } catch { /* Keep the campaign view available if storage is blocked. */ }
  }, []);

  useEffect(() => {
    const refresh = () => setScoreSettings(readLeadScoringSettings());
    // Restore saved scoring settings after mount.
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("corbel:lead-scoring-updated", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("corbel:lead-scoring-updated", refresh);
    };
  }, []);

  const persist = (next: EmailCampaign[]) => {
    campaignsRef.current = next;
    setCampaigns(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
    catch { /* State remains available for this session. */ }
  };
  const announce = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3800);
  };

  useGSAP(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.fromTo(".em-stats .stat", { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.46, stagger: 0.06, delay: 0.12, ease: "power3.out", clearProps: "transform,opacity" });
    gsap.fromTo(".em-list", { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.56, delay: 0.2, ease: "power3.out", clearProps: "transform,opacity" });
  }, { dependencies: [], scope: rootRef });

  useGSAP(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rows = rowsRef.current?.querySelectorAll<HTMLElement>(".em-row");
    if (rows?.length) gsap.fromTo(rows, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.38, stagger: 0.035, ease: "power3.out", clearProps: "transform,opacity" });
    rowsRef.current?.querySelectorAll<HTMLElement>(".meter__fill").forEach((bar, index) => {
      gsap.fromTo(bar, { scaleX: 0 }, { scaleX: Number(bar.dataset.v), duration: 0.85, delay: 0.16 + index * 0.035, ease: "expo.out" });
    });
  }, { dependencies: [filter, query, campaigns.map((campaign) => campaign.id + campaign.status).join("|")], scope: rootRef });

  useGSAP(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const values = [18760, averageOpen * 100, averageClick * 100, recentRevenue];
    const elements = Array.from(rootRef.current?.querySelectorAll<HTMLElement>(".em-stats .stat__val") ?? []);
    elements.forEach((element, index) => {
      const target = values[index] ?? 0;
      const proxy = { value: reduced ? target : 0 };
      const render = () => { element.textContent = index === 1 || index === 2 ? `${proxy.value.toFixed(1)}%` : index === 3 ? currency(proxy.value) : Math.round(proxy.value).toLocaleString("en-US"); };
      render();
      if (!reduced) gsap.to(proxy, { value: target, duration: 1, delay: 0.22 + index * 0.08, ease: "power3.out", onUpdate: render });
    });
  }, { dependencies: [campaigns], scope: rootRef });

  useEffect(() => {
    const dialog = detailsRef.current;
    if (!dialog) return;
    if (selected && !dialog.open) {
      dialog.showModal();
      setPreviewMode("desktop");
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.fromTo(dialog.querySelector(".sheet__box"), { opacity: 0, x: 26 }, { opacity: 1, x: 0, duration: 0.48, ease: "power3.out" });
        gsap.fromTo(dialog.querySelectorAll(".em-meta, .em-prev, .em-results"), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.42, stagger: 0.07, delay: 0.12, ease: "power3.out" });
      }
    } else if (!selected && dialog.open) dialog.close();
  }, [selectedId, selected]);

  useGSAP(() => {
    if (!selected || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rings = detailsRef.current?.querySelectorAll<HTMLElement>(".em-ring");
    rings?.forEach((ring, index) => {
      const value = Number(ring.dataset.v);
      const arc = ring.querySelector<SVGCircleElement>(".em-ring__val");
      const label = ring.querySelector<HTMLElement>("[data-ring]");
      if (!arc || !label) return;
      const counter = { value: 0 };
      label.textContent = "0%";
      gsap.fromTo(arc, { strokeDashoffset: 100 }, { strokeDashoffset: 100 - value * 100, duration: 1.1, delay: 0.3 + index * 0.14, ease: "power3.inOut" });
      gsap.to(counter, { value: value * 100, duration: 1.1, delay: 0.3 + index * 0.14, ease: "power3.out", onUpdate: () => { label.textContent = `${Math.round(counter.value)}%`; } });
    });
    const revenue = detailsRef.current?.querySelector<HTMLElement>("[data-rev]");
    if (revenue && selected.status === "sent") {
      const counter = { value: 0 };
      gsap.to(counter, { value: selected.revenue, duration: 1.1, delay: 0.5, ease: "power3.out", onUpdate: () => { revenue.textContent = currency(counter.value); } });
    }
  }, { dependencies: [selectedId, selected?.status, selected?.opens, selected?.clicks, selected?.revenue], scope: detailsRef });

  useEffect(() => {
    const dialog = actionDialogRef.current;
    if (!dialog) return;
    if (action && !dialog.open) {
      dialog.showModal();
      setError("");
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) gsap.fromTo(dialog.querySelector(".modal__box"), { opacity: 0, y: 14, scale: 0.98 }, { opacity: 1, y: 0, scale: 1, duration: 0.42, ease: "power3.out" });
    } else if (!action && dialog.open) dialog.close();
  }, [action]);

  const closeDetails = () => setSelectedId(null);
  const getActionCampaign = () => action && "campaignId" in action ? campaignsRef.current.find((campaign) => campaign.id === action.campaignId) : undefined;
  const confirmAction = () => {
    if (!action || (action.kind !== "send" && action.kind !== "delete")) return;
    const current = getActionCampaign();
    if (!current) { setAction(null); return; }
    if (action.kind === "send") {
      const openRate = 0.38 + 0.24 * campaignHash(`${current.id}open`);
      const clickRate = openRate * (0.13 + 0.12 * campaignHash(`${current.id}click`));
      const revenue = Math.round(current.recipients * clickRate * 0.11 * 920 / 10) * 10;
      persist(campaignsRef.current.map((campaign) => campaign.id === current.id ? { ...campaign, status: "sent" as const, at: Date.now(), opens: +openRate.toFixed(3), clicks: +clickRate.toFixed(3), revenue } : campaign));
      announce(`Sent to ${current.recipients.toLocaleString("en-US")} people`);
    } else {
      persist(campaignsRef.current.filter((campaign) => campaign.id !== current.id));
      if (selectedId === current.id) closeDetails();
      announce(`Deleted “${current.name}”`);
    }
    setAction(null);
  };
  const submitAction = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!action) return;
    const current = getActionCampaign();
    const form = new FormData(event.currentTarget);
    if (action.kind === "create" || action.kind === "edit") {
      const name = String(form.get("name") ?? "").trim();
      const subject = String(form.get("subject") ?? "").trim();
      if (!name || !subject) { setError(!name ? "Give the campaign a name." : "Add a subject line."); return; }
      const audienceName = String(form.get("audience") ?? EMAIL_AUDIENCES[0].name);
      const audience = EMAIL_AUDIENCES.find((item) => item.name === audienceName) ?? EMAIL_AUDIENCES[0];
      if (action.kind === "create") {
        const campaign: EmailCampaign = { id: `e${campaignSerial}`, name, subject, preview: String(form.get("preview") ?? "").trim(), status: "draft", audience: audience.name, recipients: audience.count, at: NOW, opens: 0, clicks: 0, revenue: 0, hue: Math.floor(campaignHash(name) * 360) };
        persist([campaign, ...campaignsRef.current]);
        setCampaignSerial((serial) => serial + 1);
        announce(`“${name}” saved as a draft`);
      } else if (current) {
        persist(campaignsRef.current.map((campaign) => campaign.id === current.id ? { ...campaign, name, subject, preview: String(form.get("preview") ?? "").trim(), audience: audience.name, recipients: audience.count } : campaign));
        announce("Changes saved");
      }
      setAction(null);
      return;
    }
    if (!current) { setAction(null); return; }
    if (action.kind === "schedule") {
      const at = new Date(String(form.get("at") ?? "")).getTime();
      if (!Number.isFinite(at) || at <= Date.now()) { setError("Pick a date and time in the future."); return; }
      persist(campaignsRef.current.map((campaign) => campaign.id === current.id ? { ...campaign, status: "scheduled" as const, at } : campaign));
      announce(`Scheduled for ${shortDate(at)} at ${timeText(at)}`);
    } else if (action.kind === "test") {
      const email = String(form.get("email") ?? "").trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("Enter a valid email address."); return; }
      announce(`Test email sent to ${email}`);
    } else if (action.kind === "send") {
      const openRate = 0.38 + 0.24 * campaignHash(`${current.id}open`);
      const clickRate = openRate * (0.13 + 0.12 * campaignHash(`${current.id}click`));
      const revenue = Math.round(current.recipients * clickRate * 0.11 * 920 / 10) * 10;
      persist(campaignsRef.current.map((campaign) => campaign.id === current.id ? { ...campaign, status: "sent" as const, at: Date.now(), opens: +openRate.toFixed(3), clicks: +clickRate.toFixed(3), revenue } : campaign));
      announce(`Sent to ${current.recipients.toLocaleString("en-US")} people`);
    } else if (action.kind === "delete") {
      persist(campaignsRef.current.filter((campaign) => campaign.id !== current.id));
      if (selectedId === current.id) closeDetails();
      announce(`Deleted “${current.name}”`);
    }
    setAction(null);
  };

  const startDuplicate = (campaign: EmailCampaign) => {
    const duplicate: EmailCampaign = { ...campaign, id: `e${campaignSerial}`, name: `${campaign.name} (copy)`.slice(0, 60), status: "draft", at: Date.now(), opens: 0, clicks: 0, revenue: 0 };
    persist([duplicate, ...campaignsRef.current]);
    setCampaignSerial((serial) => serial + 1);
    announce(`Duplicated as “${duplicate.name}”`);
    closeDetails();
    setSelectedId(duplicate.id);
  };

  const actionTitle = !action ? "" : action.kind === "create" ? "New campaign" : action.kind === "edit" ? "Edit campaign" : action.kind === "schedule" ? actionCampaign?.status === "scheduled" ? "Reschedule campaign" : "Schedule campaign" : action.kind === "test" ? "Send a test email" : action.kind === "send" ? "Send this campaign now?" : "Delete this draft?";
  const actionDescription = actionCampaign ? `“${actionCampaign.name}” goes to ${actionCampaign.recipients.toLocaleString("en-US")} people in ${actionCampaign.audience}.` : "";
  const actionUsesForm = action?.kind === "create" || action?.kind === "edit" || action?.kind === "schedule" || action?.kind === "test";

  return <div ref={rootRef} className="view em-view" data-view="email">
    <section className="card statbar em-stats" style={{ "--n": 4 } as CSSProperties} aria-label="Email at a glance">
      <div className="stat"><span className="stat__label">Subscribers</span><b className="stat__val">18,760</b><span className="stat__meta">+412 in the last 30 days</span></div>
      <div className="stat"><span className="stat__label">Average open rate</span><b className="stat__val">{(averageOpen * 100).toFixed(1)}%</b><span className="stat__meta">Across {sent.length} sent campaigns</span></div>
      <div className="stat"><span className="stat__label">Average click rate</span><b className="stat__val">{(averageClick * 100).toFixed(1)}%</b><span className="stat__meta">Of all recipients</span></div>
      <div className="stat"><span className="stat__label">Email revenue, 30 days</span><b className="stat__val">{currency(recentRevenue)}</b><span className="stat__meta">From {recentSent.length} recent campaigns</span></div>
    </section>

    <div className="toolbar em-toolbar">
      <FilterTabs value={filter} onChange={setFilter} />
      <label className="input-icon em-search"><Icon name="search" /><span className="sr-only">Search campaigns</span><input className="input" type="search" placeholder="Search campaigns" value={query} onChange={(event) => setQuery(event.target.value)} autoComplete="off" /></label>
      <div className="toolbar__end"><button className="btn btn--primary" type="button" onClick={() => setAction({ kind: "create" })}><Icon name="plus" />New campaign</button></div>
    </div>

    <section className="card em-list" aria-labelledby="em-list-h">
      <div className="card__head"><h2 className="card__title" id="em-list-h">Campaigns</h2><span className="card__actions card__sub" aria-live="polite">{filtered.length === campaigns.length ? `${campaigns.length} campaigns` : `${filtered.length} of ${campaigns.length}`}</span></div>
      <div className="em-cols" aria-hidden="true"><span>Campaign</span><span>Status</span><span>Audience</span><span>Date</span><span>Opens</span><span>Clicks</span><span className="em-num">Revenue</span></div>
      <ul ref={rowsRef} className="em-rows">
        {filtered.length ? filtered.map((campaign) => {
          const scoredLead = SEEDED_EMAIL_LEADS.find((lead) => lead.campaignId === campaign.id);
          return <li key={campaign.id}>
          <button className="em-row" type="button" onClick={() => { setPreviewMode("desktop"); setSelectedId(campaign.id); }}>
            <span className="em-row__name"><span className="thumb" style={{ "--h": campaign.hue } as CSSProperties}>{campaign.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span><span><b>{campaign.name}</b><small>{campaign.subject}</small></span></span>
            <span className="em-row__status"><span className={`pill pill--${STATUS[campaign.status].tone}`}>{STATUS[campaign.status].label}</span></span>
            <span className="em-row__aud"><span>{campaign.audience}</span><small>{campaign.recipients.toLocaleString("en-US")} people</small>{scoredLead && (() => { const score = calculateLeadScore(scoredLead, scoreSettings); return <span className={`pill pill--${leadScoreTone(score, scoreSettings)}`} aria-label={`${scoredLead.name}: lead score ${score}, ${leadScoreLabel(score, scoreSettings)}`}>{scoredLead.name.split(" ")[0]} {score} · {leadScoreLabel(score, scoreSettings)}</span>; })()}</span>
            <span className="em-row__date"><span>{campaign.status === "sent" ? `Sent ${shortDate(campaign.at)}` : campaign.status === "scheduled" ? <><Icon name="clock" className="em-ico-sm" />{shortDate(campaign.at)}</> : "Not sent"}</span><small>{campaign.status === "sent" ? timeText(campaign.at) : campaign.status === "scheduled" ? timeText(campaign.at) : "Draft"}</small></span>
            <span className={`em-rate${campaign.status === "sent" ? " em-rate--open" : " em-rate--none"}`}><span className="em-rate__lbl">Opens</span><b>{campaign.status === "sent" ? `${(campaign.opens * 100).toFixed(1)}%` : "—"}</b>{campaign.status === "sent" && <span className="meter"><span className="meter__fill" data-v={campaign.opens} style={{ transform: `scaleX(${campaign.opens})`, transformOrigin: "left" }} /></span>}</span>
            <span className={`em-rate em-rate--click${campaign.status !== "sent" ? " em-rate--none" : ""}`}><span className="em-rate__lbl">Clicks</span><b>{campaign.status === "sent" ? `${(campaign.clicks * 100).toFixed(1)}%` : "—"}</b>{campaign.status === "sent" && <span className="meter"><span className="meter__fill" data-v={campaign.clicks} style={{ transform: `scaleX(${campaign.clicks})`, transformOrigin: "left" }} /></span>}</span>
            <span className="em-row__rev"><b>{campaign.status === "sent" ? currency(campaign.revenue) : "—"}</b></span>
          </button>
        </li>}) : <li className="em-row-empty"><div className="empty"><Icon name="mail" /><b>{query ? "No campaigns match" : "Nothing here yet"}</b><span>{query ? "Try another name, subject or audience." : "Campaigns with this status will show here."}</span></div></li>}
      </ul>
    </section>

    <dialog ref={detailsRef} className="sheet" aria-label="Campaign details" onCancel={closeDetails} onClose={() => setSelectedId(null)} onClick={(event) => { if (event.target === detailsRef.current) closeDetails(); }}>
      {selected && <div className="sheet__box"><header className="sheet__head"><h2 id="sheet-title">{selected.name}</h2><button className="icon-btn" type="button" aria-label="Close campaign details" onClick={closeDetails}><Icon name="x" /></button></header>
        <div className="sheet__body"><div className="em-sheet" data-id={selected.id}>
          <div className="em-meta"><span className={`pill pill--${STATUS[selected.status].tone}`}>{STATUS[selected.status].label}</span><span className="em-meta__aud"><b>{selected.audience}</b><span>{selected.recipients.toLocaleString("en-US")} people</span></span>{selected.status !== "sent" && <button className="btn btn--ghost btn--sm em-meta__edit" type="button" onClick={() => { setSelectedId(null); setAction({ kind: "edit", campaignId: selected.id }); }}><Icon name="edit" />Edit</button>}</div>
          <EmailPreview campaign={selected} mode={previewMode} onModeChange={setPreviewMode} />
          <section className="em-results" aria-labelledby="em-res-h"><h3 id="em-res-h">Results</h3><Results campaign={selected} /></section>
        </div></div>
        <footer className="sheet__foot em-foot">
          {selected.status === "draft" && <button className="btn btn--ghost btn--danger em-foot__left" type="button" onClick={() => setAction({ kind: "delete", campaignId: selected.id })}><Icon name="trash" />Delete</button>}
          {selected.status === "scheduled" && <button className="btn btn--ghost em-foot__left" type="button" onClick={() => { persist(campaignsRef.current.map((campaign) => campaign.id === selected.id ? { ...campaign, status: "draft" as const, at: Date.now() } : campaign)); announce(`“${selected.name}” moved to drafts`); }}><Icon name="edit" />Move to drafts</button>}
          {selected.status === "sent" ? <><button className="btn" type="button" onClick={() => startDuplicate(selected)}><Icon name="copy" />Duplicate</button><button className="btn btn--primary" type="button" onClick={() => setAction({ kind: "test", campaignId: selected.id })}><Icon name="send" />Send test</button></> : <><button className="btn em-foot__icon" type="button" aria-label="Duplicate campaign" title="Duplicate" onClick={() => startDuplicate(selected)}><Icon name="copy" /></button><button className="btn" type="button" onClick={() => setAction({ kind: "test", campaignId: selected.id })}><Icon name="send" />Send test</button><button className="btn" type="button" onClick={() => setAction({ kind: "schedule", campaignId: selected.id })}><Icon name="calendar" />{selected.status === "scheduled" ? "Reschedule" : "Schedule"}</button><button className="btn btn--primary" type="button" onClick={() => setAction({ kind: "send", campaignId: selected.id })}><Icon name="send" />Send now</button></>}
        </footer>
      </div>}
    </dialog>

    <dialog ref={actionDialogRef} className="modal" aria-label={actionTitle} onCancel={() => setAction(null)} onClose={() => setAction(null)} onClick={(event) => { if (event.target === actionDialogRef.current) setAction(null); }}>
      {action && <div className="modal__box"><header className="modal__head"><h2 className="modal__title">{actionTitle}</h2><button className="icon-btn" type="button" aria-label="Close" onClick={() => setAction(null)}><Icon name="x" /></button></header>
        {actionUsesForm ? <form id="em-action-form" className="modal__body em-form" noValidate onSubmit={submitAction}>
          {(action.kind === "create" || action.kind === "edit") && <>
            <label className="field"><span className="label">Campaign name</span><input className="input" name="name" required maxLength={60} placeholder="For example, Spring team update" defaultValue={action.kind === "edit" ? actionCampaign?.name : ""} /></label>
            <label className="field"><span className="label">Subject line</span><input className="input" name="subject" required maxLength={90} placeholder="What people see in their inbox" defaultValue={action.kind === "edit" ? actionCampaign?.subject : ""} /></label>
            <label className="field"><span className="label">Preview text <small className="em-opt">optional</small></span><input className="input" name="preview" maxLength={120} placeholder="The line shown after the subject" defaultValue={action.kind === "edit" ? actionCampaign?.preview : ""} /></label>
            <label className="field"><span className="label">Audience</span><select className="select" name="audience" defaultValue={action.kind === "edit" ? actionCampaign?.audience : EMAIL_AUDIENCES[0].name}>{EMAIL_AUDIENCES.map((audience) => <option value={audience.name} key={audience.name}>{audience.name} ({audience.count.toLocaleString("en-US")})</option>)}</select></label>
          </>}
          {/* The current time sets scheduling bounds in this event-driven form, as before. */}
          {/* eslint-disable-next-line react-hooks/purity */}
          {action.kind === "schedule" && <><p className="card__sub em-form__lead">{actionDescription}</p><label className="field"><span className="label">Send on</span><input className="input" type="datetime-local" name="at" min={dateTimeInput(Date.now() + 60 * 60 * 1000)} defaultValue={dateTimeInput(actionCampaign?.status === "scheduled" && actionCampaign.at > Date.now() ? actionCampaign.at : NOW + DAY)} required /></label></>}
          {action.kind === "test" && <><p className="card__sub em-form__lead">We’ll send “{actionCampaign?.subject}” to this address so you can check the preview.</p><label className="field"><span className="label">Email address</span><input className="input" type="email" name="email" required placeholder="you@example.com" /></label></>}
          {error && <p className="em-form__err" role="alert">{error}</p>}
        </form> : <div className="modal__body em-form"><p className="card__sub em-form__lead">{actionDescription}{action.kind === "send" && " You can’t unsend an email."}{action.kind === "delete" && " This draft will be deleted. This can’t be undone."}</p>{error && <p className="em-form__err" role="alert">{error}</p>}</div>}
        <footer className="modal__foot"><button className="btn" type="button" onClick={() => setAction(null)}>Cancel</button>
          {actionUsesForm ? <button className="btn btn--primary" type="submit" form="em-action-form">{action.kind === "create" ? <><Icon name="plus" />Create draft</> : action.kind === "edit" ? "Save changes" : action.kind === "schedule" ? <><Icon name="calendar" />Schedule</> : <><Icon name="send" />Send test</>}</button> : <button className={`btn ${action.kind === "delete" ? "btn--danger" : "btn--primary"}`} type="button" onClick={confirmAction}>{action.kind === "send" ? <><Icon name="send" />Send now</> : <><Icon name="trash" />Delete draft</>}</button>}
        </footer>
      </div>}
    </dialog>
    {toast && <div className="toasts" aria-live="polite"><div className="toast" role="status"><span className="toast__ico"><Icon name="check" /></span><span>{toast}</span></div></div>}
  </div>;
}
