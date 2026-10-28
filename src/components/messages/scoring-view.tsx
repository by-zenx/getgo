"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icons/svg-sprite";
import { calculateLeadScore, createInitialMessageThreads, DEFAULT_LEAD_SCORING, leadOwner, leadScoreLabel, leadScoreTone, leadScoreWhy, LEAD_SCORING_STORAGE_KEY, MESSAGE_CONTACTS, SEEDED_EMAIL_LEADS, threadSubScores, type LeadScoringSettings, type LeadSubScores, type MessageThread } from "@/data/messages-data";
import "@/styles/lead-scoring-config.css";

const THREADS_KEY = "corbel:messages:threads";
const PIPELINE_KEY = "corbel:pipeline:leads";
type ScoreFilter = "all" | "Hot" | "Warm" | "Cold";
type ScoredLead = { id: string; name: string; company: string; source: string; score: number; subScores: LeadSubScores; why: string; owner: string };
type PipelineLead = Omit<ScoredLead, "subScores" | "why">;
type WeightKey = keyof LeadSubScores;

const FILTERS: ScoreFilter[] = ["all", "Hot", "Warm", "Cold"];
const WEIGHT_DETAILS: { key: WeightKey; label: string; description: string }[] = [
  { key: "fit", label: "Fit", description: "Company size, industry and role." },
  { key: "intent", label: "Intent", description: "Pricing or quote requests and plan questions." },
  { key: "engagement", label: "Engagement", description: "Email opens, site visits and replies." },
];
const SCORE_BANDS = [
  { label: "0–19", min: 0, max: 19 },
  { label: "20–39", min: 20, max: 39 },
  { label: "40–59", min: 40, max: 59 },
  { label: "60–79", min: 60, max: 79 },
  { label: "80–99", min: 80, max: 99 },
];

function readThreads(): MessageThread[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(THREADS_KEY) ?? "null") as MessageThread[] | null;
    if (Array.isArray(parsed) && parsed.every((thread) => typeof thread.id === "string" && Array.isArray(thread.msgs))) return parsed;
  } catch { /* Use the seeded inbox when saved data is unavailable. */ }
  return createInitialMessageThreads();
}
function readPipeline(): PipelineLead[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(PIPELINE_KEY) ?? "[]") as PipelineLead[];
    return Array.isArray(parsed) ? parsed.filter((lead) => typeof lead.id === "string") : [];
  } catch { return []; }
}
function readScoringSettings(): LeadScoringSettings {
  try {
    const settings = JSON.parse(localStorage.getItem(LEAD_SCORING_STORAGE_KEY) ?? "null") as LeadScoringSettings | null;
    if (settings && Object.values(settings.weights).every(Number.isFinite)
      && settings.weights.fit + settings.weights.intent + settings.weights.engagement === 100
      && Number.isInteger(settings.warmCutoff) && Number.isInteger(settings.hotCutoff)
      && settings.warmCutoff >= 0 && settings.hotCutoff > settings.warmCutoff && settings.hotCutoff <= 100) return settings;
  } catch { /* Use the default scoring setup when storage is unavailable. */ }
  return DEFAULT_LEAD_SCORING;
}
function rebalanceWeights(current: LeadSubScores, changed: WeightKey, value: number): LeadSubScores {
  const others = (Object.keys(current) as WeightKey[]).filter((key) => key !== changed);
  const remainder = 100 - value;
  const oldTotal = current[others[0]] + current[others[1]];
  const first = oldTotal ? Math.round(remainder * current[others[0]] / oldTotal) : Math.floor(remainder / 2);
  return { ...current, [changed]: value, [others[0]]: first, [others[1]]: remainder - first };
}
function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }

