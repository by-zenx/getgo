export type AutomationStepKind = "trigger" | "wait" | "email" | "condition" | "tag" | "task";
export type AutomationFilter = "all" | "active" | "paused";

export interface AutomationStep {
  kind: AutomationStepKind;
  label: string;
}

export interface AutomationRun {
  who: string;
  hue: number;
  what: string;
  tone: "mint" | "blue" | "amber" | "gray";
  at: number;
}

export interface AutomationRecord {
  id: string;
  name: string;
  desc: string;
  enabled: boolean;
  runs30: number;
  conv: number;
  edited: number;
  hue: number;
  steps: AutomationStep[];
  history: AutomationRun[];
}

export const AUTOMATION_STORAGE_KEY = "corbel:automations";
const NOW = Date.UTC(2026, 9, 26, 12);
const DAY = 24 * 60 * 60 * 1000;

export const AUTOMATION_STEP_TYPES: Record<AutomationStepKind, { name: string; icon: string; hue: number; defaultLabel: string; hint: string }> = {
  trigger: { name: "Trigger", icon: "zap", hue: 208, defaultLabel: "When something happens", hint: "Starts this workflow" },
  wait: { name: "Wait", icon: "clock", hue: 38, defaultLabel: "Wait 1 day", hint: "Pause before the next step" },
  email: { name: "Email", icon: "mail", hue: 196, defaultLabel: "Send an email", hint: "Send a message from your templates" },
  condition: { name: "Condition", icon: "filter", hue: 195, defaultLabel: "Opened the last email?", hint: "Only continue when this is true" },
  tag: { name: "Tag", icon: "tag", hue: 328, defaultLabel: "Tag customer engaged", hint: "Add a tag to the customer" },
  task: { name: "Task", icon: "check", hue: 152, defaultLabel: "Create a task for the team", hint: "Assign a to-do to a teammate" },
};

export const AUTOMATION_ADDABLE_STEPS: AutomationStepKind[] = ["wait", "email", "condition", "tag", "task"];

export const AUTOMATION_TEMPLATES: { name: string; desc: string; hue: number; steps: AutomationStep[] }[] = [
  { name: "Post-purchase thank-you", desc: "Thank first-time buyers, then send a care guide.", hue: 208, steps: [{ kind: "trigger", label: "Order is paid" }, { kind: "wait", label: "Wait 2 days" }, { kind: "email", label: "Send Thank you for your order" }, { kind: "wait", label: "Wait 14 days" }, { kind: "email", label: "Send a care guide for their pieces" }] },
  { name: "Win-back after 90 days", desc: "Bring back customers who haven’t ordered in a while.", hue: 195, steps: [{ kind: "trigger", label: "No order in 90 days" }, { kind: "email", label: "Send We saved you a seat with 15% off" }, { kind: "wait", label: "Wait 5 days" }, { kind: "condition", label: "Opened but didn’t buy?" }, { kind: "email", label: "Send a last reminder" }, { kind: "tag", label: "Tag customer lapsed" }] },
  { name: "Back-in-stock alert", desc: "Tell the waitlist the moment a product returns.", hue: 196, steps: [{ kind: "trigger", label: "Product is back in stock" }, { kind: "condition", label: "Customer is on the waitlist?" }, { kind: "email", label: "Send It’s back" }, { kind: "tag", label: "Tag customer waitlist buyer" }] },
  { name: "Birthday discount", desc: "A 20% code the week of their birthday.", hue: 328, steps: [{ kind: "trigger", label: "Birthday is in 7 days" }, { kind: "email", label: "Send a birthday code, 20% off" }, { kind: "wait", label: "Wait 6 days" }, { kind: "condition", label: "Code not used yet?" }, { kind: "email", label: "Send Your gift ends tomorrow" }] },
];

function history(who: string, hue: number, what: string, tone: AutomationRun["tone"], minutesAgo: number): AutomationRun {
  return { who, hue, what, tone, at: NOW - minutesAgo * 60 * 1000 };
}

const FIXTURES: AutomationRecord[] = [
  { id: "a1", name: "Abandoned cart", desc: "Remind shoppers who leave items in their cart.", enabled: true, runs30: 1284, conv: 0.142, edited: NOW - 3 * DAY, hue: 208, steps: [{ kind: "trigger", label: "Cart abandoned for 1 hour" }, { kind: "email", label: "Send Still thinking it over?" }, { kind: "wait", label: "Wait 1 day" }, { kind: "condition", label: "Still not purchased?" }, { kind: "email", label: "Send 10% code, expires in 48 h" }], history: [history("Sofia Bianchi", 181, "Recovered order", "mint", 12), history("Elena Marsh", 330, "Entered flow", "blue", 68), history("Maya Chen", 206, "Recovered order", "mint", 190), history("Alex Morgan", 42, "Email sent", "blue", 430)] },
  { id: "a2", name: "Welcome series", desc: "Three emails over a week for new subscribers.", enabled: true, runs30: 940, conv: 0.087, edited: NOW - 12 * DAY, hue: 195, steps: [{ kind: "trigger", label: "Subscribes to the newsletter" }, { kind: "email", label: "Send Welcome to Corbel" }, { kind: "wait", label: "Wait 3 days" }, { kind: "email", label: "Send How we make things" }, { kind: "wait", label: "Wait 4 days" }, { kind: "email", label: "Send best-sellers" }], history: [history("Sofia Bianchi", 181, "Email sent", "blue", 35), history("Ravi Kapoor", 60, "Entered flow", "blue", 145), history("Jules Carter", 25, "Converted", "mint", 310)] },
  { id: "a3", name: "Low stock alert", desc: "Ping fulfilment and raise a purchase task.", enabled: true, runs30: 23, conv: 1, edited: NOW - 30 * DAY, hue: 152, steps: [{ kind: "trigger", label: "Stock falls below reorder point" }, { kind: "task", label: "Create task for Leo Tanaka" }, { kind: "tag", label: "Tag product reorder" }], history: [history("Waffle Bath Towel", 190, "Task created", "mint", 480), history("Copper Watering Can", 25, "Task created", "mint", 3200)] },
  { id: "a4", name: "VIP thank-you", desc: "A handwritten-style note after a 5th order.", enabled: false, runs30: 0, conv: 0, edited: NOW - 45 * DAY, hue: 328, steps: [{ kind: "trigger", label: "Places 5th order" }, { kind: "tag", label: "Tag customer VIP" }, { kind: "email", label: "Send thank-you note" }], history: [] },
  { id: "a5", name: "Review request", desc: "Ask for a review a week after delivery.", enabled: true, runs30: 512, conv: 0.214, edited: NOW - 8 * DAY, hue: 45, steps: [{ kind: "trigger", label: "Order delivered" }, { kind: "wait", label: "Wait 7 days" }, { kind: "email", label: "Send How is it going?" }], history: [history("Oliver Grant", 45, "Email sent", "blue", 60), history("Wren & Field Cafe", 150, "Review received", "mint", 1050)] },
];

export function createInitialAutomations() {
  return FIXTURES.map((automation) => ({ ...automation, steps: automation.steps.map((step) => ({ ...step })), history: automation.history.map((run) => ({ ...run })) }));
}

export function automationConversions(automation: AutomationRecord) {
  return automation.steps.some((step) => step.kind === "email") ? Math.round(automation.runs30 * automation.conv) : 0;
}

export function automationRevenue(automation: AutomationRecord) {
  return automationConversions(automation) * 71;
}
