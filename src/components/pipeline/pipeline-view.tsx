"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import gsap from "gsap";
import { Icon } from "@/components/icons/svg-sprite";
import { calculateLeadScore, createInitialMessageThreads, DEFAULT_LEAD_SCORING, LEAD_SCORING_STORAGE_KEY, SEEDED_EMAIL_LEADS, threadSubScores, leadScoreLabel, leadScoreTone, type LeadScoringSettings, type LeadSubScores, type MessageThread } from "@/data/messages-data";
import { WORKSPACE_MEMBERS } from "@/data/workspace-data";
import "@/styles/pipeline.css";

const BOARD_KEY = "corbel:pipeline:board";
const HANDOFF_KEY = "corbel:pipeline:leads";
const FIXTURE_NOW = Date.UTC(2026,9,26,12);
const STAGES = ["New lead", "Contacted", "Qualified", "Proposal", "Negotiation", "Closing"] as const;
type Stage = typeof STAGES[number];
type CloseState = "won" | "lost" | null;
type Deal = { id: string; name: string; company: string; owner: string; source: string; score: number; subScores: LeadSubScores; value: number; expectedClose: string; stage: Stage; closedAs: CloseState; closedAt: number | null; previousStage: Stage | null; handoffId?: string };
type Handoff = { id: string; name: string; company: string; source: string; score: number; owner: string };
type Drag = { id: string; pointerId: number; x: number; y: number; originX: number; originY: number; tilt: number; offsetX: number; offsetY: number; width: number; height: number; stage: Stage | null; target: string | null; beforeId?: string };
type PendingPointer = { id: string; pointerId: number; startX: number; startY: number; offsetX: number; offsetY: number; width: number; height: number };

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
  const addDialogRef = useRef<HTMLDialogElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const pointerRef = useRef<PendingPointer | null>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const dragMotionRef = useRef<{ x: (value: number) => void; y: (value: number) => void; rotation: (value: number) => void } | null>(null);
  const flipPositionsRef = useRef<Map<string, DOMRect> | null>(null);
  const suppressClickRef = useRef(false);
  const [deals,setDeals] = useState<Deal[]>(seed);
  const [now,setNow] = useState(FIXTURE_NOW);
  const [dragPreview,setDragPreview] = useState<Drag|null>(null);
  const [filter,setFilter] = useState<string | null>(null);
  const [settings,setSettings] = useState<LeadScoringSettings>(DEFAULT_LEAD_SCORING);
  const [closeList,setCloseList] = useState<CloseState>(null);
  const [detailId,setDetailId] = useState<string | null>(null);
  const [insightsOpen,setInsightsOpen] = useState(false);
  const [newDealStage,setNewDealStage] = useState<Stage | null>(null);
  const [notice,setNotice] = useState("");
  const persist = useCallback((update: (current: Deal[]) => Deal[]) => setDeals((current) => { const next=update(current); try { localStorage.setItem(BOARD_KEY,JSON.stringify(next)); } catch {} return next; }),[]);
  const selected=deals.find((deal)=>deal.id===detailId);
  const activeOverlay=Boolean(selected || closeList || insightsOpen);

  useEffect(() => {
    const threads = (() => { try { const saved=JSON.parse(localStorage.getItem("corbel:messages:threads") ?? "null") as MessageThread[] | null; return Array.isArray(saved) ? saved : createInitialMessageThreads(); } catch { return createInitialMessageThreads(); } })();
    const currentSettings=validSettings();
    // Read the current month after hydration so prerendered markup stays deterministic.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    // Restore browser-only preferences after hydration to keep server and client markup identical.
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
    if(activeOverlay&&!dialog.open){
      dialog.showModal();
      if(!window.matchMedia("(prefers-reduced-motion: reduce)").matches){
        const box=dialog.querySelector(".sheet__box");
        if(box)gsap.fromTo(box,{opacity:0,x:24},{opacity:1,x:0,duration:.56,ease:"power3.out",overwrite:true});
      }
    } else if(!activeOverlay&&dialog.open)dialog.close();
  },[activeOverlay]);

  useEffect(() => {
    const dialog=addDialogRef.current;
    if(!dialog)return;
    if(newDealStage&&!dialog.open){
      dialog.showModal();
      if(!window.matchMedia("(prefers-reduced-motion: reduce)").matches){
        const box=dialog.querySelector(".modal__box");
        if(box)gsap.fromTo(box,{opacity:0,y:16,scale:.97},{opacity:1,y:0,scale:1,duration:.34,ease:"power3.out",overwrite:true});
      }
    }else if(!newDealStage&&dialog.open)dialog.close();
  },[newDealStage]);

  useLayoutEffect(() => {
    const firstPositions=flipPositionsRef.current;
    if(!firstPositions)return;
    flipPositionsRef.current=null;
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
    firstPositions.forEach((first,id)=>{
      const card=rootRef.current?.querySelector<HTMLElement>(`.ws-card[data-id="${CSS.escape(id)}"]`);
      if(!card)return;
      gsap.set(card,{clearProps:"transform"});
      const last=card.getBoundingClientRect();
      const x=first.left-last.left; const y=first.top-last.top;
      if(Math.abs(x)<1&&Math.abs(y)<1)return;
      gsap.fromTo(card,{x,y},{x:0,y:0,duration:.38,ease:"power3.out",clearProps:"transform",overwrite:"auto"});
    });
  },[dragPreview?.stage,dragPreview?.beforeId]);

  const closeDeals=useCallback((state:"won"|"lost")=>persist((current)=>current.map((deal)=>deal.id===dragRef.current?.id?{...deal,previousStage:deal.stage,closedAs:state,closedAt:Date.now()}:deal)),[persist]);
  const moveDeal=useCallback((id:string,target:Stage,beforeId?:string)=>{
    const firstPositions=new Map<string,DOMRect>();
    const draggedFirst=rootRef.current?.querySelector<HTMLElement>(".ws-drag-preview")?.getBoundingClientRect();
    rootRef.current?.querySelectorAll<HTMLElement>(".ws-card").forEach((card)=>{if(card.dataset.id)firstPositions.set(card.dataset.id,card.getBoundingClientRect());});
    const first=draggedFirst;
    persist((current)=>{
      const items=[...current]; const source=items.find((deal)=>deal.id===id); if(!source)return current;
      const moved={...source,stage:target};
      const without=items.filter((deal)=>deal.id!==id);
      const insertGlobal=beforeId?without.findIndex((deal)=>deal.id===beforeId&&deal.stage===target):-1;
      without.splice(insertGlobal<0?without.length:insertGlobal,0,moved);
      return without;
    });
    if(!window.matchMedia("(prefers-reduced-motion: reduce)").matches)window.requestAnimationFrame(()=>{
      firstPositions.forEach((start,cardId)=>{const card=rootRef.current?.querySelector<HTMLElement>(`.ws-card[data-id="${CSS.escape(cardId)}"]`);if(!card)return;const last=card.getBoundingClientRect();const x=start.left-last.left;const y=start.top-last.top;if(Math.abs(x)<1&&Math.abs(y)<1)return;gsap.fromTo(card,{x,y},{x:0,y:0,duration:.48,ease:"expo.out",clearProps:"transform",overwrite:"auto"});});
      if(first){const moved=rootRef.current?.querySelector<HTMLElement>(`.ws-card[data-id="${CSS.escape(id)}"]`);if(moved){const last=moved.getBoundingClientRect();gsap.fromTo(moved,{x:first.left-last.left,y:first.top-last.top,scale:.98},{x:0,y:0,scale:1,duration:.42,ease:"power3.out",clearProps:"transform",overwrite:"auto"});}}
    });
  },[persist]);

  useEffect(() => {
    const onMove=(event:PointerEvent)=>{
      const pending=pointerRef.current;if(!pending||pending.pointerId!==event.pointerId)return;
      const dx=event.clientX-pending.startX;const dy=event.clientY-pending.startY;
      let current=dragRef.current;if(!current&&Math.hypot(dx,dy)<6)return;
      if(!current){current={id:pending.id,pointerId:pending.pointerId,x:event.clientX,y:event.clientY,originX:pending.startX-pending.offsetX,originY:pending.startY-pending.offsetY,tilt:0,offsetX:pending.offsetX,offsetY:pending.offsetY,width:pending.width,height:pending.height,stage:null,target:null};}
      const targetEl=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>(".pl-col,[data-closeout]");
      const targetStage=targetEl?.dataset.stage as Stage|undefined;
      const target=targetEl?.dataset.closeout??targetStage??null;
      let beforeId:string|undefined;
      const col=targetStage?rootRef.current?.querySelector<HTMLElement>(`.pl-col[data-stage="${CSS.escape(targetStage)}"]`):null;
      if(col){const cards=Array.from(col.querySelectorAll<HTMLElement>(".ws-card")).filter((card)=>card.dataset.id!==pending.id);const hovered=cards.find((card)=>event.clientY<card.getBoundingClientRect().top+card.getBoundingClientRect().height/2);if(hovered)beforeId=hovered.dataset.id;}
      const placementChanged=!dragRef.current||current.target!==target||current.beforeId!==beforeId;
      if(placementChanged){const positions=new Map<string,DOMRect>();rootRef.current?.querySelectorAll<HTMLElement>(".ws-card").forEach((card)=>{if(card.dataset.id&&card.dataset.id!==pending.id)positions.set(card.dataset.id,card.getBoundingClientRect());});flipPositionsRef.current=positions;}
      const next:Drag={...current,x:event.clientX,y:event.clientY,tilt:Math.max(-5,Math.min(5,dx*.12)),stage:targetStage??null,target,beforeId};dragRef.current=next;
      document.documentElement.classList.add("ws-grabbing");
      if(ghostRef.current){const reduce=window.matchMedia("(prefers-reduced-motion: reduce)").matches;if(reduce)gsap.set(ghostRef.current,{x:dx,y:dy,rotation:0});else if(!dragMotionRef.current)dragMotionRef.current={x:gsap.quickTo(ghostRef.current,"x",{duration:.14,ease:"power3.out"}),y:gsap.quickTo(ghostRef.current,"y",{duration:.14,ease:"power3.out"}),rotation:gsap.quickTo(ghostRef.current,"rotation",{duration:.12,ease:"power2.out"})};if(!reduce&&dragMotionRef.current){dragMotionRef.current.x(dx);dragMotionRef.current.y(dy);dragMotionRef.current.rotation(next.tilt);}}
      if(placementChanged)setDragPreview(next);
      event.preventDefault();
    };
    const onUp=(event:PointerEvent)=>{
      const pending=pointerRef.current;if(!pending||pending.pointerId!==event.pointerId)return;
      const drag=dragRef.current;
      if(drag){suppressClickRef.current=true;if(drag.target==="won"||drag.target==="lost")closeDeals(drag.target);else if(drag.stage)moveDeal(drag.id,drag.stage,drag.beforeId);window.setTimeout(()=>{suppressClickRef.current=false;},0);}
      pointerRef.current=null;dragRef.current=null;dragMotionRef.current=null;document.documentElement.classList.remove("ws-grabbing");setDragPreview(null);
    };
    window.addEventListener("pointermove",onMove,{passive:false});window.addEventListener("pointerup",onUp);window.addEventListener("pointercancel",onUp);
    return()=>{window.removeEventListener("pointermove",onMove);window.removeEventListener("pointerup",onUp);window.removeEventListener("pointercancel",onUp);};
  },[closeDeals,moveDeal]);

  const members=useMemo(()=>[...WORKSPACE_MEMBERS.map((member)=>({name:member.name,initials:member.initials,hue:member.hue})),...Array.from(new Set(deals.map((deal)=>deal.owner))).filter((name)=>!WORKSPACE_MEMBERS.some((member)=>member.name===name)).map((name)=>({name,initials:initials(name),hue:210}))],[deals]);
  const visibleDeals=useMemo(()=>deals.filter((deal)=>!deal.closedAs&&(!filter||deal.owner===filter)),[deals,filter]);
  const won=deals.filter((deal)=>deal.closedAs==="won"&&(!filter||deal.owner===filter));
  const lost=deals.filter((deal)=>deal.closedAs==="lost"&&(!filter||deal.owner===filter));
  const thisMonth=won.filter((deal)=>deal.closedAt!==null&&new Date(deal.closedAt).getMonth()===new Date(now).getMonth()&&new Date(deal.closedAt).getFullYear()===new Date(now).getFullYear());
  const openValue=visibleDeals.reduce((sum,deal)=>sum+deal.value,0);
  const weighted=visibleDeals.reduce((sum,deal)=>sum+deal.value*stageProbability[deal.stage],0);
  const wonValue=thisMonth.reduce((sum,deal)=>sum+deal.value,0);
  const scoreFor=(deal:Deal)=>calculateLeadScore(deal.subScores,settings);
  const closeListDeals=closeList==="won"?won:lost;
  const closeLabel=closeList==="won"?"Won deals":"Lost deals";
  const pendingDeal=dragPreview?deals.find((deal)=>deal.id===dragPreview.id):null;
  const dismissOverlay=()=>{setCloseList(null);setDetailId(null);setInsightsOpen(false);};
  const closeDeal=(deal:Deal,state:"won"|"lost")=>persist((current)=>current.map((item)=>item.id===deal.id?{...item,previousStage:item.stage,closedAs:state,closedAt:Date.now()}:item));
  const reopen=(deal:Deal)=>{persist((current)=>current.map((item)=>item.id===deal.id?{...item,stage:item.previousStage??"Contacted",previousStage:null,closedAs:null,closedAt:null}:item));setCloseList(null);};
  const openAdd=(stage:Stage)=>{addDialogRef.current?.querySelector("form")?.reset();setNewDealStage(stage);};
  const addDeal=(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();const form=event.currentTarget;const data=new FormData(form);const name=String(data.get("name")??"").trim();if(!name)return;const owner=String(data.get("owner")??WORKSPACE_MEMBERS[0].name);const stage=String(data.get("stage")??newDealStage??"New lead") as Stage;const value=Number(data.get("value"))||0;const due=new Date();due.setDate(due.getDate()+30);const date=String(data.get("expectedClose")||`${due.getFullYear()}-${String(due.getMonth()+1).padStart(2,"0")}-${String(due.getDate()).padStart(2,"0")}`);const deal:Deal={id:`deal-${Date.now().toString(36)}`,name,company:String(data.get("company")??"").trim(),owner,source:String(data.get("source")??"Website"),score:50,subScores:{fit:50,intent:50,engagement:50},value,expectedClose:date,stage,closedAs:null,closedAt:null,previousStage:null};persist((current)=>[...current,deal]);form.reset();setNewDealStage(null);setNotice(`${name} added to ${stage}`);window.setTimeout(()=>setNotice(""),2400);};
  const probabilities:Record<Stage,number>={"New lead":.1,Contacted:.2,Qualified:.4,Proposal:.6,Negotiation:.75,Closing:.9};
  const updateDeal=(id:string,update:Partial<Deal>)=>persist((current)=>current.map((deal)=>deal.id===id?{...deal,...update}:deal));

  return <div ref={rootRef} className="ws pl" data-view="pipeline">
    <section className="card ws-head pl-head" aria-label="Pipeline controls">
      <div className="ws-head__about"><span className="ws-head__dot" style={{"--dot":"var(--primary)"} as CSSProperties}/><div className="ws-head__txt"><h2 className="ws-head__desc">Deal pipeline</h2><p className="ws-head__meta"><span>{visibleDeals.length} open deals</span><span className="ws-head__n">Weighted forecast {money(weighted)}</span></p></div></div>
      <div className="ws-head__tools"><div className="ws-head__people" role="group" aria-label="Filter by owner"><span className="ws-head__label">Owner</span><div className="ws-people">{members.map((member)=><button key={member.name} className="ws-person" type="button" aria-pressed={filter===member.name} title={member.name} aria-label={`Show ${member.name}'s deals`} onClick={()=>setFilter((current)=>current===member.name?null:member.name)}><span className="av av--sm" style={{"--h":member.hue} as CSSProperties}>{member.initials}</span></button>)}</div><button className="link-btn ws-clear" type="button" hidden={!filter} onClick={()=>setFilter(null)}>Show all</button></div><button className="btn" type="button" onClick={()=>setInsightsOpen(true)}><Icon name="chart"/>Insights</button><button className="btn btn--primary ws-head__add" type="button" onClick={()=>openAdd("New lead")}><Icon name="plus"/>New deal</button></div>
    </section>
    <div className="pl-board-wrap">
    <div className="ws-scroll pl-scroll" role="region" aria-label="Pipeline stages" tabIndex={-1}>
      <div className="pl-board">
        {STAGES.map((stage,index)=>{const cards=visibleDeals.filter((deal)=>deal.stage===stage);return <section className={`ws-col pl-col${dragPreview?" is-drop-ready":""}${dragPreview?.stage===stage?" is-drop-target":""}`} data-stage={stage} key={stage} aria-label={`${stage} deals`}><header className="ws-col__head"><span className={`ws-col__dot${index===2?" ws-col__dot--doing":""}${index>2?" ws-col__dot--review":""}`} aria-hidden="true"/><h2 className="ws-col__name">{stage}</h2><span className="ws-col__count">{cards.length}</span><button className="icon-btn ws-col__plus" type="button" aria-label={`Add a deal to ${stage}`} onClick={()=>openAdd(stage)}><Icon name="plus"/></button></header><ol className="ws-list pl-list" aria-label={`${stage} cards`}>
          {cards.filter((deal)=>deal.id!==dragPreview?.id).map((deal,cardIndex,cards)=>{const member=members.find((item)=>item.name===deal.owner);const calculated=scoreFor(deal);return <Fragment key={deal.id}>{dragPreview?.stage===stage&&dragPreview.beforeId===deal.id&&<li className="ws-ph" aria-hidden="true" style={{"--ws-ph-height":`${dragPreview.height}px`} as CSSProperties}/>}<li className="ws-card pl-card" data-id={deal.id} onPointerDown={(event)=>{if(event.button!==0||(event.target as HTMLElement).closest("button,input,select,a"))return;const rect=event.currentTarget.getBoundingClientRect();pointerRef.current={id:deal.id,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,offsetX:event.clientX-rect.left,offsetY:event.clientY-rect.top,width:rect.width,height:rect.height};}} onClickCapture={(event)=>{if(suppressClickRef.current){event.preventDefault();event.stopPropagation();}}} onClick={()=>{if(!suppressClickRef.current)setDetailId(deal.id);}}><span className="ws-card__lift" aria-hidden="true"/><div className="ws-card__top"><span className="pill ws-tag">{deal.source}</span><span className="pill pill--gray pl-company-tag">{deal.company||"No company"}</span></div><h3 className="ws-card__title">{deal.name}</h3>{index<3&&<span className={`pill pill--${leadScoreTone(calculated,settings)} pl-score`}>{calculated} · {leadScoreLabel(calculated,settings)}</span>}{index>=2&&<p className="pl-value"><b>{money(deal.value)}</b><span><Icon name="calendar"/> {new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric"}).format(new Date(`${deal.expectedClose}T12:00:00`))}</span></p>}<div className="ws-card__foot"><span title={deal.owner}><span className="av av--sm" style={{"--h":member?.hue??210} as CSSProperties}>{initials(deal.owner)}</span><span className="sr-only">{deal.owner}</span></span></div></li>{dragPreview?.stage===stage&&!dragPreview.beforeId&&cardIndex===cards.length-1&&<li className="ws-ph" aria-hidden="true" style={{"--ws-ph-height":`${dragPreview.height}px`} as CSSProperties}/>}</Fragment>;})}
          {dragPreview?.stage===stage&&!dragPreview.beforeId&&cards.length===0&&<li className="ws-ph" aria-hidden="true" style={{"--ws-ph-height":`${dragPreview.height}px`} as CSSProperties}/>}
        </ol>
        </section>;})}
      </div>
      <span className="sr-only" aria-live="polite">{visibleDeals.length} open deals</span>
    </div>
    <aside className="pl-closeouts" aria-label="Closed deals">
      <button className={`pl-closeout pl-closeout--won${dragPreview?.target==="won"?" is-drop-target":""}`} type="button" data-closeout="won" onClick={()=>{if(!suppressClickRef.current)setCloseList("won");}}><span className="pl-closeout__icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8v4a4 4 0 0 1-8 0V4ZM8 6H5v2a4 4 0 0 0 4 4M16 6h3v2a4 4 0 0 1-4 4M12 12v4m-4 4h8m-6-4h4v4h-4z"/></svg></span><b>Won</b><span>{thisMonth.length} this month · <strong>{money(wonValue)}</strong></span></button>
      <button className={`pl-closeout pl-closeout--lost${dragPreview?.target==="lost"?" is-drop-target":""}`} type="button" data-closeout="lost" onClick={()=>{if(!suppressClickRef.current)setCloseList("lost");}}><span className="pl-closeout__icon"><Icon name="x"/></span><b>Lost</b><span>{lost.length} closed lost</span></button>
    </aside>
    </div>
    {dragPreview&&pendingDeal&&<div ref={ghostRef} className="ws-drag-preview pl-drag-preview" aria-hidden="true" style={{left:dragPreview.originX,top:dragPreview.originY,width:dragPreview.width,height:dragPreview.height}}><span className="pill ws-tag">{pendingDeal.source}</span><b>{pendingDeal.name}</b><small>{pendingDeal.company}</small>{pendingDeal.stage!=="New lead"&&<span>{money(pendingDeal.value)}</span>}</div>}
    {notice&&<div className="toasts" aria-live="polite"><div className="toast" role="status"><span className="toast__ico"><Icon name="check"/></span><span>{notice}</span></div></div>}
    <dialog ref={addDialogRef} className="modal" aria-label="Add deal" onCancel={()=>setNewDealStage(null)} onClick={(event)=>{if(event.target===addDialogRef.current)setNewDealStage(null);}}>
      <form className="modal__box" onSubmit={addDeal}>
        <header className="modal__head"><h2>Add deal</h2><button className="icon-btn" type="button" aria-label="Close" onClick={()=>setNewDealStage(null)}><Icon name="x"/></button></header>
        <div className="modal__body"><div className="prd-form">
          <div className="field prd-form__wide"><label className="label" htmlFor="pl-new-name">Deal name</label><input className="input" id="pl-new-name" name="name" autoComplete="off" placeholder="Contact or opportunity name" maxLength={90} required autoFocus/></div>
          <div className="field prd-form__wide"><label className="label" htmlFor="pl-new-company">Company</label><input className="input" id="pl-new-company" name="company" autoComplete="off" placeholder="Company name" maxLength={90}/></div>
          <div className="field"><label className="label" htmlFor="pl-new-stage">Stage</label><select className="select" id="pl-new-stage" name="stage" value={newDealStage??"New lead"} onChange={(event)=>setNewDealStage(event.target.value as Stage)}>{STAGES.map((stage)=><option key={stage}>{stage}</option>)}</select></div>
          <div className="field"><label className="label" htmlFor="pl-new-owner">Owner</label><select className="select" id="pl-new-owner" name="owner" defaultValue={filter??WORKSPACE_MEMBERS[0].name}>{members.map((member)=><option key={member.name}>{member.name}</option>)}</select></div>
          <div className="field"><label className="label" htmlFor="pl-new-source">Source</label><select className="select" id="pl-new-source" name="source" defaultValue="Website"><option>Website</option><option>Email</option><option>Instagram</option><option>Referral</option><option>Partner</option><option>Phone</option></select></div>
          <div className="field"><label className="label" htmlFor="pl-new-value">Deal value</label><input className="input" id="pl-new-value" name="value" type="number" inputMode="decimal" min="0" step="100" placeholder="0"/></div>
          <div className="field prd-form__wide"><label className="label" htmlFor="pl-new-date">Expected close</label><input className="input" id="pl-new-date" name="expectedClose" type="date"/></div>
        </div></div>
        <footer className="modal__foot"><button className="btn" type="button" onClick={()=>setNewDealStage(null)}>Cancel</button><button className="btn btn--primary" type="submit"><Icon name="plus"/>Add deal</button></footer>
      </form>
    </dialog>
    <dialog ref={sheetRef} className="sheet" aria-label={insightsOpen?"Pipeline insights":closeList?closeLabel:"Deal details"} onCancel={(event)=>{event.preventDefault();dismissOverlay();}} onClose={dismissOverlay} onClick={(event)=>{if(event.target===sheetRef.current)dismissOverlay();}}>
      <div className="sheet__box"><header className="sheet__head"><h2>{insightsOpen?"Pipeline insights":closeList?closeLabel:"Deal details"}</h2><button className="icon-btn" type="button" aria-label="Close" onClick={dismissOverlay}><Icon name="x"/></button></header>
        <div className="sheet__body">
          {insightsOpen&&<div className="pl-insights"><article className="card pl-insight"><span className="stat__label">Open value</span><b className="stat__val">{money(openValue)}</b></article><article className="card pl-insight"><span className="stat__label">Weighted value</span><b className="stat__val">{money(weighted)}</b></article><article className="card pl-insight"><span className="stat__label">Won this month</span><b className="stat__val">{money(wonValue)}</b></article><article className="card pl-insight"><span className="stat__label">Waiting to be qualified</span><b className="stat__val">{visibleDeals.filter((deal)=>deal.stage==="New lead").length}</b></article><section className="card pl-insight"><div className="card__head"><h3 className="card__title">Weighted forecast by stage</h3></div><ul className="pl-probabilities">{STAGES.map((stage)=><li key={stage}><span>{stage}</span><b>{Math.round(probabilities[stage]*100)}%</b><small>{money(visibleDeals.filter((deal)=>deal.stage===stage).reduce((sum,deal)=>sum+deal.value*probabilities[stage],0))}</small></li>)}</ul></section></div>}
          {closeList&&<ul className="pl-closed-list">{closeListDeals.map((deal)=><li key={deal.id}><span><b>{deal.name}</b><small>{deal.company} · {money(deal.value)}</small></span><button className="btn btn--sm" type="button" onClick={()=>reopen(deal)}>Reopen</button></li>)}{!closeListDeals.length&&<li className="card__sub">No closed deals yet.</li>}</ul>}
          {selected&&<div className="ws-sh pl-detail"><div className="field"><label className="label" htmlFor="pl-detail-name">Deal name</label><input className="input" id="pl-detail-name" value={selected.name} maxLength={90} onChange={(event)=>updateDeal(selected.id,{name:event.target.value})}/></div><div className="field"><label className="label" htmlFor="pl-detail-company">Company</label><input className="input" id="pl-detail-company" value={selected.company} maxLength={90} onChange={(event)=>updateDeal(selected.id,{company:event.target.value})}/></div><div className="ws-sc__grid"><div className="field"><label className="label" htmlFor="pl-detail-stage">Stage</label><select className="select" id="pl-detail-stage" value={selected.stage} onChange={(event)=>updateDeal(selected.id,{stage:event.target.value as Stage})}>{STAGES.map((stage)=><option key={stage}>{stage}</option>)}</select></div><div className="field"><label className="label" htmlFor="pl-detail-owner">Owner</label><select className="select" id="pl-detail-owner" value={selected.owner} onChange={(event)=>updateDeal(selected.id,{owner:event.target.value})}>{members.map((member)=><option key={member.name}>{member.name}</option>)}</select></div><div className="field"><label className="label" htmlFor="pl-detail-source">Source</label><select className="select" id="pl-detail-source" value={selected.source} onChange={(event)=>updateDeal(selected.id,{source:event.target.value})}>{["Website","Email","Instagram","Referral","Partner","Phone"].map((source)=><option key={source}>{source}</option>)}</select></div><div className="field"><label className="label" htmlFor="pl-detail-value">Deal value</label><input className="input" id="pl-detail-value" type="number" min="0" value={selected.value} onChange={(event)=>updateDeal(selected.id,{value:Number(event.target.value)||0})}/></div><div className="field"><label className="label" htmlFor="pl-detail-date">Expected close</label><input className="input" id="pl-detail-date" type="date" value={selected.expectedClose} onChange={(event)=>updateDeal(selected.id,{expectedClose:event.target.value})}/></div></div><p className="card__sub">Lead score: <span className={`pill pill--${leadScoreTone(scoreFor(selected),settings)}`}>{scoreFor(selected)} · {leadScoreLabel(scoreFor(selected),settings)}</span></p></div>}
        </div>
        {selected&&<footer className="sheet__foot"><button className="btn btn--danger btn--ghost ws-sc__del" type="button" onClick={()=>closeDeal(selected,"lost")}>Mark lost</button><button className="btn btn--primary" type="button" onClick={()=>closeDeal(selected,"won")}>Mark won</button><button className="btn btn--dark" type="button" onClick={dismissOverlay}>Done</button></footer>}
      </div>
    </dialog>
  </div>;
}
