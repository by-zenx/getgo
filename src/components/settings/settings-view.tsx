"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Icon } from "@/components/icons/svg-sprite";
import { moveSegmentPill } from "@/lib/segment-motion";

type SettingsTab = "profile" | "store" | "notifications" | "team" | "plan";
type Palette = "mono" | "pastel" | "ocean" | "sage";
type Theme = "light" | "dark";
type SettingsModel = {
  name: string;
  email: string;
  store: string;
  currency: "USD" | "EUR" | "GBP";
  timezone: string;
  notify: Record<"orders" | "stock" | "messages" | "weekly" | "marketing", boolean>;
  shops: {
    main: { street: string; city: string; hours: string };
    harbor: { street: string; city: string; hours: string };
  };
  plan: "Pro trial" | "Plus";
  plusSince?: number;
};
type TeamMember = {
  name: string;
  email: string;
  role: string;
  hue: number;
  pending?: boolean;
  invited?: number;
};

const SETTINGS_KEY = "corbel:settings";
const TEAM_KEY = "corbel:settings:team";
const DEMO_NOW = Date.UTC(2026, 9, 26, 12);
const DEFAULT_SETTINGS: SettingsModel = {
  name: "Mara Reyes",
  email: "mara@corbelsupply.co",
  store: "Corbel Supply Co.",
  currency: "USD",
  timezone: "America/Los_Angeles",
  notify: { orders: true, stock: true, messages: true, weekly: true, marketing: false },
  shops: {
    main: { street: "118 Main Street", city: "Beacon, NY 12508", hours: "Mon–Sat, 10 AM – 6 PM" },
    harbor: { street: "4 Harbor Walk", city: "Cold Spring, NY 10516", hours: "Wed–Sun, 11 AM – 7 PM" },
  },
  plan: "Pro trial",
};
const INITIAL_TEAM: TeamMember[] = [
  { name: "Mara Reyes", email: "mara@corbelsupply.co", role: "Owner", hue: 206 },
  { name: "Jonah Okafor", email: "jonah@corbelsupply.co", role: "Store manager", hue: 162 },
  { name: "Ana Petrova", email: "ana@corbelsupply.co", role: "Marketing", hue: 12 },
  { name: "Leo Tanaka", email: "leo@corbelsupply.co", role: "Fulfilment", hue: 181 },
  { name: "Priya Shah", email: "priya@corbelsupply.co", role: "Support", hue: 330 },
];
const TABS: { id: SettingsTab; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "store", label: "Store" },
  { id: "notifications", label: "Notifications" },
  { id: "team", label: "Team" },
  { id: "plan", label: "Plan & billing" },
];
const PALETTES: { id: Palette; label: string; swatches: string[] }[] = [
  { id: "mono", label: "Mono", swatches: ["#121212", "#ffffff", "#e2e2de", "#a6a6a1"] },
  { id: "pastel", label: "Pastel", swatches: ["#a9d2f1", "#a7e1ca", "#f1e08f", "#f6b4a3"] },
  { id: "ocean", label: "Ocean", swatches: ["#173f5f", "#9fcbef", "#9fdce0", "#8fc6d6"] },
  { id: "sage", label: "Sage", swatches: ["#234a3a", "#bfe0c4", "#ece2a8", "#e9c9a7"] },
];
const NOTIFICATIONS = [
  { id: "orders", title: "New orders", description: "A ping for every order, online or in the shops." },
  { id: "stock", title: "Low stock", description: "When a product falls below its reorder point." },
  { id: "messages", title: "Customer messages", description: "New chats, emails and Instagram messages." },
  { id: "weekly", title: "Weekly report", description: "Sales, top products and visits, every Monday at 8 AM." },
  { id: "marketing", title: "Product news", description: "New Corbel features and tips, about once a month." },
] as const;
const ROLES = ["Admin", "Store manager", "Marketing", "Fulfilment", "Support", "Viewer"];
const TIMEZONES = [
  ["America/Los_Angeles", "Pacific time — Los Angeles"],
  ["America/Denver", "Mountain time — Denver"],
  ["America/Chicago", "Central time — Chicago"],
  ["America/New_York", "Eastern time — New York"],
  ["Europe/London", "United Kingdom — London"],
  ["Europe/Berlin", "Central Europe — Berlin"],
];
const STARTER_FEATURES = ["Up to 10 teammates", "5 automations", "Standard analytics", "Email support"];
const PLUS_FEATURES = [
  "Sales forecasting, 12 months out",
  "Unlimited automations",
  "Cohorts and advanced analytics",
  "Up to 25 teammates",
  "Priority support, replies within an hour",
];