export function ScoringView() {
  const configDialogRef = useRef<HTMLDialogElement>(null);
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [pipeline, setPipeline] = useState<PipelineLead[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ScoreFilter>("all");
  const [sortDescending, setSortDescending] = useState(true);
  const [notice, setNotice] = useState("");
  const [configOpen, setConfigOpen] = useState(false);
  const [savedSettings, setSavedSettings] = useState<LeadScoringSettings>(DEFAULT_LEAD_SCORING);
  const [draftSettings, setDraftSettings] = useState<LeadScoringSettings>(DEFAULT_LEAD_SCORING);

  useEffect(() => {
    // Restore inbox records and scoring settings after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThreads(readThreads());
    setPipeline(readPipeline());
    const initialSettings = readScoringSettings();
    setSavedSettings(initialSettings);
    setDraftSettings(initialSettings);
    const refresh = () => {
      setThreads(readThreads());
      setPipeline(readPipeline());
      const latest = readScoringSettings();
      setSavedSettings(latest);
      setDraftSettings((current) => configDialogRef.current?.open ? current : latest);
    };
    window.addEventListener("storage", refresh);
    window.addEventListener("corbel:messages-updated", refresh);
    window.addEventListener("corbel:pipeline-leads-updated", refresh);
    window.addEventListener("corbel:lead-scoring-updated", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("corbel:messages-updated", refresh);
      window.removeEventListener("corbel:pipeline-leads-updated", refresh);
      window.removeEventListener("corbel:lead-scoring-updated", refresh);
    };
  }, []);

  useEffect(() => {
    const dialog = configDialogRef.current;
    if (!dialog) return;
    if (configOpen && !dialog.open) dialog.showModal();
    else if (!configOpen && dialog.open) dialog.close();
  }, [configOpen]);

  const baseLeads = useMemo((): Omit<ScoredLead, "score">[] => {
    const inboxLeads = threads.map((thread) => {
      const contact = MESSAGE_CONTACTS.find((item) => item.id === thread.customerId);
      return {
        id: `thread:${thread.id}`,
        name: contact?.name ?? "Unknown customer",
        company: contact?.company ?? "",
        source: thread.channel === "chat" ? "Website" : thread.channel === "instagram" ? "Instagram" : "Email",
        subScores: threadSubScores(thread),
        why: leadScoreWhy(thread),
        owner: leadOwner(thread),
      };
    });
    const emailLeads = SEEDED_EMAIL_LEADS.map((lead) => ({
      id: lead.id,
      name: lead.name,
      company: lead.company,
      source: "Email",
      subScores: { fit: lead.fit, intent: lead.intent, engagement: lead.engagement },
      why: lead.scoreWhy,
      owner: lead.owner,
    }));
    return [...inboxLeads, ...emailLeads];
  }, [threads]);

  const activeSettings = configOpen ? draftSettings : savedSettings;
  const leads = useMemo<ScoredLead[]>(() => baseLeads.map((lead) => ({ ...lead, score: calculateLeadScore(lead.subScores, activeSettings) })), [baseLeads, activeSettings]);
  const visible = useMemo(() => {
    const search = query.trim().toLowerCase();
    return leads.filter((lead) => (filter === "all" || leadScoreLabel(lead.score, activeSettings) === filter)
      && (!search || `${lead.name} ${lead.company} ${lead.source} ${lead.why} ${lead.owner}`.toLowerCase().includes(search)))
      .sort((a, b) => (sortDescending ? b.score - a.score : a.score - b.score) || a.name.localeCompare(b.name));
  }, [leads, query, filter, sortDescending, activeSettings]);

  const previewCount = baseLeads.filter((lead) => {
    const savedScore = calculateLeadScore(lead.subScores, savedSettings);
    const draftScore = calculateLeadScore(lead.subScores, draftSettings);
    return leadScoreLabel(savedScore, savedSettings) !== leadScoreLabel(draftScore, draftSettings);
  }).length;
  const distribution = SCORE_BANDS.map((band) => ({
    ...band,
    count: leads.filter((lead) => lead.score >= band.min && lead.score <= band.max).length,
  }));
  const maxBandCount = Math.max(1, ...distribution.map((band) => band.count));

  const addToPipeline = (lead: ScoredLead) => {
    const record: PipelineLead = { id: lead.id, name: lead.name, company: lead.company, source: lead.source, score: lead.score, owner: lead.owner };
    const next = [...readPipeline().filter((item) => item.id !== record.id), record];
    try {
      localStorage.setItem(PIPELINE_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event("corbel:pipeline-leads-updated"));
      setPipeline(next);
      setNotice(`${lead.name} added to pipeline`);
      window.setTimeout(() => setNotice(""), 3500);
    } catch { setNotice("Could not save this lead to the pipeline"); }
  };

  const saveSettings = () => {
    try {
      localStorage.setItem(LEAD_SCORING_STORAGE_KEY, JSON.stringify(draftSettings));
      setSavedSettings(draftSettings);
      setConfigOpen(false);
      window.dispatchEvent(new Event("corbel:lead-scoring-updated"));
      setNotice("Scoring settings saved");
      window.setTimeout(() => setNotice(""), 3000);
    } catch { setNotice("Could not save scoring settings"); }
  };
  const discardSettings = () => {
    setDraftSettings(savedSettings);
    setConfigOpen(false);
  };
  const updateWeight = (key: WeightKey, value: number) => {
    setDraftSettings((current) => ({ ...current, weights: rebalanceWeights(current.weights, key, value) }));
  };
  const updateWarmCutoff = (value: number) => setDraftSettings((current) => ({ ...current, warmCutoff: clamp(Math.round(value), 0, current.hotCutoff - 1) }));
  const updateHotCutoff = (value: number) => setDraftSettings((current) => ({ ...current, hotCutoff: clamp(Math.round(value), current.warmCutoff + 1, 100) }));

  return <div className="view" data-view="messages">
    <div className="toolbar">
      <div className="chips" role="group" aria-label="Filter lead score">
        {FILTERS.map((item) => <button className="chip" key={item} type="button" aria-pressed={filter === item} onClick={() => setFilter(item)}>{item === "all" ? "All scores" : item}</button>)}
      </div>
      <label className="input-icon msg-search"><Icon name="search" /><span className="sr-only">Search scored leads</span><input className="input" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search leads" autoComplete="off" /></label>
      <span className="card__sub" aria-live="polite">{visible.length} leads</span>
      <div className="toolbar__end"><button className="btn" type="button" onClick={() => setConfigOpen(true)}><Icon name="gear" />Configure scoring</button></div>
    </div>

    <section className="card" aria-labelledby="lead-score-list-title">
      <div className="card__head"><h2 className="card__title" id="lead-score-list-title">Ranked leads</h2><span className="card__actions card__sub">Highest score first</span></div>
      <div className="table-wrap"><table className="table">
        <thead><tr><th scope="col">Name</th><th scope="col">Source</th><th scope="col" aria-sort={sortDescending ? "descending" : "ascending"}><button className="sort" type="button" onClick={() => setSortDescending((value) => !value)}>Score<Icon name="arrow-up" /></button></th><th scope="col">Why</th><th scope="col">Owner</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Action</span></th></tr></thead>
        <tbody>{visible.map((lead) => {
          const inPipeline = pipeline.some((item) => item.id === lead.id);
          return <tr key={lead.id}>
            <td><span className="cell-main"><span><b>{lead.name}</b>{lead.company && <small>{lead.company}</small>}</span></span></td>
            <td>{lead.source}</td>
            <td><span className={`pill pill--${leadScoreTone(lead.score, activeSettings)}`}>{lead.score} · {leadScoreLabel(lead.score, activeSettings)}</span></td>
            <td>{lead.why}</td>
            <td>{lead.owner}</td>
            <td><span className={`pill pill--${inPipeline ? "mint" : "gray"}`}>{inPipeline ? "In pipeline" : "New"}</span></td>
            <td><button className="btn btn--sm" type="button" disabled={inPipeline} onClick={() => addToPipeline(lead)}>{inPipeline ? "View in pipeline" : "Add to pipeline"}</button></td>
          </tr>;
        })}</tbody>
      </table></div>
      {!visible.length && <div className="empty"><Icon name="users" /><b>No leads match</b><span>Try a name, source or score filter.</span></div>}
    </section>

    <dialog ref={configDialogRef} className="sheet" aria-label="Configure lead scoring" onCancel={(event) => { event.preventDefault(); discardSettings(); }} onClose={() => { if (configOpen) discardSettings(); }} onClick={(event) => { if (event.target === configDialogRef.current) discardSettings(); }}>
      <div className="sheet__box">
        <header className="sheet__head"><h2>Configure scoring</h2><button className="icon-btn" type="button" aria-label="Close scoring settings" onClick={discardSettings}><Icon name="x" /></button></header>
        <div className="sheet__body">
          <section aria-labelledby="score-weights-title">
            <div className="card__head"><h3 className="card__title" id="score-weights-title">Sub-score weights</h3></div>
            <p className="card__sub">Score = (fit × {draftSettings.weights.fit}%) + (intent × {draftSettings.weights.intent}%) + (engagement × {draftSettings.weights.engagement}%)</p>
            {WEIGHT_DETAILS.map(({ key, label, description }) => <label className="field" key={key}>
              <span className="label"><span>{label}</span><b>{draftSettings.weights[key]}%</b></span>
              <input className="lead-score-range" type="range" min="0" max="100" step="1" value={draftSettings.weights[key]} aria-label={`${label} weight`} aria-valuetext={`${draftSettings.weights[key]} percent`} onChange={(event) => updateWeight(key, Number(event.target.value))} />
              <small className="card__sub">{description}</small>
            </label>)}
          </section>

          <section className="card" aria-labelledby="score-cutoffs-title">
            <div className="card__head"><h3 className="card__title" id="score-cutoffs-title">Score cut-offs</h3></div>
            <div className="prd-form">
              <label className="field"><span className="label">Warm starts at</span><input className="input" type="number" step="1" min="0" max={draftSettings.hotCutoff - 1} value={draftSettings.warmCutoff} onChange={(event) => updateWarmCutoff(Number(event.target.value))} /></label>
              <label className="field"><span className="label">Hot starts at</span><input className="input" type="number" step="1" min={draftSettings.warmCutoff + 1} max="100" value={draftSettings.hotCutoff} onChange={(event) => updateHotCutoff(Number(event.target.value))} /></label>
            </div>
            <div className="chips" aria-label="Score labels"><span className="pill pill--blue">Cold</span><span className="pill pill--amber">Warm</span><span className="pill pill--coral">Hot</span></div>
          </section>

          <section className="card" aria-labelledby="score-distribution-title">
            <div className="card__head"><h3 className="card__title" id="score-distribution-title">Score distribution</h3><span className="card__sub">{leads.length} leads</span></div>
            <ol className="an-funnel">{distribution.map((band) => <li key={band.label}><div className="an-fstep"><div className="an-fstep__top"><span className="an-fstep__name">{band.label}</span><b>{band.count}</b><span className="an-fstep__pct">{leads.length ? `${Math.round(band.count / leads.length * 100)}%` : "0%"}</span></div><div className="an-fstep__track" role="img" aria-label={`${band.label}: ${band.count} leads`}><span className="an-fstep__fill" style={{ transform: `scaleX(${band.count / maxBandCount})` }} /></div></div></li>)}</ol>
          </section>

          <p className="card__sub" aria-live="polite">{previewCount} {previewCount === 1 ? "lead changes" : "leads change"} label with these settings</p>
        </div>
        <footer className="sheet__foot"><button className="btn" type="button" onClick={discardSettings}>Reset</button><button className="btn" type="button" onClick={() => setDraftSettings(DEFAULT_LEAD_SCORING)}>Defaults</button><button className="btn btn--primary" type="button" onClick={saveSettings}>Save</button></footer>
      </div>
    </dialog>

    {notice && <div className="toasts" aria-live="polite"><div className="toast" role="status"><span className="toast__ico"><Icon name="check" /></span><span>{notice}</span></div></div>}
  </div>;
}
