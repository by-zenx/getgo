export const PIPELINE_TODAY = Date.UTC(2026, 9, 26, 12);
export const PIPELINE_BOARD_STORAGE_KEY = "corbel:pipeline:board";
export const PIPELINE_QUOTA_STORAGE_KEY = "corbel:pipeline:quotas";

export const PIPELINE_STAGES = ["New lead", "Contacted", "Qualified", "Proposal", "Negotiation", "Closing"] as const;
export type PipelineStage = typeof PIPELINE_STAGES[number];
export type PipelineStageHistory = Partial<Record<PipelineStage, string>>;
export type PipelineCloseState = "won" | "lost" | null;

export interface PipelineDealRecord {
  id: string;
  name: string;
  company: string;
  owner: string;
  team?: string[];
  source: string;
  score: number;
  subScores: { fit: number; intent: number; engagement: number };
  value: number;
  expectedClose: string;
  stage: PipelineStage;
  closedAs: PipelineCloseState;
  closedAt: number | null;
  previousStage: PipelineStage | null;
  createdAt: string;
  stageHistory: PipelineStageHistory;
  lostReason?: string;
  handoffId?: string;
}

export interface PipelineHistoricalDeal {
  id: string;
  name: string;
  company: string;
  owner: string;
  source: string;
  value: number;
  createdAt: string;
  closedAt: string;
  closedAs: "won" | "lost";
  stageHistory: PipelineStageHistory;
  lostReason?: string;
}

export const DEFAULT_QUARTERLY_QUOTAS: Record<string, number> = {
  "Mara Reyes": 60000,
  "Jonah Okafor": 65000,
  "Ana Petrova": 55000,
  "Leo Tanaka": 60000,
  "Priya Shah": 65000,
  "Daniel Kim": 45000,
};

const names = [
  "Celia Ward", "Owen Parker", "Mina Shah", "Elliot Brooks", "Rosa Chen", "Nikhil Rao", "Maya Ellis", "Theo Martin", "Isabel Cruz", "Evan Ross",
  "Lena Ford", "Ari Bennett", "Nora James", "Kai Morgan", "Amir Patel", "Sana Reed", "Jules Kim", "Milo Grant", "Talia Green", "Ezra Cole",
];
const companies = ["The Linen Room", "Juniper Labs", "Kumo Retail", "Northwind Studio", "Wren & Field", "Aldercrest Hotels", "Brooks Consulting", "Brightpath Group"];
const owners = Object.keys(DEFAULT_QUARTERLY_QUOTAS);
const sources = ["Website", "Instagram", "Email", "Referral", "Partner", "Phone"];
const lostReasons = ["Price", "Competitor", "No response", "Bad timing", "No budget", "Not given"];
const wonIndices = new Set([0, 1, 3, 7, 9, 10, 13, 15, 18, 20, 24, 27, 31, 35, 37]);

function dateString(time: number) {
  return new Date(time).toISOString().slice(0, 10);
}

function makeStageHistory(createdAt: number, closedAt: number, finalStage: number): PipelineStageHistory {
  const history: PipelineStageHistory = {};
  const span = Math.max(1, closedAt - createdAt);
  PIPELINE_STAGES.slice(0, finalStage + 1).forEach((stage, index) => {
    history[stage] = dateString(createdAt + Math.floor(span * index / (finalStage + 1)));
  });
  return history;
}

export const PIPELINE_HISTORY_DEALS: PipelineHistoricalDeal[] = Array.from({ length: 40 }, (_, index) => {
  const month = 4 + Math.floor(index / 7);
  const day = 2 + (index * 7) % 24;
  const closedAtTime = Date.UTC(2026, month, day, 12);
  const cycleDays = 16 + (index * 13) % 58;
  const createdAtTime = closedAtTime - cycleDays * 24 * 60 * 60 * 1000;
  const closedAs = wonIndices.has(index) ? "won" : "lost";
  const finalStage = closedAs === "won" ? PIPELINE_STAGES.length - 1 : (index * 3) % PIPELINE_STAGES.length;
  return {
    id: `history-${String(index + 1).padStart(2, "0")}`,
    name: names[index % names.length],
    company: companies[(index * 3 + Math.floor(index / 5)) % companies.length],
    owner: owners[(index * 5 + Math.floor(index / 3)) % owners.length],
    source: sources[(index * 2 + Math.floor(index / 3)) % sources.length],
    value: 6800 + ((index * 7919) % 39200),
    createdAt: dateString(createdAtTime),
    closedAt: dateString(closedAtTime),
    closedAs,
    stageHistory: makeStageHistory(createdAtTime, closedAtTime, finalStage),
    ...(closedAs === "lost" ? { lostReason: lostReasons[(index * 5 + Math.floor(index / 4)) % lostReasons.length] } : {}),
  };
});

// Deterministic fallback for direct Insights visits before the Board has written its local copy.
export const PIPELINE_BOARD_FALLBACK: PipelineDealRecord[] = [
  ["Ravi Kapoor","The Linen Room","Mara Reyes","Referral",12400,"2026-11-18","Contacted"],
  ["Elena Marsh","Juniper Labs","Jonah Okafor","Website",24800,"2026-11-26","Qualified"],
  ["Theo Lindqvist","Kumo Retail","Ana Petrova","Instagram",18800,"2026-12-04","Proposal"],
  ["Sofia Bianchi","Northwind Studio","Leo Tanaka","Email",36200,"2026-11-30","Negotiation"],
  ["Marcus Hale","Wren & Field","Priya Shah","Partner",21600,"2026-12-12","Closing"],
  ["Hana Sato","Aldercrest Hotels","Mara Reyes","Website",9600,"2026-12-20","New lead"],
  ["Oliver Grant","Brooks Consulting","Jonah Okafor","Email",14200,"2026-12-08","Qualified"],
  ["Ines Duarte","Brightpath Group","Ana Petrova","Referral",7800,"2027-01-15","Contacted"],
  ["Kofi Mensah","Kumo Retail","Leo Tanaka","Website",42800,"2026-11-12","Closing"],
  ["Greta Novak","Juniper Labs","Priya Shah","Instagram",11500,"2026-12-21","Proposal"],
  ["Clara Jensen","The Linen Room","Mara Reyes","Website",27500,"2026-12-02","Negotiation"],
  ["Amara Okoye","Northwind Studio","Jonah Okafor","Referral",17400,"2026-12-14","New lead"],
].map(([name,company,owner,source,value,expectedClose,stage],index) => {
  const createdAt = dateString(PIPELINE_TODAY - (35 + index * 3) * 86400000);
  const stageIndex = PIPELINE_STAGES.indexOf(stage as PipelineStage);
  const stageHistory: PipelineStageHistory = {};
  PIPELINE_STAGES.slice(0,stageIndex+1).forEach((stageName,step) => { stageHistory[stageName] = dateString(Date.parse(`${createdAt}T12:00:00Z`) + step * 7 * 86400000); });
  return { id:`d${index+1}`,name,company,owner,source,score:60,subScores:{fit:60,intent:60,engagement:60},value,expectedClose,stage:stage as PipelineStage,closedAs:null,closedAt:null,previousStage:null,createdAt,stageHistory } as PipelineDealRecord;
});
