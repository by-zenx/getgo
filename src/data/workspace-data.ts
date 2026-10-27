export type WorkspaceColumnId = "todo" | "doing" | "review" | "done";
export type WorkspaceTag = "Design" | "Photo" | "Copy" | "Ops" | "Buying" | "Store";

export interface WorkspaceChecklistItem {
  label: string;
  done: boolean;
}

export interface WorkspaceComment {
  id: string;
  who: string;
  text: string;
  at: number;
}

export interface WorkspaceTask {
  id: string;
  title: string;
  tag: WorkspaceTag;
  who: string;
  due: number;
  checklist: WorkspaceChecklistItem[];
  comments: WorkspaceComment[];
}

export interface WorkspaceColumn {
  id: WorkspaceColumnId;
  name: string;
  cards: WorkspaceTask[];
}

export interface WorkspaceBoard {
  id: string;
  name: string;
  color: string;
  description: string;
  due: number;
  columns: WorkspaceColumn[];
}

export const WORKSPACE_MEMBERS = [
  { initials: "MR", name: "Mara Reyes", hue: 206 },
  { initials: "JO", name: "Jonah Okafor", hue: 162 },
  { initials: "AP", name: "Ana Petrova", hue: 12 },
  { initials: "LT", name: "Leo Tanaka", hue: 181 },
  { initials: "PS", name: "Priya Shah", hue: 330 },
] as const;

export const WORKSPACE_TAGS: WorkspaceTag[] = ["Design", "Photo", "Copy", "Ops", "Buying", "Store"];

export const WORKSPACE_CHECKLISTS: Record<WorkspaceTag, string[]> = {
  Copy: ["Outline the key points", "Draft the first two stories", "Draft the remaining stories", "Check sizes and care notes", "Edit for tone", "Get sign-off from Mara", "Load into the product pages", "Proofread on a phone"],
  Design: ["Gather references", "Sketch two directions", "Pick a direction", "Build the desktop layout", "Build the phone layout", "Review with the team", "Hand over final files", "Check the printed proof"],
  Photo: ["Book the studio", "Prep props and styling", "Shoot the hero images", "Shoot the detail shots", "Pick the selects", "Retouch and export"],
  Ops: ["Agree the plan", "Book the time", "Brief the team", "Do the work", "Check against the list", "Write up notes"],
  Buying: ["Confirm quantities", "Request a quote", "Approve the quote", "Place the order", "Confirm the delivery date"],
  Store: ["Measure the space", "Draft a plan", "Order materials", "Brief the shop staff", "Set it up", "Send photos to the team"],
};

const FIXTURE_TIME = Date.UTC(2026, 9, 26, 12);
const DAY = 24 * 60 * 60 * 1000;
const COMMENT_TEXT = [
  "Pushed this to tomorrow so the samples can arrive first.",
  "Looks good to me. One small note on the second line.",
  "I can pick this up on Thursday afternoon.",
  "Supplier confirmed by email, copy is in the shared folder.",
  "Can we keep this under the budget we agreed?",
  "Added two options. Let me know which you prefer.",
  "The Main St team is happy with the timing.",
  "Moved the date after talking to Leo.",
  "Please check the sizes before we print anything.",
  "My part is done. Over to you.",
];

function makeTask(
  id: string,
  title: string,
  tag: WorkspaceTag,
  who: string,
  dueDays: number,
  done: number,
  total: number,
  comments: number,
  now: number,
): WorkspaceTask {
  const checklist = WORKSPACE_CHECKLISTS[tag].slice(0, total).map((label, index) => ({ label, done: index < done }));
  const seed = [...id].reduce((sum, char) => sum * 31 + char.charCodeAt(0) >>> 0, 7);
  return {
    id,
    title,
    tag,
    who,
    due: now + dueDays * DAY,
    checklist,
    comments: Array.from({ length: comments }, (_, index) => ({
      id: `${id}-comment-${index}`,
      who: WORKSPACE_MEMBERS[(seed + index * 2) % WORKSPACE_MEMBERS.length].initials,
      text: COMMENT_TEXT[(seed + index * 3) % COMMENT_TEXT.length],
      at: now - (comments - index) * (5 + seed % 7) * 60 * 60 * 1000,
    })),
  };
}

export function createInitialWorkspaceBoards(now = FIXTURE_TIME): WorkspaceBoard[] {
  const task = (...args: [string, string, WorkspaceTag, string, number, number, number, number]) => makeTask(...args, now);
  return [
    {
      id: "spring-launch",
      name: "Spring Launch",
      color: "var(--c1)",
      description: "Bath & garden collection — online and both shops.",
      due: now + 34 * DAY,
      columns: [
        { id: "todo", name: "To do", cards: [
          task("k1", "Write product stories for 8 new pieces", "Copy", "AP", 12, 0, 8, 2),
          task("k2", "Order sage towel colourway", "Buying", "JO", 6, 0, 1, 0),
          task("k3", "Plan window display for Main St shop", "Store", "JO", 20, 1, 5, 4),
        ] },
        { id: "doing", name: "In progress", cards: [
          task("k4", "Photo shoot: bath mat + throws", "Photo", "MR", 3, 2, 4, 6),
          task("k5", "Landing page design", "Design", "AP", 9, 3, 6, 3),
        ] },
        { id: "review", name: "Review", cards: [
          task("k6", "Packaging inserts, print proof", "Design", "MR", 1, 3, 3, 1),
        ] },
        { id: "done", name: "Done", cards: [
          task("k7", "Confirm launch date with suppliers", "Ops", "LT", -4, 2, 2, 0),
          task("k8", "Pick hero product", "Buying", "MR", -9, 1, 1, 5),
        ] },
      ],
    },
    {
      id: "retail-plan",
      name: "Retail Plan",
      color: "var(--c4)",
      description: "Q4 plan for the Main St and Harbor shops.",
      due: now + 61 * DAY,
      columns: [
        { id: "todo", name: "To do", cards: [
          task("r1", "Hire two seasonal staff", "Store", "JO", 14, 0, 3, 2),
          task("r2", "Holiday gift-wrap station", "Store", "JO", 25, 0, 4, 0),
        ] },
        { id: "doing", name: "In progress", cards: [
          task("r3", "New till layout, Harbor shop", "Ops", "LT", 5, 1, 3, 1),
          task("r4", "Loyalty card in Stockroom POS", "Ops", "MR", 11, 2, 5, 3),
          task("r5", "Reorder candles for December", "Buying", "LT", 2, 0, 1, 0),
        ] },
        { id: "review", name: "Review", cards: [] },
        { id: "done", name: "Done", cards: [
          task("r6", "Q3 stock count", "Ops", "LT", -12, 4, 4, 2),
        ] },
      ],
    },
  ];
}
