"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import gsap from "gsap";
import { DEFAULT_QUARTERLY_QUOTAS, PIPELINE_BOARD_FALLBACK, PIPELINE_BOARD_STORAGE_KEY, PIPELINE_HISTORY_DEALS, PIPELINE_QUOTA_STORAGE_KEY, PIPELINE_STAGES, PIPELINE_TODAY, type PipelineDealRecord, type PipelineHistoricalDeal, type PipelineStage } from "@/data/pipeline-insights-data";
import { WORKSPACE_MEMBERS } from "@/data/workspace-data";
import "@/styles/pipeline-insights.css";

type Period = "month" | "quarter" | "last-quarter" | "year";
type Deal = PipelineDealRecord;
const PERIODS: { value: Period; label: string }[] = [{value:"month",label:"This month"},{value:"quarter",label:"This quarter"},{value:"last-quarter",label:"Last quarter"},{value:"year",label:"Last 12 months"}];
const PROBABILITY: Record<PipelineStage,number> = {"New lead":.1,Contacted:.2,Qualified:.4,Proposal:.6,Negotiation:.75,Closing:.9};
const STAGE_ORDER: readonly (PipelineStage | "Won")[] = [...PIPELINE_STAGES,"Won"];
const DAY=86400000;
function dateOnly(value:number){return new Date(value).toISOString().slice(0,10);}
function periodBounds(period:Period){
  const now=new Date(PIPELINE_TODAY);const year=now.getUTCFullYear();const month=now.getUTCMonth();
  if(period==="month")return {start:Date.UTC(year,month,1),end:Date.UTC(year,month+1,1)};
  if(period==="quarter")return {start:Date.UTC(year,Math.floor(month/3)*3,1),end:Date.UTC(year,Math.floor(month/3)*3+3,1)};
  if(period==="last-quarter")return {start:Date.UTC(year,Math.floor(month/3)*3-3,1),end:Date.UTC(year,Math.floor(month/3)*3,1)};
  return {start:Date.UTC(year,month-11,1),end:Date.UTC(year,month+1,1)};
}
function usd(value:number,compact=false){return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0,...(compact?{notation:"compact" as const}: {})}).format(Math.round(value));}
function pct(value:number){return `${Math.round(value*100)}%`;}
function stageValue(stage:string){return stage==="Won"?1:PROBABILITY[stage as PipelineStage]??0;}
function normalizeBoardItem(item:Partial<Deal>,index:number):Deal|null{
  if(typeof item.id!=="string"||typeof item.name!=="string"||!PIPELINE_STAGES.includes(item.stage as PipelineStage))return null;
  const createdAt=item.createdAt??dateOnly(PIPELINE_TODAY-(45+index*2)*DAY);
  return {...PIPELINE_BOARD_FALLBACK[0],...item,createdAt,stageHistory:item.stageHistory??{[item.stage as PipelineStage]:createdAt},team:Array.isArray(item.team)?item.team:[],lostReason:item.closedAs==="lost"?(item.lostReason??"Not given"):undefined} as Deal;
}
function readData<T>(key:string,fallback:T):T{try{const value=localStorage.getItem(key);return value?JSON.parse(value) as T:fallback;}catch{return fallback;}}
function curve(values:number[],max:number,w:number,h:number,left:number,top:number,bottom:number){
  const innerH=h-top-bottom;return values.map((v,i)=>`${i?"L":"M"}${(left+i*(w-left-18)/Math.max(1,values.length-1)).toFixed(1)},${(h-bottom-v/Math.max(1,max)*innerH).toFixed(1)}`).join(" ");
}
function SvgLine({x1,y1,x2,y2,className}:{x1:number;y1:number;x2:number;y2:number;className:string}){return <line x1={x1} y1={y1} x2={x2} y2={y2} className={className}/>;}

