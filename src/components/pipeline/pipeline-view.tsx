"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { Icon } from "@/components/icons/svg-sprite";
import { calculateLeadScore, createInitialMessageThreads, DEFAULT_LEAD_SCORING, LEAD_SCORING_STORAGE_KEY, SEEDED_EMAIL_LEADS, threadSubScores, leadScoreLabel, leadScoreTone, type LeadScoringSettings, type LeadSubScores, type MessageThread } from "@/data/messages-data";
import { WORKSPACE_MEMBERS } from "@/data/workspace-data";
import "@/styles/pipeline.css";

const BOARD_KEY = "corbel:pipeline:board";
const HANDOFF_KEY = "corbel:pipeline:leads";
const STAGES = ["New lead", "Contacted", "Qualified", "Proposal", "Negotiation", "Closing"] as const;
type Stage = typeof STAGES[number];
type CloseState = "won" | "lost" | null;
type Deal = { id: string; name: string; company: string; owner: string; source: string; score: number; subScores: LeadSubScores; value: number; expectedClose: string; stage: Stage; closedAs: CloseState; closedAt: number | null; previousStage: Stage | null; handoffId?: string };
type Handoff = { id: string; name: string; company: string; source: string; score: number; owner: string };
type Drag = { id: string; pointerId: number; x: number; y: number; startX: number; startY: number; offsetX: number; offsetY: number; width: number; height: number; started: boolean; target: string | null };

const stageProbability: Record<Stage, number> = { "New lead": .1, Contacted: .2, Qualified: .4, Proposal: .6, Negotiation: .75, Closing: .9 };
const seed: Deal[] = [
  { id:"d1",name:"Ravi Kapoor",company:"The Linen Room",owner:"Mara Reyes",source:"Referral",score:71,subScores:{fit:72,intent:70,engagement:70},value:12400,expectedClose:"2026-11-18",stage:"Contacted",closedAs:null,closedAt:null,previousStage:null },
  { id:"d2",name:"Elena Marsh",company:"Juniper Labs",owner:"Jonah Okafor",source:"Website",score:82,subScores:{fit:84,intent:80,engagement:82},value:24800,expectedClose:"2026-11-26",stage:"Qualified",closedAs:null,closedAt:null,previousStage:null },
  { id:"d3",name:"Theo Lindqvist",company:"Kumo Retail",owner:"Ana Petrova",source:"Instagram",score:62,subScores:{fit:64,intent:60,engagement:62},value:18800,expectedClose:"2026-12-04",stage:"Proposal",closedAs:null,closedAt:null,previousStage:null },
  { id:"d4",name:"Sofia Bianchi",company:"Northwind Studio",owner:"Leo Tanaka",source:"Email",score:89,subScores:{fit:90,intent:88,engagement:88},value:36200,expectedClose:"2026-11-30",stage:"Negotiation",closedAs:null,closedAt:null,previousStage:null },
  { id:"d5",name:"Marcus Hale",company:"Wren & Field",owner:"Priya Shah",source:"Partner",score:76,subScores:{fit:78,intent:74,engagement:75},value:21600,expectedClose:"2026-12-12",stage:"Closing",closedAs:null,closedAt:null,previousStage:null },
  { id:"d6",name:"Hana Sato",company:"Aldercrest Hotels",owner:"Mara Reyes",source:"Website",score:54,subScores:{fit:56,intent:52,engagement:53},value:9600,expectedClose:"2026-12-20",stage:"New lead",closedAs:null,closedAt:null,previousStage:null },
  { id:"d7",name:"Oliver Grant",company:"Brooks Consulting",owner:"Jonah Okafor",source:"Email",score:68,subScores:{fit:70,intent:66,engagement:67},value:14200,expectedClose:"2026-12-08",stage:"Qualified",closedAs:null,closedAt:null,previousStage:null },
  { id:"d8",name:"Ines Duarte",company:"Brightpath Group",owner:"Ana Petrova",source:"Referral",score:45,subScores:{fit:47,intent:43,engagement:44},value:7800,expectedClose:"2027-01-15",stage:"Contacted",closedAs:null,closedAt:null,previousStage:null },
  { id:"d9",name:"Kofi Mensah",company:"Kumo Retail",owner:"Leo Tanaka",source:"Website",score:91,subScores:{fit:92,intent:90,engagement:90},value:42800,expectedClose:"2026-11-12",stage:"Closing",closedAs:null,closedAt:null,previousStage:null },
  { id:"d10",name:"Greta Novak",company:"Juniper Labs",owner:"Priya Shah",source:"Instagram",score:59,subScores:{fit:60,intent:58,engagement:58},value:11500,expectedClose:"2026-12-21",stage:"Proposal",closedAs:null,closedAt:null,previousStage:null },
  { id:"d11",name:"Clara Jensen",company:"The Linen Room",owner:"Mara Reyes",source:"Website",score:79,subScores:{fit:80,intent:78,engagement:78},value:27500,expectedClose:"2026-12-02",stage:"Negotiation",closedAs:null,closedAt:null,previousStage:null },
  { id:"d12",name:"Amara Okoye",company:"Northwind Studio",owner:"Jonah Okafor",source:"Referral",score:64,subScores:{fit:66,intent:62,engagement:63},value:17400,expectedClose:"2026-12-14",stage:"New lead",closedAs:null,closedAt:null,previousStage:null },
  { id:"w1",name:"Maya Patel",company:"Juniper Labs",owner:"Priya Shah",source:"Email",score:86,subScores:{fit:91,intent:81,engagement:85},value:18900,expectedClose:"2026-10-18",stage:"Closing",closedAs:"won",closedAt:Date.UTC(2026,9,18),previousStage:"Closing" },
  { id:"w2",name:"Theo Martin",company:"Brightpath Group",owner:"Ana Petrova",source:"Email",score:74,subScores:{fit:79,intent:69,engagement:73},value:12400,expectedClose:"2026-10-09",stage:"Negotiation",closedAs:"won",closedAt:Date.UTC(2026,9,9),previousStage:"Negotiation" },
  { id:"l1",name:"Nina Brooks",company:"Brooks Consulting",owner:"Daniel Kim",source:"Email",score:46,subScores:{fit:51,intent:41,engagement:45},value:8800,expectedClose:"2026-10-11",stage:"Proposal",closedAs:"lost",closedAt:Date.UTC(2026,9,11),previousStage:"Proposal" },
  { id:"l2",name:"Marcus Hale",company:"Aldercrest Hotels",owner:"Leo Tanaka",source:"Website",score:38,subScores:{fit:40,intent:36,engagement:37},value:7200,expectedClose:"2026-10-02",stage:"Contacted",closedAs:"lost",closedAt:Date.UTC(2026,9,2),previousStage:"Contacted" },
];

