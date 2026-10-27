"use client";

import { FormEvent, Fragment, KeyboardEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Icon } from "@/components/icons/svg-sprite";
import { ProgressMeter } from "@/components/ui/progress-meter";
import {
  createInitialWorkspaceBoards,
  WORKSPACE_CHECKLISTS,
  WORKSPACE_MEMBERS,
  WORKSPACE_TAGS,
  type WorkspaceBoard,
  type WorkspaceColumn,
  type WorkspaceColumnId,
  type WorkspaceComment,
  type WorkspaceTag,
  type WorkspaceTask,
} from "@/data/workspace-data";

const STORAGE_KEY = "corbel:workspace:boards";
const DAY = 24 * 60 * 60 * 1000;
const FIXTURE_NOW = Date.UTC(2026, 9, 26, 12);

interface WorkspaceDrag {
  taskId: string;
  pointerId: number;
  x: number;
  y: number;
  originX: number;
  originY: number;
  tilt: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  targetColumnId: WorkspaceColumnId | null;
  beforeTaskId?: string;
}

interface PendingWorkspacePointer {
  taskId: string;
  pointerId: number;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}

function memberFor(initials: string) {
  return WORKSPACE_MEMBERS.find((member) => member.initials === initials) ?? WORKSPACE_MEMBERS[0];
}

function boardProgress(board: WorkspaceBoard) {
  const all = board.columns.reduce((sum, column) => sum + column.cards.length, 0);
  const done = board.columns.find((column) => column.id === "done")?.cards.length ?? 0;
  return { all, done, percent: all ? Math.round((done / all) * 100) : 0 };
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(timestamp);
}

function formatCommentTime(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(timestamp);
}

function dateInputValue(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateFromInput(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 17).getTime();
}

function dayDifference(timestamp: number, now: number) {
  const due = new Date(timestamp);
  const today = new Date(now);
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / DAY);
}

function dueDescription(timestamp: number, now: number, isDone: boolean) {
  const difference = dayDifference(timestamp, now);
  if (isDone) return `Was due ${formatDate(timestamp)}`;
  if (difference === 0) return "Due today";
  if (difference === 1) return "Due tomorrow";
  if (difference === -1) return "1 day late";
  return difference > 0 ? `Due in ${difference} days` : `${Math.abs(difference)} days late`;
}