export function PipelineInsightsView(){
  const rootRef=useRef<HTMLElement>(null);const chartRef=useRef<SVGSVGElement>(null);
  const [period,setPeriod]=useState<Period>("quarter");const [owner,setOwner]=useState<string|null>(null);
  const [board,setBoard]=useState<Deal[]>([]);const [quotas,setQuotas]=useState<Record<string,number>>(DEFAULT_QUARTERLY_QUOTAS);
  const [hoverIndex,setHoverIndex]=useState<number|null>(null);const [chartBox,setChartBox]=useState<{x:number;y:number;width:number;height:number}|null>(null);
  useEffect(()=>{
    const saved=readData<unknown>(PIPELINE_BOARD_STORAGE_KEY,PIPELINE_BOARD_FALLBACK);
    // Hydrate local board and quota records after mount so server output remains deterministic.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBoard(Array.isArray(saved)?saved.map((item,index)=>normalizeBoardItem(item as Partial<Deal>,index)).filter((item):item is Deal=>Boolean(item)):PIPELINE_BOARD_FALLBACK);
    const savedQuotas=readData<Record<string,number>>(PIPELINE_QUOTA_STORAGE_KEY,DEFAULT_QUARTERLY_QUOTAS);
    const merged={...DEFAULT_QUARTERLY_QUOTAS,...savedQuotas};setQuotas(merged);
    try{localStorage.setItem(PIPELINE_QUOTA_STORAGE_KEY,JSON.stringify(merged));}catch{}
    const refresh=()=>{const latest=readData<unknown>(PIPELINE_BOARD_STORAGE_KEY,PIPELINE_BOARD_FALLBACK);if(Array.isArray(latest))setBoard(latest.map((item,index)=>normalizeBoardItem(item as Partial<Deal>,index)).filter((item):item is Deal=>Boolean(item)));};
    window.addEventListener("storage",refresh);return()=>window.removeEventListener("storage",refresh);
  },[]);
  useEffect(()=>{
    const root=rootRef.current;if(!root||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
    gsap.fromTo(root.querySelectorAll(".pi-animate"),{opacity:0,y:14},{opacity:1,y:0,duration:.48,stagger:.045,ease:"power3.out",clearProps:"transform"});
    const paths=root.querySelectorAll<SVGPathElement>(".pi-chart__draw");paths.forEach(path=>{const length=path.getTotalLength();gsap.fromTo(path,{strokeDasharray:length,strokeDashoffset:length},{strokeDashoffset:0,duration:.8,ease:"power2.out",delay:.16});});
  },[]);

  const bounds=useMemo(()=>periodBounds(period),[period]);
  const owners=useMemo(()=>WORKSPACE_MEMBERS.map(member=>member.name),[]);
  const allDeals=useMemo(()=>{
    const live:PipelineHistoricalDeal[]=board.filter(deal=>deal.closedAs&&deal.closedAt).map(deal=>({id:deal.id,name:deal.name,company:deal.company,owner:deal.owner,source:deal.source,value:deal.value,createdAt:deal.createdAt,closedAt:dateOnly(deal.closedAt!),closedAs:deal.closedAs as "won"|"lost",stageHistory:deal.stageHistory??{},...(deal.lostReason?{lostReason:deal.lostReason}:{})}));
    return [...PIPELINE_HISTORY_DEALS,...live];
  },[board]);
  const filteredLive=useMemo(()=>board.filter(deal=>!deal.closedAs&&(!owner||deal.owner===owner)&&Date.parse(`${deal.expectedClose}T12:00:00Z`)>=bounds.start&&Date.parse(`${deal.expectedClose}T12:00:00Z`)<bounds.end),[board,owner,bounds]);
  const closed=useMemo(()=>allDeals.filter(deal=>(!owner||deal.owner===owner)&&Date.parse(`${deal.closedAt}T00:00:00Z`)>=bounds.start&&Date.parse(`${deal.closedAt}T00:00:00Z`)<bounds.end),[allDeals,owner,bounds]);
  const won=closed.filter(deal=>deal.closedAs==="won");const lost=closed.filter(deal=>deal.closedAs==="lost");
  const wonValue=won.reduce((sum,deal)=>sum+deal.value,0);const lostValue=lost.reduce((sum,deal)=>sum+deal.value,0);
  const quarterlyQuota=owner?(quotas[owner]??0):Object.values(quotas).reduce((sum,value)=>sum+value,0);
  const periodQuota=period==="month"?quarterlyQuota/3:period==="last-quarter"?quarterlyQuota:period==="year"?quarterlyQuota*4:quarterlyQuota;
  const openValue=filteredLive.reduce((sum,deal)=>sum+deal.value,0);const weightedOpen=filteredLive.reduce((sum,deal)=>sum+deal.value*stageValue(deal.stage),0);
  const remainingQuota=Math.max(0,periodQuota-wonValue);const winRate=won.length/Math.max(1,won.length+lost.length);
  const avgDeal=won.length?wonValue/won.length:0;const avgCycle=won.length?won.reduce((sum,deal)=>sum+(Date.parse(`${deal.closedAt}T00:00:00Z`)-Date.parse(`${deal.createdAt}T00:00:00Z`))/DAY,0)/won.length:0;
  const forecast=wonValue+weightedOpen;const low=wonValue+weightedOpen*.8;const high=wonValue+weightedOpen*1.2;
  const stages=useMemo(()=>filteredLive,[filteredLive]);
  const confidence=[
    {name:"Commit",deals:stages.filter(deal=>deal.stage==="Negotiation"||deal.stage==="Closing")},
    {name:"Best case",deals:stages.filter(deal=>["Qualified","Proposal","Negotiation","Closing"].includes(deal.stage))},
    {name:"Full pipeline",deals:stages},
  ].map(row=>({name:row.name,value:row.deals.reduce((sum,deal)=>sum+deal.value,0),cover:row.deals.reduce((sum,deal)=>sum+deal.value,0)/Math.max(1,remainingQuota)}));
  const funnel=useMemo(()=>{
    const cohort=[...allDeals,...board.filter(deal=>!deal.closedAs).map(deal=>({...deal,closedAt:"",closedAs:"lost" as const}))].filter(deal=>(!owner||deal.owner===owner)&&Date.parse(`${deal.createdAt}T00:00:00Z`)>=bounds.start&&Date.parse(`${deal.createdAt}T00:00:00Z`)<bounds.end);
    const counts=STAGE_ORDER.map(stage=>stage==="Won"?cohort.filter(deal=>deal.closedAs==="won").length:cohort.filter(deal=>Boolean(deal.stageHistory[stage])).length);
    return STAGE_ORDER.map((stage,index)=>({stage,count:counts[index],conversion:index?counts[index]/Math.max(1,counts[index-1]):1}));
  },[allDeals,board,owner,bounds]);
  const leaderboard=useMemo(()=>owners.map(name=>{
    const closedOwner=allDeals.filter(deal=>deal.owner===name&&Date.parse(`${deal.closedAt}T00:00:00Z`)>=bounds.start&&Date.parse(`${deal.closedAt}T00:00:00Z`)<bounds.end);
    const wins=closedOwner.filter(deal=>deal.closedAs==="won");const losses=closedOwner.filter(deal=>deal.closedAs==="lost");
    const open=board.filter(deal=>deal.owner===name&&!deal.closedAs&&Date.parse(`${deal.expectedClose}T12:00:00Z`)>=bounds.start&&Date.parse(`${deal.expectedClose}T12:00:00Z`)<bounds.end).reduce((sum,deal)=>sum+deal.value,0);const quota=(quotas[name]??0)*(period==="month"?1/3:period==="year"?4:1);
    return {name,won:wins.reduce((sum,deal)=>sum+deal.value,0),wonCount:wins.length,winRate:wins.length/Math.max(1,wins.length+losses.length),open,quota,progress:wins.reduce((sum,deal)=>sum+deal.value,0)/Math.max(1,quota)};
  }).sort((a,b)=>b.won-a.won),[owners,allDeals,board,bounds,quotas,period]);
  const months=useMemo(()=>Array.from({length:6},(_,index)=>{
    const cursor=new Date(PIPELINE_TODAY);cursor.setUTCDate(1);cursor.setUTCMonth(cursor.getUTCMonth()-(5-index));const start=Date.UTC(cursor.getUTCFullYear(),cursor.getUTCMonth(),1);const end=Date.UTC(cursor.getUTCFullYear(),cursor.getUTCMonth()+1,1);
    const items=allDeals.filter(deal=>(!owner||deal.owner===owner)&&Date.parse(`${deal.closedAt}T00:00:00Z`)>=start&&Date.parse(`${deal.closedAt}T00:00:00Z`)<end);
    const wins=items.filter(deal=>deal.closedAs==="won");const losses=items.filter(deal=>deal.closedAs==="lost");
    return {label:new Intl.DateTimeFormat("en-US",{month:"short"}).format(cursor),won:wins.reduce((sum,deal)=>sum+deal.value,0),lost:losses.reduce((sum,deal)=>sum+deal.value,0),rate:wins.length/Math.max(1,items.length)};
  }),[allDeals,owner]);
  const reasons=["Price","Competitor","No response","Bad timing","No budget","Not given"].map(reason=>({reason,count:lost.filter(deal=>(deal.lostReason??"Not given")===reason).length}));
  const sources=useMemo(()=>Array.from(new Set([...allDeals.map(deal=>deal.source),...board.map(deal=>deal.source)])).sort().map(source=>{
    const historical=allDeals.filter(deal=>deal.source===source&&(!owner||deal.owner===owner)&&Date.parse(`${deal.createdAt}T00:00:00Z`)>=bounds.start&&Date.parse(`${deal.createdAt}T00:00:00Z`)<bounds.end);
    const live=board.filter(deal=>deal.source===source&&(!owner||deal.owner===owner)&&Date.parse(`${deal.createdAt}T00:00:00Z`)>=bounds.start&&Date.parse(`${deal.createdAt}T00:00:00Z`)<bounds.end);
    const items=[...historical,...live];const wins=historical.filter(deal=>deal.closedAs==="won");const closedCount=historical.length;
    return {source,leads:items.length,rate:wins.length/Math.max(1,closedCount),average:items.length?items.reduce((sum,deal)=>sum+deal.value,0)/items.length:0};
  }),[allDeals,board,owner,bounds]);

  const chart=useMemo(()=>{
    const w=1000,h=330,left=66,top=22,bottom=45,right=20;const n=14;const quarterStart=Date.UTC(2026,9,1);const quarterEnd=Date.UTC(2027,0,1);const todayIndex=Math.max(0,Math.min(n-1,Math.round((PIPELINE_TODAY-quarterStart)/(quarterEnd-quarterStart)*(n-1))));
    const quarterWon=allDeals.filter(deal=>deal.closedAs==="won"&&(!owner||deal.owner===owner)&&Date.parse(`${deal.closedAt}T00:00:00Z`)>=quarterStart&&Date.parse(`${deal.closedAt}T00:00:00Z`)<quarterEnd).reduce((sum,deal)=>sum+deal.value,0);
    const quarterOpen=board.filter(deal=>!deal.closedAs&&(!owner||deal.owner===owner)&&Date.parse(`${deal.expectedClose}T12:00:00Z`)>=quarterStart&&Date.parse(`${deal.expectedClose}T12:00:00Z`)<quarterEnd);
    const projection=Array.from({length:n},(_,index)=>{
      const due=quarterStart+index/(n-1)*(quarterEnd-quarterStart);
      const weighted=quarterOpen.filter(deal=>Date.parse(`${deal.expectedClose}T12:00:00Z`)<=due).reduce((sum,deal)=>sum+deal.value*stageValue(deal.stage),0);
      return quarterWon+weighted;
    });
    const wonCurve=Array.from({length:todayIndex+1},(_,index)=>{
      const when=quarterStart+index/(n-1)*(quarterEnd-quarterStart);
      return allDeals.filter(deal=>deal.closedAs==="won"&&(!owner||deal.owner===owner)&&Date.parse(`${deal.closedAt}T00:00:00Z`)>=quarterStart&&Date.parse(`${deal.closedAt}T00:00:00Z`)<=when).reduce((sum,deal)=>sum+deal.value,0);
    });
    const upper=projection.map((value,index)=>quarterWon+(value-quarterWon)*(1+.2*(index/(n-1))));const lower=projection.map((value,index)=>quarterWon+(value-quarterWon)*(1-.2*(index/(n-1))));
    const quota=Array.from({length:n},(_,index)=>quarterlyQuota*index/(n-1));const max=Math.max(quarterlyQuota,...upper,...wonCurve,1)*1.12;
    const x=(index:number)=>left+index*(w-left-right)/(n-1);const y=(value:number)=>h-bottom-value/max*(h-top-bottom);
    const winPath=wonCurve.map((value,index)=>`${index?"L":"M"}${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(" ");const futureIndexes=Array.from({length:n-todayIndex},(_,index)=>todayIndex+index);const projectionPath=futureIndexes.map((index,offset)=>`${offset?"L":"M"}${x(index).toFixed(1)},${y(projection[index]).toFixed(1)}`).join(" ");const quotaPath=curve(quota,max,w,h,left,top,bottom);
    const bandUpper=futureIndexes.map((index,offset)=>`${offset?"L":"M"}${x(index)},${y(upper[index])}`).join(" ");const bandLower=[...futureIndexes].reverse().map(index=>`L${x(index)},${y(lower[index])}`).join(" ");
    const fill=`${winPath} L${x(todayIndex)},${h-bottom} L${left},${h-bottom} Z`;
    return {w,h,left,top,bottom,right,n,max,x,y,todayIndex,winPath,projectionPath,quotaPath,band:`${bandUpper} ${bandLower} Z`,fill,projection,quota,quarterStart,quarterEnd,quarterWon};
  },[allDeals,board,owner,quarterlyQuota]);
  const selectedPoint=hoverIndex===null?null:{index:hoverIndex,x:chart.x(hoverIndex),y:chart.y(chart.projection[hoverIndex]),date:new Date(chart.quarterStart+hoverIndex/(chart.n-1)*(chart.quarterEnd-chart.quarterStart)),low:chart.quarterWon+(chart.projection[hoverIndex]-chart.quarterWon)*.8,high:chart.quarterWon+(chart.projection[hoverIndex]-chart.quarterWon)*1.2};
  const onChartPointer=(event:ReactPointerEvent<SVGSVGElement>)=>{const rect=event.currentTarget.getBoundingClientRect();const local=(event.clientX-rect.left)/rect.width*chart.w;const value=Math.max(0,Math.min(chart.n-1,Math.round((local-chart.left)/(chart.w-chart.left-chart.right)*(chart.n-1))));setHoverIndex(value);setChartBox({x:event.clientX,y:event.clientY,width:rect.width,height:rect.height});};
  const maxReason=Math.max(1,...reasons.map(item=>item.count));const maxMonth=Math.max(1,...months.flatMap(item=>[item.won,item.lost]));
  return <section ref={rootRef} className="view pi-view" data-view="pipeline-insights">
    <div className="pi-controls pi-animate">
      <div className="seg pi-period" role="group" aria-label="Insights period">{PERIODS.map(item=><button type="button" key={item.value} aria-pressed={period===item.value} onClick={()=>setPeriod(item.value)}>{item.label}</button>)}</div>
      <div className="pi-owners" role="group" aria-label="Filter by owner"><button className={`chip${owner===null?" is-active":""}`} type="button" aria-pressed={owner===null} onClick={()=>setOwner(null)}>Everyone</button>{WORKSPACE_MEMBERS.map(member=><button className={`chip${owner===member.name?" is-active":""}`} type="button" key={member.name} aria-pressed={owner===member.name} onClick={()=>setOwner(owner===member.name?null:member.name)}><span className="av av--sm" style={{"--h":member.hue} as React.CSSProperties}>{member.initials}</span>{member.name.split(" ")[0]}</button>)}</div>
    </div>
    <div className="pi-stats">
      <article className="card stat pi-stat pi-animate"><span className="stat__label">Won this period</span><b className="stat__val">{usd(wonValue,true)}</b><small>{pct(wonValue/Math.max(1,periodQuota))} of quota</small></article>
      <article className="card stat pi-stat pi-animate"><span className="stat__label">Forecast</span><b className="stat__val">{usd(forecast,true)}</b><small>{usd(low,true)}â€“{usd(high,true)} likely range</small></article>
      <article className="card stat pi-stat pi-animate"><span className="stat__label">Open pipeline</span><b className="stat__val">{usd(openValue,true)}</b><small>{filteredLive.length} deals Â· {pct(openValue/Math.max(1,remainingQuota))} coverage</small></article>
      <article className="card stat pi-stat pi-animate"><span className="stat__label">Win rate</span><b className="stat__val">{pct(winRate)}</b><small>{won.length} won Â· {lost.length} lost</small></article>
      <article className="card stat pi-stat pi-animate"><span className="stat__label">Average deal size</span><b className="stat__val">{usd(avgDeal,true)}</b><small>Won deals this period</small></article>
      <article className="card stat pi-stat pi-animate"><span className="stat__label">Average sales cycle</span><b className="stat__val">{Math.round(avgCycle)} days</b><small>From created to won</small></article>
    </div>
    <article className="card pi-chart-card pi-animate">
      <header className="pi-card-head"><div><h2>The quarter, week by week</h2><p>Won so far {usd(wonValue,true)} Â· most likely lands at {usd(forecast,true)}</p></div><div className="pi-legend"><span><i className="pi-legend__won"/>Won</span><span><i className="pi-legend__projection"/>Projection</span><span><i className="pi-legend__quota"/>Quota pace</span></div></header>
      <div className="pi-chart-wrap"><svg ref={chartRef} className="pi-chart" viewBox={`0 0 ${chart.w} ${chart.h}`} role="img" aria-label="Quarterly won, projected revenue, and quota pace chart" onPointerMove={onChartPointer} onPointerLeave={()=>{setHoverIndex(null);setChartBox(null);}}>
        <defs><linearGradient id="pi-won-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" className="pi-gradient-top"/><stop offset="1" className="pi-gradient-bottom"/></linearGradient></defs>
        {[0,.25,.5,.75,1].map(step=>{const value=chart.max*step,y=chart.y(value);return <g key={step}><line x1={chart.left} x2={chart.w-chart.right} y1={y} y2={y} className="pi-gridline"/><text x={chart.left-8} y={y+4} textAnchor="end" className="pi-axis-label">{usd(value,true)}</text></g>})}
        <path d={chart.fill} fill="url(#pi-won-fill)"/>
        <path d={chart.band} className="pi-range"/>
        <path d={chart.quotaPath} className="pi-quota-line"/>
        <path d={chart.winPath} className="pi-won-line pi-chart__draw"/>
        <path d={chart.projectionPath} className="pi-projection-line pi-chart__draw"/>
        <SvgLine x1={chart.x(chart.todayIndex)} y1={chart.top} x2={chart.x(chart.todayIndex)} y2={chart.h-chart.bottom} className="pi-today-line"/><text x={chart.x(chart.todayIndex)+8} y={chart.top+12} className="pi-today-label">Today</text>
        {[0,2,4,6,8,10,12,13].map(index=>{const date=new Date(chart.quarterStart+index/(chart.n-1)*(chart.quarterEnd-chart.quarterStart));return <text key={index} x={chart.x(index)} y={chart.h-12} textAnchor="middle" className="pi-axis-label">{new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric"}).format(date)}</text>})}
        {selectedPoint&&<g className="pi-tooltip-guide"><line x1={selectedPoint.x} x2={selectedPoint.x} y1={chart.top} y2={chart.h-chart.bottom}/><circle cx={selectedPoint.x} cy={selectedPoint.y} r="5"/><circle cx={selectedPoint.x} cy={chart.y(chart.quota[selectedPoint.index])} r="4"/></g>}
      </svg>{selectedPoint&&chartBox&&<div className="pi-tooltip" style={{left:`${Math.max(12,Math.min(88,(selectedPoint.x/chart.w)*100))}%`,top:`${Math.max(8,Math.min(64,(chart.y(Math.max(chart.projection[selectedPoint.index],chart.quota[selectedPoint.index]))/chart.h)*100))}%`}}><b>{new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric"}).format(selectedPoint.date)}</b><span><i className="pi-tip-dot pi-tip-dot--quota"/>Quota pace <strong>{usd(chart.quota[selectedPoint.index])}</strong></span><span><i className="pi-tip-dot pi-tip-dot--projection"/>Projection <strong>{usd(chart.projection[selectedPoint.index])}</strong></span><small>Likely {usd(selectedPoint.low)} â€“ {usd(selectedPoint.high)}</small></div>}</div>
    </article>
    <div className="pi-grid">
      <article className="card pi-panel pi-animate"><header className="pi-card-head"><div><h2>Forecast by confidence</h2><p>Coverage of remaining quota: {usd(remainingQuota,true)} left</p></div></header><div className="pi-confidence">{confidence.map((row,index)=><div className="pi-confidence__row" key={row.name}><span>{row.name}</span><div className="pi-bar"><i style={{width:`${Math.min(100,row.cover*100)}%`,"--pi-fill":`var(--c${index+1})`} as React.CSSProperties}/></div><b>{usd(row.value,true)}</b><small>{pct(row.cover)} covered</small></div>)}</div></article>
      <article className="card pi-panel pi-animate"><header className="pi-card-head"><div><h2>Pipeline funnel</h2><p>Stage progress for leads created in this period</p></div></header><div className="pi-funnel">{funnel.map((item,index)=><div className="pi-funnel__row" key={item.stage}><span>{item.stage}</span><div className="pi-bar"><i style={{width:`${Math.max(2,item.count/Math.max(1,...funnel.map(row=>row.count))*100)}%`}}/></div><b>{item.count}</b>{index>0&&<small>{pct(item.conversion)}</small>}</div>)}</div></article>
      <article className="card pi-panel pi-animate"><header className="pi-card-head"><div><h2>Leaderboard</h2><p>Performance by owner</p></div></header><div className="pi-table-wrap"><table className="table pi-table"><thead><tr><th>Owner</th><th>Won</th><th>Deals</th><th>Win rate</th><th>Open</th><th>Quota</th></tr></thead><tbody>{leaderboard.map(row=>{const member=WORKSPACE_MEMBERS.find(item=>item.name===row.name);return <tr key={row.name} className={owner===row.name?"is-selected":""} onClick={()=>setOwner(owner===row.name?null:row.name)}><td><span className="pi-person"><span className="av av--sm" style={{"--h":member?.hue??210} as React.CSSProperties}>{member?.initials??row.name.slice(0,1)}</span><b>{row.name}</b></span></td><td>{usd(row.won,true)}</td><td>{row.wonCount}</td><td>{pct(row.winRate)}</td><td>{usd(row.open,true)}</td><td><span className="pi-quota-cell"><i><em style={{width:`${Math.min(100,row.progress*100)}%`}}/></i>{pct(row.progress)}</span></td></tr>})}</tbody></table></div></article>
      <article className="card pi-panel pi-animate"><header className="pi-card-head"><div><h2>Won vs lost by month</h2><p>Closed deal value Â· last 6 months</p></div><div className="pi-legend pi-legend--small"><span><i className="pi-legend__won"/>Won</span><span><i className="pi-legend__lost"/>Lost</span></div></header><div className="pi-month-chart">{months.map(item=><div className="pi-month" key={item.label}><b>{pct(item.rate)}</b><div className="pi-month__bars"><i className="is-won" style={{height:`${Math.max(2,item.won/maxMonth*100)}%`}}/><i className="is-lost" style={{height:`${Math.max(2,item.lost/maxMonth*100)}%`}}/></div><span>{item.label}</span></div>)}</div></article>
      <article className="card pi-panel pi-animate"><header className="pi-card-head"><div><h2>Lost reasons</h2><p>{lost.length} lost deals this period Â· {usd(lostValue,true)}</p></div></header><div className="pi-reasons">{reasons.map(item=><div className="pi-reason" key={item.reason}><span>{item.reason}</span><div className="pi-bar"><i style={{width:`${item.count/maxReason*100}%`}}/></div><b>{item.count}</b></div>)}</div></article>
      <article className="card pi-panel pi-animate"><header className="pi-card-head"><div><h2>Source performance</h2><p>Closed leads by original source</p></div></header><div className="pi-table-wrap"><table className="table pi-table"><thead><tr><th>Source</th><th>Leads</th><th>Win rate</th><th>Avg. won value</th></tr></thead><tbody>{sources.map(row=><tr key={row.source}><td>{row.source}</td><td>{row.leads}</td><td>{pct(row.rate)}</td><td>{usd(row.average,true)}</td></tr>)}</tbody></table></div></article>
    </div>
  </section>;
}