function validSettings(): LeadScoringSettings {
  try { const value = JSON.parse(localStorage.getItem(LEAD_SCORING_STORAGE_KEY) ?? "null") as LeadScoringSettings | null; if (value && value.weights && Number.isFinite(value.weights.fit) && Number.isFinite(value.weights.intent) && Number.isFinite(value.weights.engagement)) return value; } catch { /* use defaults */ }
  return DEFAULT_LEAD_SCORING;
}
function readBoard(): Deal[] { try { const value = JSON.parse(localStorage.getItem(BOARD_KEY) ?? "null") as Deal[] | null; return Array.isArray(value) ? value : seed; } catch { return seed; } }
function readHandoffs(): Handoff[] { try { const value = JSON.parse(localStorage.getItem(HANDOFF_KEY) ?? "[]") as Handoff[]; return Array.isArray(value) ? value.filter((lead) => typeof lead.id === "string") : []; } catch { return []; } }
function enrichHandoffs(board: Deal[], handoffs: Handoff[], threads: MessageThread[], settings: LeadScoringSettings) {
  const knownThreads = threads.map((thread) => ({ id:`thread:${thread.id}`, subScores:threadSubScores(thread) }));
  const knownEmails = SEEDED_EMAIL_LEADS.map((lead) => ({ id:lead.id, subScores:{fit:lead.fit,intent:lead.intent,engagement:lead.engagement} }));
  const known = [...knownThreads,...knownEmails];
  const additions = handoffs.filter((lead) => !board.some((deal) => deal.handoffId === lead.id || deal.id === lead.id)).map((lead): Deal => {
    const subScores = known.find((item) => item.id === lead.id)?.subScores ?? { fit:lead.score,intent:lead.score,engagement:lead.score };
    return { id:`handoff:${lead.id}`,handoffId:lead.id,name:lead.name,company:lead.company,owner:lead.owner,source:lead.source,score:calculateLeadScore(subScores,settings),subScores,value:12000,expectedClose:"2026-12-15",stage:"New lead",closedAs:null,closedAt:null,previousStage:null };
  });
  return additions.length ? [...board,...additions] : board;
}
function initials(name: string) { return name.split(/\s+/).map((part) => part[0]).slice(0,2).join("").toUpperCase(); }
function money(value: number) { return new Intl.NumberFormat("en-US", { style:"currency",currency:"USD",maximumFractionDigits:0 }).format(value); }

