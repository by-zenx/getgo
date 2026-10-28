"use client";

import { FormEvent, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
import Link from "next/link";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Icon } from "@/components/icons/svg-sprite";
import { moveSegmentPill } from "@/lib/segment-motion";
import { createInitialOrders } from "@/data/orders-data";
import { createInitialMessageThreads, MESSAGE_CONTACTS, MESSAGE_QUICK_REPLIES, type ConversationMessage, type MessageChannel, type MessageContact, type MessageThread } from "@/data/messages-data";

const STORAGE_KEY = "corbel:messages:threads";
const FIXTURE_NOW = Date.UTC(2026, 9, 26, 12);
type InboxFilter = "all" | "unread" | "done";
type PaneMode = "list" | "thread";
const FILTERS: { value: InboxFilter; label: string }[] = [
  { value: "all", label: "All" }, { value: "unread", label: "Unread" }, { value: "done", label: "Done" },
];

function contactFor(id: string) { return MESSAGE_CONTACTS.find((contact) => contact.id === id); }
function orderTotal(order: ReturnType<typeof createInitialOrders>[number]) { return order.lines.reduce((sum, line) => sum + line.price * line.qty, 0) + order.shipping; }
function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
function channelName(channel: MessageChannel) { return ({ chat: "Website chat", email: "Email", instagram: "Instagram" })[channel]; }
function channelIcon(channel: MessageChannel) { return ({ chat: "chat", email: "mail", instagram: "globe" })[channel]; }
function currency(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value); }
function safeThreads(value: string): MessageThread[] | null {
  try {
    const parsed = JSON.parse(value) as MessageThread[];
    return Array.isArray(parsed) && parsed.every((thread) => typeof thread.id === "string" && Array.isArray(thread.msgs)) ? parsed : null;
  } catch { return null; }
}
function sameDate(a: number, b: number) { return new Date(a).toISOString().slice(0, 10) === new Date(b).toISOString().slice(0, 10); }
function formatTime(timestamp: number, now = FIXTURE_NOW) {
  if (sameDate(timestamp, now)) return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(timestamp);
  if (sameDate(timestamp, now - 24 * 60 * 60 * 1000)) return "Yesterday";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(timestamp);
}
function formatDay(timestamp: number, now = FIXTURE_NOW) {
  if (sameDate(timestamp, now)) return "Today";
  if (sameDate(timestamp, now - 24 * 60 * 60 * 1000)) return "Yesterday";
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }).format(timestamp);
}
function orderForContact(customerId: string) {
  return createInitialOrders().filter((order) => order.customerId === customerId && order.status !== "refunded" && order.status !== "cancelled").sort((a, b) => b.placed - a.placed);
}
function customerSpend(customerId: string) { return orderForContact(customerId).reduce((sum, order) => sum + orderTotal(order), 0); }
function lastMessage(thread: MessageThread) { return thread.msgs.at(-1); }
function summarize(thread: MessageThread) {
  const last = lastMessage(thread);
  if (!last) return "No messages yet. Say hello.";
  return `${last.from === "me" ? "You: " : ""}${last.text}`;
}

function FilterSegment({ value, onChange }: { value: InboxFilter; onChange: (value: InboxFilter) => void }) {
  const groupRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const positionedRef = useRef(false);
  useGSAP(() => {
    const group = groupRef.current;
    const pill = pillRef.current;
    const active = group?.querySelector<HTMLButtonElement>(`button[data-value="${value}"]`);
    if (!group || !pill || !active) return;
    moveSegmentPill(pill, active, !positionedRef.current);
    positionedRef.current = true;
  }, { dependencies: [value], scope: groupRef });
  return <div ref={groupRef} className="seg seg--sm msg-filter" role="group" aria-label="Show conversations">
    <span ref={pillRef} className="seg__pill" aria-hidden="true" />
    {FILTERS.map((filter) => <button key={filter.value} type="button" data-value={filter.value} aria-pressed={value === filter.value} onClick={() => onChange(filter.value)}>{filter.label}</button>)}
  </div>;
}