function safeRead<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return fallback;
    const parsed = JSON.parse(stored) as T;
    if (Array.isArray(fallback)) return (Array.isArray(parsed) ? parsed : fallback) as unknown as T;
    return { ...(fallback as object), ...(parsed as object) } as unknown as T;
  } catch {
    return fallback;
  }
}

function getTabFromHash(): SettingsTab {
  const key = window.location.hash.split("/").filter(Boolean).at(-1);
  return TABS.some((tab) => tab.id === key) ? (key as SettingsTab) : "profile";
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase() || "MR";
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(timestamp);
}

function formatMoney(amount: number, currency: SettingsModel["currency"]) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

function Field({
  label,
  id: customId,
  inputRef,
  value,
  onChange,
  type = "text",
  hint,
  error,
  wide = false,
  ...props
}: {
  label: string;
  id?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  hint?: string;
  error?: string;
  wide?: boolean;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "className" | "aria-invalid" | "aria-describedby">) {
  const id = customId ?? `setting-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <label className={`field${wide ? " set-grid__wide" : ""}`} htmlFor={id}>
      <span className="label">{label}</span>
      <input
        {...props}
        ref={inputRef}
        id={id}
        className="input"
        type={type}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error && <span className="set-err" id={`${id}-error`}>{error}</span>}
      {hint && <span className="set-hint" id={`${id}-hint`}>{hint}</span>}
    </label>
  );
}

export function SettingsView() {
  const rootRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const tabsPillRef = useRef<HTMLSpanElement>(null);
  const themePillRef = useRef<HTMLSpanElement>(null);
  const tabPillPositionedRef = useRef(false);
  const themePillPositionedRef = useRef(false);
  const inviteDialogRef = useRef<HTMLDialogElement>(null);
  const actionDialogRef = useRef<HTMLDialogElement>(null);
  const inviteInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [trialEnd, setTrialEnd] = useState(DEMO_NOW + 9 * 24 * 60 * 60 * 1000);
  const [draft, setDraft] = useState<SettingsModel>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState<SettingsModel>(DEFAULT_SETTINGS);
  const [team, setTeam] = useState<TeamMember[]>(INITIAL_TEAM);
  const [theme, setTheme] = useState<Theme>("light");
  const [palette, setPalette] = useState<Palette>("mono");
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string; store?: string }>({});
  const [message, setMessage] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Support");
  const [inviteError, setInviteError] = useState("");
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null);
  const [planAction, setPlanAction] = useState<"upgrade" | "cancel" | null>(null);

  const isDirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);
  const seatLimit = draft.plan === "Plus" ? 25 : 10;
  const pendingCount = team.filter((member) => member.pending).length;
  useEffect(() => {
    setTrialEnd(Date.now() + 9 * 24 * 60 * 60 * 1000);
    const stored = safeRead<SettingsModel>(SETTINGS_KEY, DEFAULT_SETTINGS);
    setDraft(stored);
    setSaved(stored);
    setTeam(safeRead<TeamMember[]>(TEAM_KEY, INITIAL_TEAM));
    const currentTheme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    const currentPalette = (document.documentElement.dataset.palette || "mono") as Palette;
    setTheme(currentTheme);
    setPalette(PALETTES.some((item) => item.id === currentPalette) ? currentPalette : "mono");
    setActiveTab(getTabFromHash());

    const syncHash = () => setActiveTab(getTabFromHash());
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  useGSAP(() => {
    const activeButton = tabsRef.current?.querySelector<HTMLElement>(`[data-tab="${activeTab}"]`);
    const pill = tabsPillRef.current;
    if (activeButton && pill && tabsRef.current) {
      moveSegmentPill(pill, activeButton, !tabPillPositionedRef.current);
      tabPillPositionedRef.current = true;
      activeButton.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    }

    const panel = rootRef.current?.querySelector<HTMLElement>(`#set-panel-${activeTab}`);
    if (panel && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.fromTo(
        panel.querySelectorAll<HTMLElement>(":scope > .card, :scope > .set-plans > .card"),
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.68, ease: "expo.out", stagger: 0.06, clearProps: "transform,opacity" }
      );
      gsap.fromTo(
        panel.querySelectorAll<HTMLElement>(".field, .set-row, .set-shop, .set-mate, .set-avatar"),
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.45, ease: "power3.out", stagger: 0.025, delay: 0.1, clearProps: "transform,opacity" }
      );
    }
  }, { dependencies: [activeTab], scope: rootRef });

  useGSAP(() => {
    const toggle = rootRef.current?.querySelector<HTMLElement>(".set-theme");
    const active = toggle?.querySelectorAll<HTMLButtonElement>("button")[theme === "dark" ? 1 : 0];
    if (!active || !themePillRef.current) return;
    moveSegmentPill(themePillRef.current, active, !themePillPositionedRef.current);
    themePillPositionedRef.current = true;
  }, { dependencies: [theme], scope: rootRef });

  useEffect(() => {
    const dialog = inviteDialogRef.current;
    if (!dialog) return;
    if (inviteOpen && !dialog.open) {
      dialog.showModal();
      inviteInputRef.current?.focus();
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.fromTo(dialog.querySelector(".modal__box"), { opacity: 0, y: 22, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.42, ease: "power3.out" });
      }
    } else if (!inviteOpen && dialog.open) dialog.close();
  }, [inviteOpen]);

  useEffect(() => {
    const dialog = actionDialogRef.current;
    if (!dialog) return;
    const shouldOpen = !!removeTarget || !!planAction;
    if (shouldOpen && !dialog.open) {
      dialog.showModal();
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.fromTo(dialog.querySelector(".modal__box"), { opacity: 0, y: 18, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.38, ease: "power3.out" });
      }
    } else if (!shouldOpen && dialog.open) dialog.close();
  }, [removeTarget, planAction]);

  const selectTab = (tab: SettingsTab) => {
    setActiveTab(tab);
    window.history.replaceState(null, "", `${window.location.pathname}#/settings/${tab}`);
  };

  const updateDraft = <K extends keyof SettingsModel>(key: K, value: SettingsModel[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const updateShop = (shop: "main" | "harbor", key: "street" | "city" | "hours", value: string) => {
    setDraft((current) => ({ ...current, shops: { ...current.shops, [shop]: { ...current.shops[shop], [key]: value } } }));
  };

  const updateNotification = (id: keyof SettingsModel["notify"], checked: boolean) => {
    setDraft((current) => ({ ...current, notify: { ...current.notify, [id]: checked } }));
  };

  const changeTheme = (next: Theme) => {
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("corbel:theme", JSON.stringify(next)); } catch {}
  };

  const changePalette = (next: Palette) => {
    setPalette(next);
    document.documentElement.dataset.palette = next;
    try { localStorage.setItem("corbel:palette", JSON.stringify(next)); } catch {}
  };

  const saveSettings = (event?: FormEvent) => {
    event?.preventDefault();
    const errors: typeof fieldErrors = {};
    if (!draft.name.trim()) errors.name = "Enter your name";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(draft.email.trim())) errors.email = "Enter an email like name@shop.com";
    if (!draft.store.trim()) errors.store = "Your store needs a name";
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      const firstTab: SettingsTab = errors.store ? "store" : "profile";
      selectTab(firstTab);
      window.setTimeout(() => rootRef.current?.querySelector<HTMLElement>(errors.store ? "#setting-store-name" : errors.email ? "#setting-email" : "#setting-full-name")?.focus(), 100);
      setMessage("Check the highlighted field");
      return;
    }
    const next = { ...draft, name: draft.name.trim(), email: draft.email.trim(), store: draft.store.trim() };
    setDraft(next);
    setSaved(next);
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch {}
    window.dispatchEvent(new CustomEvent("corbel:settings-update", { detail: { store: next.store, name: next.name, plan: next.plan } }));
    setMessage("Settings saved");
  };

  useEffect(() => {
    const handleSaveShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s" && isDirty) {
        event.preventDefault();
        rootRef.current?.querySelector<HTMLFormElement>(".set-form")?.requestSubmit();
      }
    };
    window.addEventListener("keydown", handleSaveShortcut);
    return () => window.removeEventListener("keydown", handleSaveShortcut);
  }, [isDirty]);

  const discardChanges = () => {
    setDraft(saved);
    setFieldErrors({});
    setMessage("Changes discarded");
  };

  const saveTeam = (members: TeamMember[]) => {
    setTeam(members);
    try { localStorage.setItem(TEAM_KEY, JSON.stringify(members)); } catch {}
  };

  const sendInvite = (event: FormEvent) => {
    event.preventDefault();
    const email = inviteEmail.trim().toLowerCase();
    const error = !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)
      ? "Enter an email like name@shop.com"
      : team.some((member) => member.email.toLowerCase() === email)
        ? "That person is already on the team"
        : team.length >= seatLimit
          ? `Your plan has ${seatLimit} seats. Upgrade for more.`
          : "";
    setInviteError(error);
    if (error) {
      inviteInputRef.current?.focus();
      return;
    }
    saveTeam([...team, { name: email, email, role: inviteRole, hue: 220, pending: true, invited: Date.now() }]);
    setInviteOpen(false);
    setInviteEmail("");
    setInviteError("");
    setMessage(`Invite sent to ${email}`);
  };

  const confirmTeamRemoval = () => {
    if (removeTarget) saveTeam(team.filter((member) => member !== removeTarget));
    setRemoveTarget(null);
    setMessage(removeTarget?.pending ? "Invitation cancelled" : "Teammate removed");
  };

  const confirmPlanAction = () => {
    const now = Date.now();
    const nextPlan: SettingsModel["plan"] = planAction === "upgrade" ? "Plus" : "Pro trial";
    const next: SettingsModel = planAction === "upgrade"
      ? { ...draft, plan: "Plus", plusSince: now }
      : { ...draft, plan: "Pro trial", plusSince: undefined };
    const nextSaved: SettingsModel = planAction === "upgrade"
      ? { ...saved, plan: "Plus", plusSince: now }
      : { ...saved, plan: "Pro trial", plusSince: undefined };
    setDraft(next);
    setSaved(nextSaved);
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(nextSaved)); } catch {}
    window.dispatchEvent(new CustomEvent("corbel:settings-update", { detail: { store: nextSaved.store, name: nextSaved.name, plan: nextPlan } }));
    setPlanAction(null);
    setMessage(nextPlan === "Plus" ? "Welcome to Corbel Plus" : "Corbel Plus cancelled");
  };

  const downloadInvoice = (invoice: { id: string; date: number; item: string; amount: number }) => {
    const body = [
      `CORBEL — INVOICE ${invoice.id}`,
      "",
      `Billed to:   ${draft.store}`,
      `             ${draft.shops.main.street}, ${draft.shops.main.city}`,
      `Date:        ${formatDate(invoice.date)}`,
      `Item:        ${invoice.item}`,
      `Amount:      ${formatMoney(invoice.amount, draft.currency)}`,
      `Tax:         ${formatMoney(0, draft.currency)}`,
      `Total:       ${formatMoney(invoice.amount, draft.currency)}`,
      "",
      "Status:      Paid with Visa ending 4242",
      "",
      "Thank you for using Corbel.",
    ].join("\n");
    const url = URL.createObjectURL(new Blob([body], { type: "text/plain" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `corbel-${invoice.id}.txt`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const invoices = useMemo(() => {
    const now = Date.now();
    const rows = [0, 1, 2, 3].map((index) => {
      const date = now - (index * 30 + 1) * 24 * 60 * 60 * 1000;
      const at = new Date(date);
      return {
        id: `INV-${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}${String(at.getDate()).padStart(2, "0")}`,
        date,
        item: "Starter plan, monthly",
        amount: 29,
      };
    });
    if (draft.plan === "Plus") {
      const date = draft.plusSince ?? now;
      const at = new Date(date);
      rows.unshift({
        id: `INV-${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}${String(at.getDate()).padStart(2, "0")}P`,
        date,
        item: "Corbel Plus, monthly",
        amount: 79,
      });
    }
    return rows;
  }, [draft.plan, draft.plusSince]);

  return (
    <div ref={rootRef} data-view="settings">
      <div className="set-tabs">
        <div ref={tabsRef} className="seg set-seg" role="tablist" aria-label="Settings sections">
          <span ref={tabsPillRef} className="seg__pill" aria-hidden="true" />
          {TABS.map((tab) => (
            <button
              key={tab.id}
              id={`set-tab-${tab.id}`}
              type="button"
              role="tab"
              data-tab={tab.id}
              tabIndex={activeTab === tab.id ? 0 : -1}
              aria-selected={activeTab === tab.id}
              aria-controls={`set-panel-${tab.id}`}
              onClick={() => selectTab(tab.id)}
              onKeyDown={(event) => {
                const currentIndex = TABS.findIndex((item) => item.id === tab.id);
                const nextIndex = event.key === "ArrowRight" || event.key === "ArrowDown"
                  ? (currentIndex + 1) % TABS.length
                  : event.key === "ArrowLeft" || event.key === "ArrowUp"
                    ? (currentIndex - 1 + TABS.length) % TABS.length
                    : event.key === "Home" ? 0 : event.key === "End" ? TABS.length - 1 : -1;
                if (nextIndex < 0) return;
                event.preventDefault();
                const nextTab = TABS[nextIndex];
                selectTab(nextTab.id);
                tabsRef.current?.querySelector<HTMLButtonElement>(`[data-tab="${nextTab.id}"]`)?.focus();
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <form className="set-form" noValidate onSubmit={saveSettings}>
        <div className="set-panel" id="set-panel-profile" role="tabpanel" aria-labelledby="set-tab-profile" hidden={activeTab !== "profile"} tabIndex={-1}>
          <section className="card set-sec">
            <header className="set-sec__head"><h2>Your profile</h2><p className="card__sub">How you appear to your team and on order notes.</p></header>
            <div className="set-profile">
              <div className="set-avatar">
                <span className="av av--lg" style={{ ["--h" as any]: 206 }} aria-hidden="true">{initials(draft.name)}</span>
                <span className="set-avatar__txt"><b>{draft.name || " "}</b><small>Owner · {draft.store}</small></span>
              </div>
              <div className="set-grid">
                <Field label="Full name" value={draft.name} onChange={(value) => updateDraft("name", value)} autoComplete="name" maxLength={60} error={fieldErrors.name} />
                <Field label="Email" value={draft.email} onChange={(value) => updateDraft("email", value)} type="email" autoComplete="email" error={fieldErrors.email} />
                <Field label="Role" value="Owner" onChange={() => {}} readOnly hint="Only another owner can change this." />
              </div>
            </div>
          </section>

          <section className="card set-sec">
            <header className="set-sec__head"><h2>Appearance</h2><p className="card__sub">Applies straight away, on this device.</p></header>
            <div className="set-row">
              <span><b>Theme</b><small>Dark is easier on the eyes in the evening.</small></span>
              <div className="seg set-theme" role="radiogroup" aria-label="Theme">
                <span ref={themePillRef} className="seg__pill" aria-hidden="true" />
                {(["light", "dark"] as const).map((item, index) => (
                  <button key={item} type="button" role="radio" tabIndex={theme === item ? 0 : -1} aria-checked={theme === item} aria-selected={theme === item} onClick={() => changeTheme(item)} onKeyDown={(event) => {
                    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                    event.preventDefault();
                    const next = index === 0 ? "dark" : "light";
                    changeTheme(next);
                    rootRef.current?.querySelector<HTMLButtonElement>(`.set-theme button:nth-of-type(${next === "light" ? 1 : 2})`)?.focus();
                  }}>
                    {item === "light" ? "Light" : "Dark"}
                  </button>
                ))}
              </div>
            </div>
            <div className="set-row set-row--pal">
              <span><b id="set-pal-l">Colour</b><small>Black and white by default. Status colours keep their meaning in every palette.</small></span>
              <div className="pal" role="radiogroup" aria-labelledby="set-pal-l">
                {PALETTES.map((item) => (
                  <button key={item.id} type="button" className="pal__opt" role="radio" aria-checked={palette === item.id} tabIndex={palette === item.id ? 0 : -1} onClick={() => changePalette(item.id)} onKeyDown={(event) => {
                    if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(event.key)) return;
                    event.preventDefault();
                    const delta = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
                    const next = PALETTES[(PALETTES.findIndex((option) => option.id === item.id) + delta + PALETTES.length) % PALETTES.length];
                    changePalette(next.id);
                    event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[data-palette="${next.id}"]`)?.focus();
                  }} data-palette={item.id}>
                    <span className="pal__sw" aria-hidden="true">{item.swatches.map((color) => <i key={color} style={{ background: color }} />)}</span>
                    {item.label}{item.id === "mono" ? " (Default)" : ""}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>

        <div className="set-panel" id="set-panel-store" role="tabpanel" aria-labelledby="set-tab-store" hidden={activeTab !== "store"} tabIndex={-1}>
          <section className="card set-sec">
            <header className="set-sec__head"><h2>Store details</h2><p className="card__sub">Shown on receipts, invoices and the sidebar.</p></header>
            <div className="set-grid">
              <Field label="Store name" value={draft.store} onChange={(value) => updateDraft("store", value)} maxLength={40} error={fieldErrors.store} wide />
              <label className="field" htmlFor="setting-currency"><span className="label">Currency</span><select className="select" id="setting-currency" value={draft.currency} onChange={(event) => updateDraft("currency", event.target.value as SettingsModel["currency"])}><option value="USD">US dollar (USD)</option><option value="EUR">Euro (EUR)</option><option value="GBP">British pound (GBP)</option></select></label>
              <label className="field" htmlFor="setting-timezone"><span className="label">Time zone</span><select className="select" id="setting-timezone" value={draft.timezone} onChange={(event) => updateDraft("timezone", event.target.value)}>{TIMEZONES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
            </div>
          </section>
          <section className="card set-sec">
            <header className="set-sec__head"><h2>Shops</h2><p className="card__sub">Where customers collect orders and walk in.</p></header>
            <div className="set-shops">
              {(["main", "harbor"] as const).map((shop) => (
                <fieldset key={shop} className="set-shop">
                  <legend><Icon name="store" />{shop === "main" ? "Main St shop" : "Harbor shop"}</legend>
                  <Field id={`setting-${shop}-street`} label="Street address" value={draft.shops[shop].street} onChange={(value) => updateShop(shop, "street", value)} autoComplete="off" />
                  <Field id={`setting-${shop}-city`} label="Town and ZIP" value={draft.shops[shop].city} onChange={(value) => updateShop(shop, "city", value)} autoComplete="off" />
                  <Field id={`setting-${shop}-hours`} label="Opening hours" value={draft.shops[shop].hours} onChange={(value) => updateShop(shop, "hours", value)} autoComplete="off" />
                </fieldset>
              ))}
            </div>
          </section>
        </div>

        <div className="set-panel" id="set-panel-notifications" role="tabpanel" aria-labelledby="set-tab-notifications" hidden={activeTab !== "notifications"} tabIndex={-1}>
          <section className="card set-sec">
            <header className="set-sec__head"><h2>Email me about</h2><p className="card__sub">Sent to {draft.email || "the email on your profile"}.</p></header>
            <ul className="set-list">
              {NOTIFICATIONS.map((item) => (
                <li key={item.id} className="set-row">
                  <span><b>{item.title}</b><small>{item.description}</small></span>
                  <label className="switch">
                    <input type="checkbox" checked={draft.notify[item.id]} aria-label={item.title} onChange={(event) => updateNotification(item.id, event.target.checked)} />
                    <span className="switch__track" /><span className="switch__knob" />
                  </label>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="set-panel" id="set-panel-team" role="tabpanel" aria-labelledby="set-tab-team" hidden={activeTab !== "team"} tabIndex={-1}>
          <section className="card set-sec">
            <header className="set-sec__head set-sec__head--row">
              <div><h2>Team</h2><p className="card__sub">{team.length} of {seatLimit} seats used · {pendingCount} pending</p></div>
              <button className="btn btn--primary" type="button" onClick={() => { setInviteError(""); setInviteOpen(true); }}><Icon name="plus" />Invite teammate</button>
            </header>
            <div className="meter set-seats"><div className="meter__fill" style={{ transform: `scaleX(${Math.min(1, team.length / seatLimit)})`, transformOrigin: "left" }} /></div>
            <ul className="set-team">
              {team.map((member, index) => (
                <li key={`${member.email}-${index}`} className={`set-mate${member.pending ? " is-pending" : ""}`}>
                  {member.pending
                    ? <span className="av av--more" aria-hidden="true"><Icon name="mail" /></span>
                    : <span className="av" style={{ ["--h" as any]: member.hue }} aria-hidden="true">{initials(member.name)}</span>}
                  <span className="set-mate__who"><b>{member.pending ? member.email : member.name}{member.role === "Owner" && <span className="set-you">You</span>}</b><small>{member.pending ? `Invited ${formatDate(member.invited ?? DEMO_NOW)}` : member.email}</small></span>
                  {member.pending && <span className="pill pill--amber">Pending</span>}
                  {member.role === "Owner" ? <span className="set-mate__role">Owner</span> : <label className="set-mate__role"><span className="sr-only">Role for {member.name}</span><select className="select" aria-label={`Role for ${member.name}`} value={member.role} onChange={(event) => saveTeam(team.map((item, i) => i === index ? { ...item, role: event.target.value } : item))}>{ROLES.map((role) => <option key={role}>{role}</option>)}</select></label>}
                  <span className="set-mate__act">
                    {member.pending && <button className="btn btn--sm" type="button" onClick={() => { saveTeam(team.map((item, i) => i === index ? { ...item, invited: Date.now() } : item)); setMessage(`Invite sent again to ${member.email}`); }}>Resend</button>}
                    {member.role !== "Owner" && <button className="icon-btn" type="button" aria-label={member.pending ? `Cancel invite for ${member.email}` : `Remove ${member.name}`} onClick={() => setRemoveTarget(member)}><Icon name="trash" /></button>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="set-panel" id="set-panel-plan" role="tabpanel" aria-labelledby="set-tab-plan" hidden={activeTab !== "plan"} tabIndex={-1}>
          <div className="set-plans">
            <section className={`card set-plan${draft.plan !== "Plus" ? " is-current" : ""}`} aria-labelledby="set-trial-h">
              <div className="set-plan__top"><span className="set-plan__ico"><Icon name="clock" /></span><div><h2 id="set-trial-h">Pro trial</h2><p className="card__sub">{draft.plan === "Plus" ? "Ended when you upgraded" : `Ends ${formatDate(trialEnd)}`}</p></div><span className={`pill ${draft.plan === "Plus" ? "pill--gray" : "pill--blue"}`}>{draft.plan === "Plus" ? "Ended" : "Current plan"}</span></div>
              {draft.plan !== "Plus" && <div className="set-trial"><div className="set-trial__nums"><b>9 days left</b><span>21 of 30 days used</span></div><div className="meter set-trial__meter"><div className="meter__fill" style={{ transform: "scaleX(.7)", transformOrigin: "left" }} /></div></div>}
              <ul className="set-feats">{STARTER_FEATURES.map((feature) => <li key={feature}><span className="set-feat__tick"><Icon name="check" /></span>{feature}</li>)}</ul>
              <p className="card__sub">{draft.plan === "Plus" ? "Everything here is included in Plus." : "When the trial ends you move to Starter ($29 a month) unless you upgrade."}</p>
            </section>
            <section className={`card set-plan set-plan--plus${draft.plan === "Plus" ? " is-current" : ""}`} aria-labelledby="set-plus-h">
              <span className="set-plan__glow" aria-hidden="true" />
              <div className="set-plan__top"><span className="set-plan__ico set-plan__ico--plus"><Icon name="spark" /></span><div><h2 id="set-plus-h">Corbel Plus</h2><p className="card__sub"><b className="set-price">$79</b> a month, billed monthly</p></div>{draft.plan === "Plus" && <span className="set-badge"><Icon name="check" />You’re on Plus</span>}</div>
              <ul className="set-feats set-feats--plus">{PLUS_FEATURES.map((feature) => <li key={feature}><span className="set-feat__tick"><Icon name="check" /></span>{feature}</li>)}</ul>
              <div className="set-plan__cta">{draft.plan === "Plus" ? <><p className="card__sub">Renews {formatDate((draft.plusSince ?? DEMO_NOW) + 30 * 24 * 60 * 60 * 1000)} · Visa ending 4242</p><button className="btn btn--ghost btn--sm" type="button" onClick={() => setPlanAction("cancel")}>Cancel Plus</button></> : <><button className="btn btn--primary set-upgrade" type="button" onClick={() => setPlanAction("upgrade")}><Icon name="spark" />Upgrade to Plus</button><p className="card__sub">Cancel any time. Billed to Visa ending 4242.</p></>}</div>
            </section>
          </div>
          <section className="card set-billcard" aria-labelledby="set-bill-h">
            <div className="card__head"><h2 className="card__title" id="set-bill-h"><Icon name="book" />Billing history</h2><span className="card__actions card__sub">Paid with Visa ending 4242</span></div>
            <div className="table-wrap"><table className="table set-bills">
              <thead><tr><th scope="col">Invoice</th><th scope="col">Date</th><th scope="col">Plan</th><th scope="col" className="num">Amount</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Download</span></th></tr></thead>
              <tbody>{invoices.map((invoice) => <tr key={invoice.id}><td><span className="mono">{invoice.id}</span></td><td>{formatDate(invoice.date)}</td><td>{invoice.item}</td><td className="num">{formatMoney(invoice.amount, draft.currency)}</td><td><span className="pill pill--mint">Paid</span></td><td className="num"><button className="btn btn--ghost btn--sm" type="button" aria-label={`Download invoice ${invoice.id}`} onClick={() => downloadInvoice(invoice)}><Icon name="download" /><span className="set-dl__txt">Download</span></button></td></tr>)}</tbody>
            </table></div>
          </section>
        </div>

        {message && <p className="set-hint" role="status" aria-live="polite">{message}</p>}
        {isDirty && <div className="set-bar" role="region" aria-label="Unsaved changes"><span className="set-bar__dot" aria-hidden="true" /><span className="set-bar__txt">You have unsaved changes</span><button className="btn btn--ghost btn--sm" type="button" onClick={discardChanges}>Discard</button><button className="btn btn--primary btn--sm" type="submit"><Icon name="check" />Save</button></div>}
      </form>

      <dialog ref={inviteDialogRef} className="modal" aria-label="Invite a teammate" onCancel={() => setInviteOpen(false)} onClick={(event) => { if (event.target === inviteDialogRef.current) setInviteOpen(false); }}>
        <form className="modal__box" onSubmit={sendInvite}>
          <header className="modal__head"><h2>Invite a teammate</h2><button className="icon-btn" type="button" aria-label="Close" onClick={() => setInviteOpen(false)}><Icon name="x" /></button></header>
          <div className="modal__body"><p className="card__sub">They’ll get an email with a link to join {draft.store}.</p><Field id="invite-email" inputRef={inviteInputRef} label="Email" value={inviteEmail} onChange={setInviteEmail} type="email" autoComplete="off" placeholder="name@corbelsupply.co" error={inviteError} /><label className="field" htmlFor="invite-role"><span className="label">Role</span><select id="invite-role" className="select" value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}>{ROLES.map((role) => <option key={role}>{role}</option>)}</select></label></div>
          <footer className="modal__foot"><button className="btn" type="button" onClick={() => setInviteOpen(false)}>Cancel</button><button className="btn btn--primary" type="submit"><Icon name="send" />Send invite</button></footer>
        </form>
      </dialog>

      <dialog ref={actionDialogRef} className="modal" aria-label="Confirm settings action" onCancel={() => { setRemoveTarget(null); setPlanAction(null); }} onClick={(event) => { if (event.target === actionDialogRef.current) { setRemoveTarget(null); setPlanAction(null); } }}>
        <div className="modal__box">
          <header className="modal__head"><h2>{removeTarget ? (removeTarget.pending ? "Cancel invitation?" : `Remove ${removeTarget.name}?`) : planAction === "upgrade" ? "Upgrade to Corbel Plus?" : "Cancel Corbel Plus?"}</h2><button className="icon-btn" type="button" aria-label="Close" onClick={() => { setRemoveTarget(null); setPlanAction(null); }}><Icon name="x" /></button></header>
          <div className="modal__body"><p className="card__sub">{removeTarget ? `${removeTarget.pending ? "This invitation will be cancelled." : `${removeTarget.name.split(" ")[0]} will lose access to ${draft.store}. Their orders, notes and replies stay.`}` : planAction === "upgrade" ? "Demo action: this switches the workspace to Plus locally. It does not start a real subscription." : "Your plan will return to the Pro trial. This demo only changes local settings."}</p></div>
          <footer className="modal__foot"><button className="btn" type="button" onClick={() => { setRemoveTarget(null); setPlanAction(null); }}>Cancel</button><button className="btn btn--primary" type="button" onClick={removeTarget ? confirmTeamRemoval : confirmPlanAction}>{removeTarget ? (removeTarget.pending ? "Cancel invite" : "Remove teammate") : planAction === "upgrade" ? "Upgrade to Plus" : "Cancel Plus"}</button></footer>
        </div>
      </dialog>
    </div>
  );
}