export function PipelineView() {
  const rootRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDialogElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const ghostRef = useRef<HTMLLIElement>(null);
  const [deals,setDeals] = useState<Deal[]>([]);
  const [filter,setFilter] = useState<string | null>(null);
  const [settings,setSettings] = useState<LeadScoringSettings>(DEFAULT_LEAD_SCORING);
  const [closeList,setCloseList] = useState<CloseState>(null);
  const [detail,setDetail] = useState<string | null>(null);
  const suppressClick = useRef(false);
  const persist = useCallback((update: (current: Deal[]) => Deal[]) => setDeals((current) => { const next=update(current); try { localStorage.setItem(BOARD_KEY,JSON.stringify(next)); } catch {} return next; }),[]);
  const selected=deals.find((deal)=>deal.id===detail);

  useEffect(() => {
    const threads = (() => { try { const saved=JSON.parse(localStorage.getItem("corbel:messages:threads") ?? "null") as MessageThread[] | null; return Array.isArray(saved) ? saved : createInitialMessageThreads(); } catch { return createInitialMessageThreads(); } })();
    const currentSettings=validSettings();
    // Restore browser-only preferences after hydration to keep server and client markup identical.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(currentSettings);
    const loaded=enrichHandoffs(readBoard(),readHandoffs(),threads,currentSettings);
    setDeals(loaded);
    if (loaded !== seed) { try { localStorage.setItem(BOARD_KEY,JSON.stringify(loaded)); } catch {} }
    const refresh=() => { const latest=validSettings(); setSettings(latest); setDeals((current) => { const next=enrichHandoffs(current,readHandoffs(),threads,latest); if(next!==current) { try { localStorage.setItem(BOARD_KEY,JSON.stringify(next)); } catch {} } return next; }); };
    window.addEventListener("storage",refresh); window.addEventListener("corbel:pipeline-leads-updated",refresh); window.addEventListener("corbel:lead-scoring-updated",refresh);
    return () => { window.removeEventListener("storage",refresh); window.removeEventListener("corbel:pipeline-leads-updated",refresh); window.removeEventListener("corbel:lead-scoring-updated",refresh); };
  },[]);

  useEffect(() => {
    const dialog=sheetRef.current;
    if(!dialog)return;
    if((selected||closeList)&&!dialog.open)dialog.showModal();
    else if(!selected&&!closeList&&dialog.open)dialog.close();
  },[selected,closeList]);

  useEffect(() => {
    const move=(event: PointerEvent) => {
      const drag=dragRef.current; if(!drag || drag.pointerId!==event.pointerId) return;
      if(!drag.started && Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)<6) return;
      drag.started=true; drag.x=event.clientX; drag.y=event.clientY;
      const draggedCard=rootRef.current?.querySelector<HTMLElement>(`.pl-card[data-id="${CSS.escape(drag.id)}"]`);
      draggedCard?.classList.add("is-dragging");
      rootRef.current?.querySelectorAll(".pl-col").forEach((column)=>column.classList.add("is-drop-ready"));
      const target=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>("[data-stage],[data-closeout]");
      drag.target=target?.dataset.closeout ?? target?.dataset.stage ?? null;
      rootRef.current?.querySelectorAll(".pl-closeout").forEach((tile) => tile.classList.toggle("is-drop-target",tile.getAttribute("data-closeout")===drag.target));
      rootRef.current?.querySelectorAll(".pl-col").forEach((col) => col.classList.toggle("is-drop-target",col.getAttribute("data-stage")===drag.target));
      if(ghostRef.current) gsap.set(ghostRef.current,{x:event.clientX-drag.startX,y:event.clientY-drag.startY,rotation:Math.max(-4,Math.min(4,(event.clientX-drag.startX)*.08))});
      event.preventDefault();
    };
    const up=(event: PointerEvent) => {
      const drag=dragRef.current; if(!drag || drag.pointerId!==event.pointerId) return;
      if(drag.started) {
        suppressClick.current=true;
        const target=drag.target;
        if(target==="won" || target==="lost") persist((current) => current.map((deal) => deal.id===drag.id ? {...deal,previousStage:deal.stage,closedAs:target,closedAt:Date.now()} : deal));
        else if(target && STAGES.includes(target as Stage)) persist((current) => current.map((deal) => deal.id===drag.id ? {...deal,stage:target as Stage} : deal));
        window.setTimeout(()=>{suppressClick.current=false;},0);
      }
      dragRef.current=null; rootRef.current?.querySelectorAll(".pl-closeout,.pl-col").forEach((el)=>el.classList.remove("is-drop-target","is-drop-ready"));
      if(ghostRef.current) gsap.set(ghostRef.current,{clearProps:"all"});
      ghostRef.current=null;
    };
    window.addEventListener("pointermove",move,{passive:false}); window.addEventListener("pointerup",up); window.addEventListener("pointercancel",up);
    return()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",up);window.removeEventListener("pointercancel",up);};
  },[persist]);

  const members=useMemo(()=>[...WORKSPACE_MEMBERS.map((member)=>({name:member.name,initials:member.initials,hue:member.hue})),...Array.from(new Set(deals.map((deal)=>deal.owner))).filter((name)=>!WORKSPACE_MEMBERS.some((member)=>member.name===name)).map((name)=>({name,initials:initials(name),hue:210}))],[deals]);
  const visibleDeals=useMemo(()=>deals.filter((deal)=>!deal.closedAs && (!filter||deal.owner===filter)),[deals,filter]);
  const openValue=visibleDeals.reduce((sum,deal)=>sum+deal.value,0);
  const weighted=visibleDeals.reduce((sum,deal)=>sum+deal.value*stageProbability[deal.stage],0);
  const won=deals.filter((deal)=>deal.closedAs==="won"&&(!filter||deal.owner===filter));
  const lost=deals.filter((deal)=>deal.closedAs==="lost"&&(!filter||deal.owner===filter));
  const thisMonth=won.filter((deal)=>deal.closedAt!==null&&new Date(deal.closedAt).getMonth()===new Date().getMonth()&&new Date(deal.closedAt).getFullYear()===new Date().getFullYear());
  const scoreFor=(deal:Deal)=>calculateLeadScore(deal.subScores,settings);
  const closeValue=thisMonth.reduce((sum,deal)=>sum+deal.value,0);
  const closeDeals=closeList==="won"?won:lost;
  const closeLabel=closeList==="won"?"Won deals":"Lost deals";
  const closeDeal=(deal:Deal,state:"won"|"lost")=>persist((current)=>current.map((item)=>item.id===deal.id?{...item,previousStage:item.stage,closedAs:state,closedAt:Date.now()}:item));
  const reopen=(deal:Deal)=>{persist((current)=>current.map((item)=>item.id===deal.id?{...item,stage:item.previousStage??"Contacted",previousStage:null,closedAs:null,closedAt:null}:item));setCloseList(null);};

  return <div ref={rootRef} className="ws pl" data-view="pipeline">
    <section className="statbar pl-forecast" aria-label="Pipeline forecast">
      {[{label:"Open value",value:money(openValue),icon:"chart"},{label:"Weighted value",value:money(weighted),icon:"chart"},{label:"Won this month",value:money(closeValue),icon:"check"},{label:"Waiting to qualify",value:String(visibleDeals.filter((deal)=>deal.stage==="New lead").length),icon:"users"}].map((item)=><article key={item.label} className="card pl-stat"><span className="stat__label">{item.label}</span><b className="stat__val">{item.value}</b><span className="pl-stat__icon"><Icon name={item.icon}/></span></article>)}
    </section>
    <section className="card ws-head pl-head" aria-label="Pipeline controls">
      <div className="ws-head__about"><span className="ws-head__dot" style={{"--dot":"var(--primary)"} as React.CSSProperties}/><div className="ws-head__txt"><h2 className="ws-head__desc">Deal pipeline</h2><p className="ws-head__meta"><span>{visibleDeals.length} open deals</span><span className="ws-head__n">Weighted forecast {money(weighted)}</span></p></div></div>
      <div className="ws-head__tools"><div className="ws-head__people" role="group" aria-label="Filter by owner"><span className="ws-head__label">Owner</span><div className="ws-people">{members.map((member)=><button key={member.name} className="ws-person" type="button" aria-pressed={filter===member.name} title={member.name} aria-label={`Show ${member.name}'s deals`} onClick={()=>setFilter((current)=>current===member.name?null:member.name)}><span className="av av--sm" style={{"--h":member.hue} as React.CSSProperties}>{member.initials}</span></button>)}</div><button className="link-btn ws-clear" type="button" hidden={!filter} onClick={()=>setFilter(null)}>Show all</button></div></div>
    </section>
    <div className="ws-scroll pl-scroll" role="region" aria-label="Pipeline stages" tabIndex={-1}>
      <div className="pl-board">
        {STAGES.map((stage,index)=>{const cards=visibleDeals.filter((deal)=>deal.stage===stage);return <section className="ws-col pl-col" data-stage={stage} key={stage} aria-label={`${stage} deals`}><header className="ws-col__head"><span className={`ws-col__dot${index===2?" ws-col__dot--doing":""}${index>2?" ws-col__dot--review":""}`} aria-hidden="true"/><h2 className="ws-col__name">{stage}</h2><span className="ws-col__count">{cards.length}</span></header><ol className="ws-list" aria-label={`${stage} cards`}>{cards.map((deal)=>{const member=members.find((item)=>item.name===deal.owner);const calculated=scoreFor(deal);return <li key={deal.id} className="ws-card pl-card" data-id={deal.id} onPointerDown={(event)=>{if(event.button!==0||(event.target as HTMLElement).closest("button,a"))return;const rect=event.currentTarget.getBoundingClientRect();ghostRef.current=event.currentTarget;dragRef.current={id:deal.id,pointerId:event.pointerId,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,offsetX:event.clientX-rect.left,offsetY:event.clientY-rect.top,width:rect.width,height:rect.height,started:false,target:null};}} onClickCapture={(event)=>{if(suppressClick.current){event.preventDefault();event.stopPropagation();}}} onClick={()=>{if(!suppressClick.current)setDetail(deal.id);}}><span className="ws-card__lift"/><div className="ws-card__top"><span className="pill ws-tag">{deal.source}</span><button type="button" className="ws-card__move" title="Close deal" aria-label={`Close ${deal.name} as won or lost`} onClick={(event)=>{event.stopPropagation();setDetail(deal.id);}}><Icon name="dots"/></button></div><h3 className="ws-card__title">{deal.name}</h3><p className="pl-company">{deal.company}</p>{index<3&&<span className={`pill pill--${leadScoreTone(calculated,settings)} pl-score`}>{calculated} · {leadScoreLabel(calculated,settings)}</span>}{index>=2&&<p className="pl-value"><b>{money(deal.value)}</b><span><Icon name="calendar"/> {new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric"}).format(new Date(`${deal.expectedClose}T12:00:00`))}</span></p>}<div className="ws-card__foot"><span title={deal.owner}><span className="av av--sm" style={{"--h":member?.hue??210} as React.CSSProperties}>{initials(deal.owner)}</span><span className="sr-only">{deal.owner}</span></span><span className="pl-source">{deal.source}</span></div></li>;})}</ol></section>;})}
        <aside className="pl-closeouts" aria-label="Closed deals">
          <button className="pl-closeout pl-closeout--won" type="button" data-closeout="won" onClick={()=>setCloseList("won")}><span className="pl-closeout__icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8v4a4 4 0 0 1-8 0V4ZM8 6H5v2a4 4 0 0 0 4 4M16 6h3v2a4 4 0 0 1-4 4M12 12v4m-4 4h8m-6-4h4v4h-4z"/></svg></span><b>Won</b><span>{thisMonth.length} this month · <strong>{money(closeValue)}</strong></span></button>
          <button className="pl-closeout pl-closeout--lost" type="button" data-closeout="lost" onClick={()=>setCloseList("lost")}><span className="pl-closeout__icon"><Icon name="x"/></span><b>Lost</b><span>{lost.length} closed lost</span></button>
        </aside>
      </div>
    </div>
    <dialog ref={sheetRef} className="sheet" aria-label={closeList?closeLabel:"Deal details"} onCancel={(event)=>{event.preventDefault();setCloseList(null);setDetail(null);}} onClick={(event)=>{if(event.target===event.currentTarget){setCloseList(null);setDetail(null);}}}>
      <div className="sheet__box"><header className="sheet__head"><h2>{closeList?closeLabel:selected?.name}</h2><button className="icon-btn" type="button" aria-label="Close" onClick={()=>{setCloseList(null);setDetail(null);}}><Icon name="x"/></button></header><div className="sheet__body">{closeList?<ul className="pl-closed-list">{closeDeals.map((deal)=><li key={deal.id}><span><b>{deal.name}</b><small>{deal.company} · {money(deal.value)}</small></span><button className="btn btn--sm" type="button" onClick={()=>reopen(deal)}>Reopen</button></li>)}{!closeDeals.length&&<li className="card__sub">No closed deals yet.</li>}</ul>:selected&&<div className="pl-detail"><p>{selected.company}</p><p>{selected.owner} · {selected.source}</p><p>{selected.stage} · {money(selected.value)}</p><div className="pl-detail__actions"><button className="btn" type="button" onClick={()=>closeDeal(selected,"lost")}>Mark lost</button><button className="btn btn--primary" type="button" onClick={()=>closeDeal(selected,"won")}>Mark won</button></div></div>}</div></div>
    </dialog>
  </div>;
}