function Avatar({ contact, size = "" }: { contact?: MessageContact; size?: "sm" | "lg" | "" }) {
  const name = contact?.name ?? "Unknown customer";
  return <span className={`av${size ? ` av--${size}` : ""}`} style={{ "--h": contact?.hue ?? 220 } as CSSProperties}>{initials(name)}</span>;
}

export function MessagesView({ initialThreadId }: { initialThreadId?: string } = {}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const listWrapRef = useRef<HTMLDivElement>(null);
  const listPillRef = useRef<HTMLSpanElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const composeRef = useRef<HTMLTextAreaElement>(null);
  const infoDialogRef = useRef<HTMLDialogElement>(null);
  const responseTimersRef = useRef<number[]>([]);
  const previousLayoutRef = useRef<"wide" | "compact" | "stacked" | null>(null);
  const [threads, setThreads] = useState<MessageThread[]>(createInitialMessageThreads);
  const threadsRef = useRef(threads);
  const [activeId, setActiveId] = useState<string | null>(initialThreadId ?? "t1");
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [query, setQuery] = useState("");
  const [pane, setPane] = useState<PaneMode>("list");
  const [layoutMode, setLayoutMode] = useState<"wide" | "compact" | "stacked">("wide");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [typingThreadId, setTypingThreadId] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [notice, setNotice] = useState<{ text: string; undo?: () => void } | null>(null);

  const activeThread = threads.find((thread) => thread.id === activeId) ?? null;
  const activeContact = activeThread ? contactFor(activeThread.customerId) : undefined;
  const orders = activeThread ? orderForContact(activeThread.customerId) : [];
  const unreadCount = threads.filter((thread) => thread.unread && !thread.done).length;
  const visibleThreads = useMemo(() => {
    const search = query.trim().toLowerCase();
    return threads.filter((thread) => filter === "done" ? thread.done : !thread.done && (filter === "all" || thread.unread))
      .filter((thread) => {
        if (!search) return true;
        const contact = contactFor(thread.customerId);
        return `${contact?.name ?? ""} ${thread.subject} ${thread.msgs.map((message) => message.text).join(" ")}`.toLowerCase().includes(search);
      })
      .sort((a, b) => (lastMessage(b)?.at ?? 0) - (lastMessage(a)?.at ?? 0));
  }, [threads, filter, query]);

  useEffect(() => {
    threadsRef.current = threads;
  }, [threads]);
  useEffect(() => {
    if (initialThreadId && threads.some((thread) => thread.id === initialThreadId)) {
      // Apply the URL-selected thread after mount, matching existing route behavior.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveId(initialThreadId);
      setPane("thread");
    }
  }, [initialThreadId, threads]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = safeThreads(saved);
        // Restore saved inbox data in the existing mount effect to preserve startup behavior.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (parsed) setThreads(parsed);
      } else localStorage.setItem(STORAGE_KEY, JSON.stringify(createInitialMessageThreads()));
    } catch { /* Keep the inbox available when browser storage is blocked. */ }
  }, []);

  useEffect(() => {
    const element = rootRef.current;
    if (!element) return;
    const updateLayout = () => {
      const width = element.clientWidth;
      const next = width < 900 ? "stacked" : width < 1080 ? "compact" : "wide";
      setLayoutMode(next);
      if (previousLayoutRef.current !== next) {
        setPane(previousLayoutRef.current === null && initialThreadId ? "thread" : next === "stacked" ? "list" : "thread");
        previousLayoutRef.current = next;
      }
    };
    const observer = new ResizeObserver(updateLayout);
    observer.observe(element);
    updateLayout();
    return () => observer.disconnect();
  }, [initialThreadId]);

  useEffect(() => {
    const dialog = infoDialogRef.current;
    if (!dialog) return;
    if (infoOpen && activeThread && !dialog.open) {
      dialog.showModal();
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.fromTo(dialog.querySelector(".sheet__box"), { opacity: 0, x: 24 }, { opacity: 1, x: 0, duration: 0.48, ease: "power3.out" });
        gsap.fromTo(dialog.querySelectorAll(".msg-side--sheet > *"), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.045, delay: 0.12, ease: "power3.out" });
      }
    } else if (!infoOpen && dialog.open) dialog.close();
  }, [infoOpen, activeId, activeThread]);

  useEffect(() => () => responseTimersRef.current.forEach((timer) => window.clearTimeout(timer)), []);

  useGSAP(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.fromTo(".msg-inbox__head > *", { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.4, ease: "power3.out", stagger: 0.045, delay: 0.08, clearProps: "transform,opacity" });
    const rows = rootRef.current?.querySelectorAll<HTMLElement>(".msg-row");
    if (rows?.length) gsap.fromTo(rows, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.42, ease: "power3.out", stagger: 0.035, delay: 0.22, clearProps: "transform,opacity" });
  }, { dependencies: [], scope: rootRef });

  useGSAP(() => {
    if (!activeThread || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.fromTo(".msg-conv__who > *, .msg-conv__acts > *", { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.32, ease: "power3.out", stagger: 0.025, clearProps: "transform,opacity" });
    const rows = logRef.current?.querySelectorAll<HTMLElement>(".msg-day, .msg-grp, .msg-log__empty");
    if (rows?.length) gsap.fromTo(Array.from(rows).slice(-8), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.42, ease: "power3.out", stagger: 0.035, delay: 0.04, clearProps: "transform,opacity" });
    gsap.fromTo(".msg-quick", { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.35, delay: 0.1, ease: "power3.out", clearProps: "transform,opacity" });
  }, { dependencies: [activeId], scope: rootRef });

  useGSAP(() => {
    const wrap = listWrapRef.current;
    const pill = listPillRef.current;
    const selected = activeId ? listRef.current?.querySelector<HTMLElement>(`.msg-row[data-id="${CSS.escape(activeId)}"]`) : null;
    if (!wrap || !pill || !selected || layoutMode === "stacked") {
      if (pill) gsap.to(pill, { opacity: 0, duration: 0.18, overwrite: "auto" });
      return;
    }
    const y = selected.offsetTop;
    if (!pill.dataset.positioned) {
      gsap.set(pill, { y, height: selected.offsetHeight });
      pill.dataset.positioned = "true";
      gsap.to(pill, { opacity: 1, duration: 0.2 });
    } else {
      gsap.to(pill, { y, height: selected.offsetHeight, opacity: 1, duration: 0.52, ease: "expo.out", overwrite: "auto" });
    }
  }, { dependencies: [activeId, visibleThreads.map((thread) => thread.id).join(","), layoutMode], scope: rootRef });

  useEffect(() => {
    const scroll = rootRef.current?.querySelector<HTMLElement>(".msg-scroll");
    if (scroll && activeThread) {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      scroll.scrollTo({ top: scroll.scrollHeight, behavior: reduced ? "auto" : "smooth" });
    }
  }, [activeId, activeThread?.msgs.length]);

  const persist = (next: MessageThread[]) => {
    threadsRef.current = next;
    setThreads(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event("corbel:messages-updated"));
    } catch { /* State stays available for this session. */ }
  };
  const updateThread = (id: string, updater: (thread: MessageThread) => MessageThread) => {
    persist(threads.map((thread) => thread.id === id ? updater(thread) : thread));
  };
  const selectThread = (thread: MessageThread) => {
    setActiveId(thread.id);
    setTypingThreadId(null);
    responseTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    responseTimersRef.current = [];
    if (layoutMode === "stacked") setPane("thread");
    if (thread.unread) updateThread(thread.id, (current) => ({ ...current, unread: false }));
  };
  const toggleStar = (threadId: string) => updateThread(threadId, (thread) => ({ ...thread, starred: !thread.starred }));
  const announce = (text: string, undo?: () => void) => {
    setNotice({ text, undo });
    window.setTimeout(() => setNotice(null), 4000);
  };
  const markUnread = () => {
    if (!activeThread) return;
    updateThread(activeThread.id, (thread) => ({ ...thread, unread: true }));
    announce("Marked as unread");
    if (layoutMode === "stacked") setPane("list");
  };
  const toggleDone = () => {
    if (!activeThread) return;
    const wasDone = activeThread.done;
    updateThread(activeThread.id, (thread) => ({ ...thread, done: !thread.done, unread: wasDone ? thread.unread : false }));
    announce(wasDone ? "Moved back to the inbox" : "Marked as done", () => updateThread(activeThread.id, (thread) => ({ ...thread, done: wasDone, unread: wasDone ? thread.unread : activeThread.unread })));
  };

  const generatedReply = (thread: MessageThread, contact?: MessageContact) => {
    const name = contact?.name.split(" ")[0] ?? "there";
    if (thread.orderId) return `Thanks for checking. I’ll keep an eye out for the tracking update.`;
    if (contact?.tags.includes("Wholesale")) return `Perfect, send it over whenever you’re ready. Same delivery address as last time please.`;
    if (thread.channel === "instagram") return `Lovely, thank you! Perfect, I’ll order tonight.`;
    return `Thanks so much, ${name}. That helps a lot!`;
  };

  const sendMessage = (value: string) => {
    const text = value.trim();
    if (!activeThread || !text) return;
    const threadId = activeThread.id;
    // Timestamp the message when the user sends it, not during render.
    // eslint-disable-next-line react-hooks/purity
    const sentAt = Date.now();
    const outgoing: ConversationMessage = { id: `${threadId}-${sentAt}`, from: "me", text, at: sentAt, by: "Priya Shah" };
    updateThread(threadId, (thread) => ({ ...thread, done: false, unread: false, msgs: [...thread.msgs, outgoing] }));
    setDrafts((current) => ({ ...current, [threadId]: "" }));
    setTypingThreadId(null);
    responseTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    responseTimersRef.current = [
      window.setTimeout(() => setTypingThreadId(threadId), 1200),
      window.setTimeout(() => {
        const currentThread = threadsRef.current.find((thread) => thread.id === threadId);
        if (!currentThread) return;
        setTypingThreadId(null);
        const incoming: ConversationMessage = { id: `${threadId}-${Date.now()}-reply`, from: "them", text: generatedReply(currentThread, contactFor(currentThread.customerId)), at: Date.now() };
        persist(threadsRef.current.map((thread) => thread.id === threadId ? { ...thread, msgs: [...thread.msgs, incoming] } : thread));
      }, 2900),
    ];
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const threadId = activeThread?.id;
    if (!threadId) return;
    sendMessage(drafts[threadId] ?? "");
    composeRef.current?.focus();
  };

  const handleMessageKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      sendMessage(drafts[activeThread?.id ?? ""] ?? "");
    }
  };

  const updateDraft = (value: string) => {
    if (!activeThread || !composeRef.current) return;
    setDrafts((current) => ({ ...current, [activeThread.id]: value }));
    composeRef.current.style.height = "auto";
    composeRef.current.style.height = `${Math.min(composeRef.current.scrollHeight, 140)}px`;
  };

  const setFilterMode = (next: InboxFilter) => setFilter(next);
  const contactPanel = (contact: MessageContact, asSheet = false) => {
    const recentOrders = orderForContact(contact.id).slice(0, 4);
    const countOrders = orderForContact(contact.id).length;
    return <div className={asSheet ? "msg-side msg-side--sheet" : "msg-side__content"}>
      <div className="msg-side__who"><Avatar contact={contact} size="lg" /><div className="msg-side__id"><h3 className="msg-side__name">{contact.name}</h3><p className="msg-side__city">{contact.city}</p></div></div>
      {contact.tags.length > 0 && <div className="msg-side__tags" aria-label="Customer tags">{contact.tags.map((tag) => <span key={tag} className="msg-tag">{tag}</span>)}</div>}
      <dl className="msg-facts"><div><dt>Lifetime spend</dt><dd><b>{currency(customerSpend(contact.id))}</b></dd></div><div><dt>Orders</dt><dd>{countOrders}</dd></div><div><dt>Shops</dt><dd>{contact.channel === "store" ? "In store" : "Online"}</dd></div><div><dt>Customer since</dt><dd>{new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(contact.joined)}</dd></div></dl>
      <section className="msg-side__sec"><h3 className="msg-side__h">Contact</h3><ul className="msg-contact"><li><a href={`mailto:${contact.email}`} title={contact.email}><Icon name="mail" /><span>{contact.email}</span></a></li><li><a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}><Icon name="phone" /><span>{contact.phone}</span></a></li></ul></section>
      <section className="msg-side__sec"><h3 className="msg-side__h">Recent orders</h3>{recentOrders.length ? <ul className="msg-orders">{recentOrders.map((order) => <li key={order.id}><Link className="msg-ord" href="/orders"><span className="msg-ord__top"><span className="mono">{order.id}</span><b>{currency(orderTotal(order))}</b></span><span className="msg-ord__bot"><span>{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(order.placed)}</span><span className={`pill pill--${order.status === "delivered" ? "mint" : order.status === "pending" ? "amber" : "blue"}`}>{order.status}</span></span></Link></li>)}</ul> : <p className="msg-side__none">No orders yet.</p>}</section>
      {contact.note && <section className="msg-side__sec"><h3 className="msg-side__h">Note</h3><p className="msg-side__note">{contact.note}</p></section>}
      <Link className="btn msg-side__profile" href="/customers">View profile</Link>
    </div>;
  };

  const groupedMessages = activeThread ? activeThread.msgs.reduce<{ day: string; from: "them" | "me"; by?: string; messages: ConversationMessage[] }[]>((groups, message) => {
    const day = formatDay(message.at);
    const last = groups.at(-1);
    if (!last || last.day !== day || last.from !== message.from || (message.from === "me" && last.by !== message.by)) groups.push({ day, from: message.from, by: message.by, messages: [message] });
    else last.messages.push(message);
    return groups;
  }, []) : [];

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (!target.matches("[data-open]")) return;
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      const rows = Array.from(list.querySelectorAll<HTMLButtonElement>("[data-open]"));
      const direction = event.key === "ArrowDown" ? 1 : -1;
      rows[Math.max(0, Math.min(rows.length - 1, rows.indexOf(target as HTMLButtonElement) + direction))]?.focus();
    };
    list.addEventListener("keydown", onKeyDown);
    return () => list.removeEventListener("keydown", onKeyDown);
  }, [visibleThreads]);

  return (
    <div ref={rootRef} data-view="messages" className="msg-view">
      <div className={`card msg${layoutMode === "compact" ? " is-compact" : ""}${layoutMode === "stacked" ? " is-stacked" : ""}`} data-pane={pane}>
        <section className="msg-pane msg-inbox" aria-labelledby="msg-inbox-t">
          <div className="msg-inbox__head">
            <div className="msg-inbox__title"><h2 id="msg-inbox-t">Inbox</h2><span className={`msg-inbox__count${unreadCount === 0 ? " is-zero" : ""}`} aria-live="polite">{unreadCount ? `${unreadCount} unread` : "All read"}</span></div>
            <FilterSegment value={filter} onChange={setFilterMode} />
            <label className="input-icon msg-search"><span className="sr-only">Search conversations</span><Icon name="search" /><input className="input" type="search" placeholder="Search people or messages" value={query} onChange={(event) => setQuery(event.target.value)} autoComplete="off" /></label>
          </div>
          <div ref={listWrapRef} className="msg-list-wrap">
            <span ref={listPillRef} className="msg-list__pill" aria-hidden="true" />
            <ul ref={listRef} className="msg-list" aria-label="Conversations">
              {visibleThreads.length ? visibleThreads.map((thread) => {
                const contact = contactFor(thread.customerId);
                const last = lastMessage(thread);
                return <li key={thread.id} className={`msg-row${thread.unread && !thread.done ? " is-unread" : ""}`} data-id={thread.id}>
                  <button className="msg-row__open" type="button" data-open={thread.id} aria-current={thread.id === activeId} onClick={() => selectThread(thread)}>
                    <span className="msg-row__av"><Avatar contact={contact} /><span className="msg-row__ch" title={channelName(thread.channel)}><Icon name={channelIcon(thread.channel)} /></span></span>
                    <span className="msg-row__main"><span className="msg-row__top"><b className="msg-row__name">{contact?.name ?? "Unknown customer"}</b><span className="msg-row__time">{last ? formatTime(last.at) : "New"}</span></span><span className="msg-row__subj">{thread.subject}</span><span className="msg-row__prev">{summarize(thread)}</span></span>
                    <span className="sr-only">{thread.unread && !thread.done ? ", unread" : ""}{thread.starred ? ", starred" : ""}, {channelName(thread.channel)}</span>
                  </button>
                  <span className="msg-row__dot" aria-hidden="true" />
                  <button className={`msg-row__star${thread.starred ? " is-on" : ""}`} type="button" aria-pressed={thread.starred} aria-label={`${thread.starred ? "Unstar" : "Star"} conversation with ${contact?.name ?? "customer"}`} onClick={() => toggleStar(thread.id)}><Icon name="star" /></button>
                </li>;
              }) : <li className="msg-list__empty"><div className="empty"><Icon name={filter === "unread" && !query ? "check" : "chat"} /><b>{query ? "No matches" : filter === "done" ? "Nothing marked done" : filter === "unread" ? "You’re all caught up" : "No conversations"}</b><span>{query ? "Try a name or a word from the message." : filter === "unread" ? "New messages will show up here." : "Conversations will appear in your inbox."}</span></div></li>}
            </ul>
          </div>
        </section>

        <section className="msg-pane msg-conv" aria-label="Conversation">
          <header className="msg-conv__head" hidden={!activeThread}>
            <button className="icon-btn msg-back" type="button" aria-label="Back to conversations" onClick={() => setPane("list")}><Icon name="chev" className="msg-back__ico" /></button>
            <div className="msg-conv__who">{activeThread && <><Avatar contact={activeContact} /><div className="msg-conv__txt"><div className="msg-conv__line"><h2 className="msg-conv__name">{activeContact?.name ?? "Unknown customer"}</h2>{orders[0] && <Link className="pill pill--blue pill--plain msg-conv__order" href="/orders"><Icon name="box" />Order {orders[0].id}</Link>}</div><p className="msg-conv__meta"><span className="msg-conv__ch"><Icon name={channelIcon(activeThread.channel)} />{channelName(activeThread.channel)}</span><span className="msg-conv__subj">{activeThread.subject}</span></p></div></>}</div>
            <div className="msg-conv__acts">
              <button className={`icon-btn msg-act-star${activeThread?.starred ? " is-on" : ""}`} type="button" aria-pressed={Boolean(activeThread?.starred)} aria-label={activeThread?.starred ? "Unstar conversation" : "Star conversation"} onClick={() => activeThread && toggleStar(activeThread.id)}><Icon name="star" /></button>
              <button className="icon-btn" type="button" aria-label="Mark as unread" title="Mark as unread" onClick={markUnread}><Icon name="mail" /></button>
              <button className={`btn btn--sm msg-done${activeThread?.done ? " is-done" : ""}`} type="button" aria-pressed={Boolean(activeThread?.done)} onClick={toggleDone}><Icon name={activeThread?.done ? "arrow-up" : "check"} /><span>{activeThread?.done ? "Reopen" : "Mark done"}</span></button>
              <button className="icon-btn msg-info" type="button" aria-label="Customer details" aria-haspopup="dialog" onClick={() => setInfoOpen(true)}><Icon name="info" /></button>
            </div>
          </header>
          <div className="msg-scroll" hidden={!activeThread}>
            <div ref={logRef} className="msg-log" role="log" aria-live="polite" aria-relevant="additions" aria-label={activeContact ? `Messages with ${activeContact.name}` : "Messages"}>
              {activeThread && (groupedMessages.length ? groupedMessages.map((group, index) => <div key={`${group.day}-${group.from}-${index}`} className="msg-message-group"><div className="msg-day"><span>{group.day}</span></div><div className={`msg-grp msg-grp--${group.from}`}>{group.from === "them" && <span className="msg-grp__av"><Avatar contact={activeContact} size="sm" /></span>}<div className="msg-grp__col">{group.messages.map((message) => <p key={message.id} className="msg-b"><span className="sr-only">{group.from === "them" ? activeContact?.name ?? "Customer" : "You"}: </span>{message.text}</p>)}<span className="msg-grp__meta"><span className="msg-grp__who">{group.from === "them" ? activeContact?.name ?? "Customer" : group.by ? "Priya Shah" : "You"}</span><time dateTime={new Date(group.messages.at(-1)!.at).toISOString()}>{formatTime(group.messages.at(-1)!.at)}</time></span></div></div></div>) : <div className="msg-log__empty"><Avatar contact={activeContact} size="lg" /><b>Start the conversation</b><span>Write to {activeContact?.name ?? "them"} below. They’ll get it by {activeThread.channel === "email" ? "email" : channelName(activeThread.channel).toLowerCase()}.</span></div>)}
            </div>
            {typingThreadId === activeThread?.id && <div className="msg-typing" aria-live="polite"><Avatar contact={activeContact} size="sm" /><span className="msg-typing__b"><i /><i /><i /></span><span className="sr-only">{activeContact?.name ?? "Customer"} is typing</span></div>}
          </div>
          {activeThread && <form className="msg-compose" onSubmit={handleSubmit}>
            <div className="msg-quick" role="group" aria-label="Quick replies">{MESSAGE_QUICK_REPLIES.map((reply) => <button key={reply} className="chip msg-qr" type="button" onClick={() => updateDraft(reply)}>{reply}</button>)}</div>
            <div className="msg-box"><label className="sr-only" htmlFor="msg-input">Reply to {activeContact?.name ?? "customer"}</label><textarea ref={composeRef} className="msg-input" id="msg-input" rows={1} placeholder="Write a reply…" value={drafts[activeThread.id] ?? ""} onChange={(event) => updateDraft(event.target.value)} onKeyDown={handleMessageKeyDown} /><button className="msg-send" type="submit" aria-label="Send message" disabled={!(drafts[activeThread.id] ?? "").trim()}><Icon name="send" /></button></div>
            <p className="msg-hint"><kbd>Enter</kbd> to send, <kbd>Shift</kbd> + <kbd>Enter</kbd> for a new line</p>
          </form>}
          {!activeThread && <div className="msg-conv__empty"><div className="empty"><Icon name="chat" /><b>No conversation open</b><span>Pick one from the inbox to read and reply.</span></div></div>}
        </section>

        {activeContact && <aside className="msg-pane msg-side" aria-label="Customer details">{contactPanel(activeContact)}</aside>}
      </div>

      <dialog ref={infoDialogRef} className="sheet" aria-label="Customer details" onCancel={() => setInfoOpen(false)} onClick={(event) => { if (event.target === infoDialogRef.current) setInfoOpen(false); }}>
        {activeContact && <div className="sheet__box"><header className="sheet__head"><h2>Customer details</h2><button className="icon-btn" type="button" aria-label="Close customer details" onClick={() => setInfoOpen(false)}><Icon name="x" /></button></header><div className="sheet__body">{contactPanel(activeContact, true)}</div></div>}
      </dialog>
      {notice && <div className="toasts" aria-live="polite"><div className="toast" role="status"><span className="toast__ico"><Icon name="check" /></span><span>{notice.text}</span>{notice.undo && <button type="button" onClick={() => { notice.undo?.(); setNotice(null); }}>Undo</button>}</div></div>}
    </div>
  );
}