function dueClass(timestamp: number, now: number, isDone: boolean) {
  if (isDone) return "";
  const difference = dayDifference(timestamp, now);
  if (difference < 0) return "is-late";
  if (difference <= 2) return "is-soon";
  return "";
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function safeBoardData(value: string): WorkspaceBoard[] | null {
  try {
    const boards = JSON.parse(value) as WorkspaceBoard[];
    if (!Array.isArray(boards) || !boards.every((board) => Array.isArray(board.columns))) return null;
    return boards;
  } catch {
    return null;
  }
}

export function WorkspaceView({ boardId }: { boardId: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const ringAnimatedRef = useRef(false);
  const cardDialogRef = useRef<HTMLDialogElement>(null);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const pointerRef = useRef<PendingWorkspacePointer | null>(null);
  const dragRef = useRef<WorkspaceDrag | null>(null);
  const dragPreviewRef = useRef<HTMLDivElement>(null);
  const dragMotionRef = useRef<{ x: (value: number) => void; y: (value: number) => void; rotation: (value: number) => void } | null>(null);
  const flipPositionsRef = useRef<Map<string, DOMRect> | null>(null);
  const suppressClickRef = useRef(false);
  const [boards, setBoards] = useState<WorkspaceBoard[]>(createInitialWorkspaceBoards);
  const [now, setNow] = useState(FIXTURE_NOW);
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null);
  const [newTaskColumn, setNewTaskColumn] = useState<WorkspaceColumnId | null>(null);
  const [newTaskTag, setNewTaskTag] = useState<WorkspaceTag>("Ops");
  const [newTaskAssignee, setNewTaskAssignee] = useState("MR");
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [dragPreview, setDragPreview] = useState<WorkspaceDrag | null>(null);
  const [notice, setNotice] = useState("");

  const board = boards.find((item) => item.id === boardId);
  const progress = board ? boardProgress(board) : { all: 0, done: 0, percent: 0 };
  const activeCard = board?.columns.flatMap((column) => column.cards).find((card) => card.id === activeCardId) ?? null;
  const activeColumn = board?.columns.find((column) => column.cards.some((card) => card.id === activeCardId)) ?? null;
  const draggingTask = dragPreview ? board?.columns.flatMap((column) => column.cards).find((card) => card.id === dragPreview.taskId) ?? null : null;
  const visibleCards = useMemo(() => board?.columns.reduce((sum, column) => sum + column.cards.filter((card) => !assigneeFilter || card.who === assigneeFilter).length, 0) ?? 0, [board, assigneeFilter]);

  useEffect(() => {
    setNow(Date.now());
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = safeBoardData(stored);
        if (parsed) setBoards(parsed);
      } else {
        const current = createInitialWorkspaceBoards(Date.now());
        setBoards(current);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
      }
    } catch {
      // The board remains usable for this session when browser storage is unavailable.
    }
  }, []);

  useEffect(() => {
    setAssigneeFilter(null);
    setNewTaskColumn(null);
    setOpenMenuId(null);
  }, [boardId]);

  useGSAP(() => {
    if (!board || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const head = rootRef.current?.querySelector(".ws-head");
    const columns = rootRef.current?.querySelectorAll(".ws-col");
    const cards = rootRef.current?.querySelectorAll(".ws-card:not([hidden])");
    if (head) gsap.fromTo(head, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, delay: 0.04, ease: "expo.out", clearProps: "transform,opacity" });
    if (columns?.length) gsap.fromTo(columns, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.55, stagger: 0.06, delay: 0.12, ease: "expo.out", clearProps: "transform,opacity" });
    if (cards?.length) gsap.fromTo(cards, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.025, delay: 0.3, ease: "power3.out", clearProps: "transform,opacity" });
  }, { dependencies: [boardId], scope: rootRef });

  useEffect(() => {
    const ring = rootRef.current?.querySelector<SVGCircleElement>(".ws-ring__arc");
    if (!ring) return;
    const target = 100 - progress.percent;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) gsap.set(ring, { strokeDashoffset: target });
    else if (!ringAnimatedRef.current) gsap.fromTo(ring, { strokeDashoffset: 100 }, { strokeDashoffset: target, duration: 0.9, delay: 0.2, ease: "power3.inOut" });
    else gsap.to(ring, { strokeDashoffset: target, duration: 0.6, ease: "power3.out", overwrite: "auto" });
    ringAnimatedRef.current = true;
  }, [progress.percent]);

  useEffect(() => {
    const dialog = cardDialogRef.current;
    if (!dialog) return;
    if (activeCard && !dialog.open) {
      dialog.showModal();
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.fromTo(dialog.querySelector(".sheet__box"), { opacity: 0, x: 24 }, { opacity: 1, x: 0, duration: 0.56, ease: "power3.out" });
      }
    } else if (!activeCard && dialog.open) dialog.close();
  }, [activeCardId, activeCard]);

  useEffect(() => {
    const dialog = deleteDialogRef.current;
    if (!dialog) return;
    if (deleteOpen && !dialog.open) {
      dialog.showModal();
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.fromTo(dialog.querySelector(".modal__box"), { opacity: 0, y: 16, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.32, ease: "power3.out" });
      }
    } else if (!deleteOpen && dialog.open) dialog.close();
  }, [deleteOpen]);

  const persist = (updater: (current: WorkspaceBoard[]) => WorkspaceBoard[]) => {
    const next = updater(boards);
    setBoards(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event("corbel:workspace-updated"));
    } catch {}
  };

  const updateTask = (taskId: string, updater: (task: WorkspaceTask) => WorkspaceTask) => {
    persist((current) => current.map((item) => item.id !== boardId ? item : {
      ...item,
      columns: item.columns.map((column) => ({
        ...column,
        cards: column.cards.map((card) => card.id === taskId ? updater(card) : card),
      })),
    }));
  };

  const moveTask = (taskId: string, targetColumnId: WorkspaceColumnId, beforeTaskId?: string) => {
    const firstPositions = new Map<string, DOMRect>();
    const draggedFirstPosition = rootRef.current?.querySelector<HTMLElement>(".ws-drag-preview")?.getBoundingClientRect();
    rootRef.current?.querySelectorAll<HTMLElement>(".ws-card").forEach((card) => {
      if (card.dataset.id) firstPositions.set(card.dataset.id, card.getBoundingClientRect());
    });
    persist((current) => current.map((item) => {
      if (item.id !== boardId) return item;
      let moved: WorkspaceTask | undefined;
      const columns = item.columns.map((column) => ({
        ...column,
        cards: column.cards.filter((card) => {
          if (card.id !== taskId) return true;
          moved = card;
          return false;
        }),
      }));
      if (!moved) return item;
      const target = columns.find((column) => column.id === targetColumnId);
      if (!target) return item;
      const insertAt = beforeTaskId ? target.cards.findIndex((card) => card.id === beforeTaskId) : -1;
      target.cards.splice(insertAt < 0 ? target.cards.length : insertAt, 0, moved);
      return { ...item, columns };
    }));
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      window.requestAnimationFrame(() => {
        firstPositions.forEach((first, id) => {
          const card = rootRef.current?.querySelector<HTMLElement>(`.ws-card[data-id="${CSS.escape(id)}"]`);
          if (!card) return;
          const last = card.getBoundingClientRect();
          const x = first.left - last.left;
          const y = first.top - last.top;
          if (Math.abs(x) < 1 && Math.abs(y) < 1) return;
          gsap.fromTo(card, { x, y }, { x: 0, y: 0, duration: 0.48, ease: "expo.out", clearProps: "transform" });
        });
        if (draggedFirstPosition) {
          const movedCard = rootRef.current?.querySelector<HTMLElement>(`.ws-card[data-id="${CSS.escape(taskId)}"]`);
          if (movedCard) {
            const last = movedCard.getBoundingClientRect();
            gsap.fromTo(movedCard, { x: draggedFirstPosition.left - last.left, y: draggedFirstPosition.top - last.top, scale: 0.98 }, { x: 0, y: 0, scale: 1, duration: 0.42, ease: "power3.out", clearProps: "transform", overwrite: "auto" });
          }
        }
      });
    }
  };

  useLayoutEffect(() => {
    const firstPositions = flipPositionsRef.current;
    if (!firstPositions) return;
    flipPositionsRef.current = null;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    firstPositions.forEach((first, id) => {
      const card = rootRef.current?.querySelector<HTMLElement>(`.ws-card[data-id="${CSS.escape(id)}"]`);
      if (!card) return;
      gsap.set(card, { clearProps: "transform" });
      const last = card.getBoundingClientRect();
      const x = first.left - last.left;
      const y = first.top - last.top;
      if (Math.abs(x) < 1 && Math.abs(y) < 1) return;
      gsap.fromTo(card, { x, y }, { x: 0, y: 0, duration: 0.38, ease: "power3.out", clearProps: "transform", overwrite: "auto" });
    });
  }, [dragPreview?.targetColumnId, dragPreview?.beforeTaskId]);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const pending = pointerRef.current;
      if (!pending || pending.pointerId !== event.pointerId) return;
      const dx = event.clientX - pending.startX;
      const dy = event.clientY - pending.startY;
      let current = dragRef.current;
      if (!current && Math.hypot(dx, dy) < 6) return;
      if (!current) {
        current = {
          taskId: pending.taskId,
          pointerId: pending.pointerId,
          x: event.clientX,
          y: event.clientY,
          originX: pending.startX - pending.offsetX,
          originY: pending.startY - pending.offsetY,
          tilt: 0,
          offsetX: pending.offsetX,
          offsetY: pending.offsetY,
          width: pending.width,
          height: pending.height,
          targetColumnId: null,
        };
      }
      const columnElement = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>(".ws-col");
      const targetColumnId = columnElement?.dataset.col as WorkspaceColumnId | undefined;
      let beforeTaskId: string | undefined;
      if (columnElement && targetColumnId) {
        const cards = Array.from(columnElement.querySelectorAll<HTMLElement>(".ws-card"))
          .filter((card) => card.dataset.id !== pending.taskId);
        const hovered = cards.find((card) => {
          const rect = card.getBoundingClientRect();
          return event.clientY < rect.top + rect.height / 2;
        });
        if (hovered) beforeTaskId = hovered.dataset.id;
      }
      const placementChanged = !dragRef.current || current.targetColumnId !== (targetColumnId ?? null) || current.beforeTaskId !== beforeTaskId;
      if (placementChanged) {
        const firstPositions = new Map<string, DOMRect>();
        rootRef.current?.querySelectorAll<HTMLElement>(".ws-card").forEach((card) => {
          if (card.dataset.id && card.dataset.id !== pending.taskId) firstPositions.set(card.dataset.id, card.getBoundingClientRect());
        });
        flipPositionsRef.current = firstPositions;
      }
      const next: WorkspaceDrag = {
        ...current,
        x: event.clientX,
        y: event.clientY,
        tilt: Math.max(-5, Math.min(5, dx * 0.12)),
        targetColumnId: targetColumnId ?? null,
        beforeTaskId,
      };
      dragRef.current = next;
      const preview = dragPreviewRef.current;
      if (preview) {
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reducedMotion) {
          gsap.set(preview, { x: dx, y: dy, rotation: 0 });
        } else if (!dragMotionRef.current) {
          dragMotionRef.current = {
            x: gsap.quickTo(preview, "x", { duration: 0.14, ease: "power3.out" }),
            y: gsap.quickTo(preview, "y", { duration: 0.14, ease: "power3.out" }),
            rotation: gsap.quickTo(preview, "rotation", { duration: 0.12, ease: "power2.out" }),
          };
        }
        if (!reducedMotion && dragMotionRef.current) {
          dragMotionRef.current.x(dx);
          dragMotionRef.current.y(dy);
          dragMotionRef.current.rotation(Math.max(-5, Math.min(5, dx * 0.12)));
        }
      }
      if (placementChanged) setDragPreview(next);
      if (dragRef.current) event.preventDefault();
    };
    const onPointerUp = (event: PointerEvent) => {
      const pending = pointerRef.current;
      if (!pending || pending.pointerId !== event.pointerId) return;
      const drag = dragRef.current;
      if (drag) {
        suppressClickRef.current = true;
        if (drag.targetColumnId) moveTask(drag.taskId, drag.targetColumnId, drag.beforeTaskId);
        window.setTimeout(() => { suppressClickRef.current = false; }, 0);
      }
      pointerRef.current = null;
      dragRef.current = null;
      dragMotionRef.current = null;
      setDragPreview(null);
    };
    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [boards, boardId]);

  const moveWithinColumn = (taskId: string, direction: -1 | 1) => {
    const column = board?.columns.find((item) => item.cards.some((card) => card.id === taskId));
    if (!column) return;
    const index = column.cards.findIndex((card) => card.id === taskId);
    const target = column.cards[index + direction];
    if (!target) return;
    moveTask(taskId, column.id, direction < 0 ? target.id : column.cards[index + 2]?.id);
    setOpenMenuId(null);
  };

  const addTask = (event: FormEvent<HTMLFormElement>, column: WorkspaceColumn) => {
    event.preventDefault();
    const form = event.currentTarget;
    const title = new FormData(form).get("title")?.toString().trim() ?? "";
    if (!title) return;
    const task: WorkspaceTask = {
      id: `w${Date.now().toString(36)}`,
      title,
      tag: newTaskTag,
      who: newTaskAssignee,
      due: Date.now() + 7 * DAY,
      checklist: [],
      comments: [],
    };
    persist((current) => current.map((item) => item.id !== boardId ? item : {
      ...item,
      columns: item.columns.map((itemColumn) => itemColumn.id === column.id ? { ...itemColumn, cards: [...itemColumn.cards, task] } : itemColumn),
    }));
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      window.requestAnimationFrame(() => {
        const card = rootRef.current?.querySelector<HTMLElement>(`.ws-card[data-id="${CSS.escape(task.id)}"]`);
        if (card) gsap.fromTo(card, { opacity: 0, y: 10, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.42, ease: "back.out(1.5)", clearProps: "transform,opacity" });
      });
    }
    setNewTaskColumn(null);
    setNotice(`Added to ${column.name}`);
    window.setTimeout(() => setNotice(""), 2400);
  };

  const removeTask = () => {
    if (!activeCard) return;
    persist((current) => current.map((item) => item.id !== boardId ? item : {
      ...item,
      columns: item.columns.map((column) => ({ ...column, cards: column.cards.filter((card) => card.id !== activeCard.id) })),
    }));
    setDeleteOpen(false);
    setActiveCardId(null);
    setNotice("Card deleted");
    window.setTimeout(() => setNotice(""), 2400);
  };

  const addChecklistItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeCard) return;
    const form = event.currentTarget;
    const label = new FormData(form).get("item")?.toString().trim() ?? "";
    if (!label) return;
    updateTask(activeCard.id, (task) => ({ ...task, checklist: [...task.checklist, { label, done: false }] }));
    form.reset();
  };

  const addComment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeCard) return;
    const form = event.currentTarget;
    const text = new FormData(form).get("comment")?.toString().trim() ?? "";
    if (!text) return;
    const comment: WorkspaceComment = { id: `comment-${Date.now()}`, who: "MR", text, at: Date.now() };
    updateTask(activeCard.id, (task) => ({ ...task, comments: [...task.comments, comment] }));
    form.reset();
  };

  const handleMenuKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    const menu = event.currentTarget;
    const items = Array.from(menu.querySelectorAll<HTMLElement>("[role=menuitem]"));
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      items[(index + direction + items.length) % items.length]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      items[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      items.at(-1)?.focus();
    } else if (event.key === "Escape") {
      setOpenMenuId(null);
    }
  };

  if (!board) {
    return (
      <div ref={rootRef} data-view="workspace" className="ws">
        <section className="card"><div className="empty"><Icon name="calendar" /><b>That board doesn’t exist</b><span>It may have been renamed. Pick a board from the sidebar.</span><a className="btn" href="/workspace/spring-launch">Open Spring Launch</a></div></section>
      </div>
    );
  }

  return (
    <div ref={rootRef} data-view="workspace" className="ws">
      <section className="card ws-head" aria-label="About this board">
        <div className="ws-head__about">
          <span className="ws-head__dot" style={{ "--dot": board.color } as React.CSSProperties} aria-hidden="true" />
          <div className="ws-head__txt">
            <h2 className="ws-head__desc">{board.description}</h2>
            <p className="ws-head__meta"><span className="ws-head__due"><Icon name="calendar" />Due {formatDate(board.due)}, {dueDescription(board.due, now, false).replace(/^Due /, "")}</span><span className="ws-head__n" data-total>{progress.all} cards</span></p>
          </div>
        </div>
        <div className="ws-head__tools">
          <div className="ws-head__people" role="group" aria-labelledby="ws-who-l">
            <span className="ws-head__label" id="ws-who-l">Show cards for</span>
            <div className="ws-people">
              {WORKSPACE_MEMBERS.map((member) => (
                <button key={member.initials} className="ws-person" type="button" data-who={member.initials} aria-pressed={assigneeFilter === member.initials} title={member.name} aria-label={`Only ${member.name}’s cards`} onClick={() => setAssigneeFilter((current) => current === member.initials ? null : member.initials)}>
                  <span className="av av--sm" style={{ "--h": member.hue } as React.CSSProperties}>{initials(member.name)}</span>
                </button>
              ))}
            </div>
            <button className="link-btn ws-clear" type="button" hidden={!assigneeFilter} onClick={() => setAssigneeFilter(null)}>Show all</button>
          </div>
          <div className="ws-head__prog">
            <div className="ws-ring" role="img" aria-label={`${progress.percent}% of cards done`}>
              <svg viewBox="0 0 64 64" aria-hidden="true"><circle className="ws-ring__track" cx="32" cy="32" r="27" /><circle className="ws-ring__arc" cx="32" cy="32" r="27" pathLength="100" style={{ strokeDashoffset: 100 - progress.percent }} /></svg>
              <b className="ws-ring__pct"><span data-pct>{progress.percent}</span><small>%</small></b>
            </div>
            <div className="ws-head__done"><b data-done>{progress.done} of {progress.all}</b><span>cards done</span></div>
          </div>
          <button className="btn btn--primary ws-head__add" type="button" data-add-top onClick={() => { setNewTaskColumn("todo"); setNewTaskTag("Ops"); setNewTaskAssignee(assigneeFilter ?? "MR"); }}><Icon name="plus" />Add card</button>
        </div>
      </section>

      <div className="ws-scroll" role="region" aria-label={`${board.name} board`} tabIndex={-1}>
        <div className="ws-board">
          {board.columns.map((column) => {
            const columnCards = column.cards.filter((card) => !assigneeFilter || card.who === assigneeFilter);
            return (
              <section key={column.id} className={`ws-col${dragPreview ? " is-drop-ready" : ""}${dragPreview?.targetColumnId === column.id ? " is-drop-target" : ""}`} data-col={column.id} aria-labelledby={`ws-h-${column.id}`}>
                <header className="ws-col__head">
                  <span className={`ws-col__dot ws-col__dot--${column.id}`} aria-hidden="true" />
                  <h2 className="ws-col__name" id={`ws-h-${column.id}`}>{column.name}</h2>
                  <span className="ws-col__count" aria-label="cards">{columnCards.length}</span>
                  <button className="icon-btn ws-col__plus" type="button" data-add={column.id} aria-label={`Add a card to ${column.name}`} onClick={() => { setNewTaskColumn(column.id); setNewTaskTag("Ops"); setNewTaskAssignee(assigneeFilter ?? "MR"); }}><Icon name="plus" /></button>
                </header>
                <ol className="ws-list" aria-label={`${column.name} cards`}>
                  {columnCards.filter((card) => card.id !== dragPreview?.taskId).map((card, index, cards) => {
                    const assignee = memberFor(card.who);
                    const completion = card.checklist.length ? card.checklist.filter((item) => item.done).length / card.checklist.length : 0;
                    const isComplete = column.id === "done";
                    return (
                      <Fragment key={card.id}>
                      {dragPreview?.targetColumnId === column.id && dragPreview.beforeTaskId === card.id && <li className="ws-ph" aria-hidden="true" style={{ "--ws-ph-height": `${dragPreview.height}px` } as React.CSSProperties} />}
                      <li className="ws-card" data-id={card.id} onPointerDown={(event) => {
                        if (event.button !== 0 || (event.target as HTMLElement).closest("button:not(.ws-card__open), input, select, textarea, a, [role=menu]")) return;
                        const rect = event.currentTarget.getBoundingClientRect();
                        pointerRef.current = { taskId: card.id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top, width: rect.width, height: rect.height };
                      }} onClickCapture={(event) => {
                        if (suppressClickRef.current) { event.preventDefault(); event.stopPropagation(); }
                      }}>
                        <span className="ws-card__lift" aria-hidden="true" />
                        <div className="ws-card__top">
                          <span className={`pill ws-tag ws-tag--${card.tag.toLowerCase()}`}>{card.tag}</span>
                          <button className="ws-card__move" type="button" aria-haspopup="menu" aria-expanded={openMenuId === card.id} aria-label={`Move “${card.title}”`} title="Move" onClick={(event) => { event.stopPropagation(); setOpenMenuId((current) => current === card.id ? null : card.id); }}><Icon name="dots" /></button>
                          {openMenuId === card.id && <div className="pop ws-menu ws-card-menu" role="menu" aria-label={`Move ${card.title}`} onKeyDown={handleMenuKeys}>
                            <p className="ws-menu__head">Move “{card.title}”</p>
                            {column.cards.findIndex((item) => item.id === card.id) > 0 && <button type="button" role="menuitem" onClick={() => moveWithinColumn(card.id, -1)}><Icon name="arrow-up" />Move up</button>}
                            {column.cards.findIndex((item) => item.id === card.id) < column.cards.length - 1 && <button type="button" role="menuitem" onClick={() => moveWithinColumn(card.id, 1)}><Icon name="arrow-up" className="ws-flip" />Move down</button>}
                            {board.columns.filter((item) => item.id !== column.id).map((target) => <button key={target.id} type="button" role="menuitem" onClick={() => { moveTask(card.id, target.id); setOpenMenuId(null); }}><span className={`ws-col__dot ws-col__dot--${target.id}`} aria-hidden="true" />Move to {target.name}</button>)}
                            <button type="button" role="menuitem" onClick={() => { setActiveCardId(card.id); setOpenMenuId(null); }}><Icon name="edit" />Open card</button>
                          </div>}
                        </div>
                        <h3 className="ws-card__title"><button className="ws-card__open" type="button" onClick={() => setActiveCardId(card.id)}>{card.title}</button></h3>
                        {card.checklist.length > 0 && <div className={`ws-card__check${completion === 1 ? " is-complete" : ""}`} title="Checklist"><span><Icon name="check" />{card.checklist.filter((item) => item.done).length}/{card.checklist.length}<span className="sr-only"> checklist items done</span></span><div className="meter"><ProgressMeter value={completion} /></div></div>}
                        <div className="ws-card__foot">
                          <span title={assignee.name}><span className="av av--sm" style={{ "--h": assignee.hue } as React.CSSProperties}>{initials(assignee.name)}</span><span className="sr-only">Assigned to {assignee.name}</span></span>
                          <span className={`ws-due ${dueClass(card.due, now, isComplete)}`} title={dueDescription(card.due, now, isComplete)}><Icon name="clock" />{dueDescription(card.due, now, isComplete)}</span>
                          {card.comments.length > 0 && <span className="ws-card__com" title={`${card.comments.length} comments`}><Icon name="chat" />{card.comments.length}<span className="sr-only"> comments</span></span>}
                        </div>
                      </li>
                      {dragPreview?.targetColumnId === column.id && !dragPreview.beforeTaskId && index === cards.length - 1 && <li className="ws-ph" aria-hidden="true" style={{ "--ws-ph-height": `${dragPreview.height}px` } as React.CSSProperties} />}
                      </Fragment>
                    );
                  })}
                  {dragPreview?.targetColumnId === column.id && !dragPreview.beforeTaskId && columnCards.every((card) => card.id === dragPreview.taskId) && <li className="ws-ph" aria-hidden="true" style={{ "--ws-ph-height": `${dragPreview.height}px` } as React.CSSProperties} />}
                </ol>
                {newTaskColumn === column.id ? <form className="ws-add" data-form={column.id} onSubmit={(event) => addTask(event, column)} onKeyDown={(event) => { if (event.key === "Escape") setNewTaskColumn(null); }}>
                  <label className="sr-only" htmlFor={`ws-t-${column.id}`}>Card title</label>
                  <input className="input" id={`ws-t-${column.id}`} name="title" placeholder="What needs doing?" autoComplete="off" maxLength={90} required autoFocus />
                  <div className="ws-add__row"><label className="sr-only" htmlFor={`ws-g-${column.id}`}>Tag</label><select className="select" id={`ws-g-${column.id}`} value={newTaskTag} onChange={(event) => setNewTaskTag(event.target.value as WorkspaceTag)}>{WORKSPACE_TAGS.map((tag) => <option key={tag}>{tag}</option>)}</select><label className="sr-only" htmlFor={`ws-w-${column.id}`}>Assignee</label><select className="select" id={`ws-w-${column.id}`} value={newTaskAssignee} onChange={(event) => setNewTaskAssignee(event.target.value)}>{WORKSPACE_MEMBERS.map((member) => <option key={member.initials} value={member.initials}>{member.name}</option>)}</select></div>
                  <div className="ws-add__row"><button className="btn btn--primary btn--sm" type="submit">Add card</button><button className="btn btn--ghost btn--sm" type="button" onClick={() => setNewTaskColumn(null)}>Cancel</button></div>
                </form> : <button className="ws-col__new" type="button" data-add={column.id} onClick={() => { setNewTaskColumn(column.id); setNewTaskTag("Ops"); setNewTaskAssignee(assigneeFilter ?? "MR"); }}><Icon name="plus" />Add a card</button>}
              </section>
            );
          })}
        </div>
        <span className="sr-only" aria-live="polite">Showing {visibleCards} cards</span>
      </div>

      {dragPreview && draggingTask && <div ref={dragPreviewRef} className="ws-drag-preview" aria-hidden="true" style={{ left: dragPreview.originX, top: dragPreview.originY, width: dragPreview.width, height: dragPreview.height }}>
        <span className={`pill ws-tag ws-tag--${draggingTask.tag.toLowerCase()}`}>{draggingTask.tag}</span>
        <b>{draggingTask.title}</b>
        {draggingTask.checklist.length > 0 && <span className="ws-drag-preview__progress">{draggingTask.checklist.filter((item) => item.done).length}/{draggingTask.checklist.length}</span>}
      </div>}

      <dialog ref={cardDialogRef} className="sheet" aria-label={activeCard ? `Card details: ${activeCard.title}` : "Card details"} onCancel={() => setActiveCardId(null)} onClose={() => setActiveCardId(null)} onClick={(event) => { if (event.target === cardDialogRef.current) setActiveCardId(null); }}>
        {activeCard && activeColumn && <div className="sheet__box">
          <header className="sheet__head"><h2 id="ws-s-title-head">Card details</h2><button className="icon-btn" type="button" aria-label="Close card details" onClick={() => setActiveCardId(null)}><Icon name="x" /></button></header>
          <div className="sheet__body"><div className="ws-sh">
            <div className="field"><label className="label" htmlFor="ws-s-title">Title</label><input className="input" id="ws-s-title" value={activeCard.title} maxLength={90} onChange={(event) => updateTask(activeCard.id, (task) => ({ ...task, title: event.target.value }))} /></div>
            <div className="ws-sc__grid">
              <div className="field"><label className="label" htmlFor="ws-s-col">Column</label><select className="select" id="ws-s-col" value={activeColumn.id} onChange={(event) => moveTask(activeCard.id, event.target.value as WorkspaceColumnId)}>{board.columns.map((column) => <option key={column.id} value={column.id}>{column.name}</option>)}</select></div>
              <div className="field"><label className="label" htmlFor="ws-s-tag">Tag</label><select className="select" id="ws-s-tag" value={activeCard.tag} onChange={(event) => updateTask(activeCard.id, (task) => ({ ...task, tag: event.target.value as WorkspaceTag }))}>{WORKSPACE_TAGS.map((tag) => <option key={tag}>{tag}</option>)}</select></div>
              <div className="field"><label className="label" htmlFor="ws-s-who">Assignee</label><select className="select" id="ws-s-who" value={activeCard.who} onChange={(event) => updateTask(activeCard.id, (task) => ({ ...task, who: event.target.value }))}>{WORKSPACE_MEMBERS.map((member) => <option key={member.initials} value={member.initials}>{member.name}</option>)}</select></div>
              <div className="field"><label className="label" htmlFor="ws-s-due">Due date</label><input className="input" type="date" id="ws-s-due" value={dateInputValue(activeCard.due)} onChange={(event) => event.target.value && updateTask(activeCard.id, (task) => ({ ...task, due: dateFromInput(event.target.value) }))} /></div>
            </div>
            <section className="ws-sc__sec" aria-labelledby="ws-s-ch"><div className="ws-sc__h"><h3 id="ws-s-ch">Checklist</h3><span className="ws-sc__n">{activeCard.checklist.filter((item) => item.done).length}/{activeCard.checklist.length}</span></div>
              <div className="meter"><ProgressMeter value={activeCard.checklist.length ? activeCard.checklist.filter((item) => item.done).length / activeCard.checklist.length : 0} /></div>
              <ul className="ws-sc__checks">{activeCard.checklist.map((item, index) => <li key={`${item.label}-${index}`}><label className="check ws-sc__item"><input type="checkbox" checked={item.done} onChange={(event) => updateTask(activeCard.id, (task) => ({ ...task, checklist: task.checklist.map((check, checkIndex) => checkIndex === index ? { ...check, done: event.target.checked } : check) }))} /><span>{item.label}</span></label></li>)}</ul>
              <form className="ws-sc__inline" onSubmit={addChecklistItem}><label className="sr-only" htmlFor="ws-s-item">New checklist item</label><input className="input" id="ws-s-item" name="item" placeholder="Add an item" maxLength={80} autoComplete="off" /><button className="btn btn--sm" type="submit">Add</button></form>
            </section>
            <section className="ws-sc__sec" aria-labelledby="ws-s-co"><div className="ws-sc__h"><h3 id="ws-s-co">Comments</h3><span className="ws-sc__n">{activeCard.comments.length}</span></div>
              <ul className="ws-sc__notes">{activeCard.comments.length ? activeCard.comments.map((comment) => { const author = memberFor(comment.who); return <li key={comment.id} className="ws-sc__note"><span className="av av--sm" style={{ "--h": author.hue } as React.CSSProperties}>{initials(author.name)}</span><div><p><b>{author.name}</b><small>{formatCommentTime(comment.at)}</small></p><p>{comment.text}</p></div></li>; }) : <li className="ws-sc__none">No comments yet.</li>}</ul>
              <form className="ws-sc__comment" onSubmit={addComment}><label className="sr-only" htmlFor="ws-s-note">Write a comment</label><textarea className="textarea" id="ws-s-note" name="comment" rows={2} placeholder="Write a comment" maxLength={400} /><button className="btn btn--primary btn--sm" type="submit"><Icon name="send" />Comment</button></form>
            </section>
          </div></div>
          <footer className="sheet__foot"><button className="btn btn--danger btn--ghost ws-sc__del" type="button" onClick={() => setDeleteOpen(true)}><Icon name="trash" />Delete card</button><button className="btn btn--dark" type="button" onClick={() => setActiveCardId(null)}>Done</button></footer>
        </div>}
      </dialog>

      <dialog ref={deleteDialogRef} className="modal" aria-label="Delete card confirmation" onCancel={() => setDeleteOpen(false)} onClick={(event) => { if (event.target === deleteDialogRef.current) setDeleteOpen(false); }}>
        {activeCard && <div className="modal__box"><header className="modal__head"><h2>Delete this card?</h2><button className="icon-btn" type="button" aria-label="Close" onClick={() => setDeleteOpen(false)}><Icon name="x" /></button></header><div className="modal__body"><p className="card__sub">“{activeCard.title}” will be removed from {board.name}. This can’t be undone.</p></div><footer className="modal__foot"><button className="btn" type="button" onClick={() => setDeleteOpen(false)}>Keep card</button><button className="btn btn--primary" type="button" onClick={removeTask}>Delete card</button></footer></div>}
      </dialog>

      {notice && <div className="toasts" aria-live="polite"><div className="toast" role="status"><span className="toast__ico"><Icon name="check" /></span><span>{notice}</span></div></div>}
    </div>
  );
}
