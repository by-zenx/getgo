export type CampaignStatus = "sent" | "scheduled" | "draft";

export interface EmailCampaign {
  id: string;
  name: string;
  subject: string;
  preview: string;
  status: CampaignStatus;
  audience: string;
  recipients: number;
  at: number;
  opens: number;
  clicks: number;
  revenue: number;
  hue: number;
}

export const EMAIL_AUDIENCES = [
  { name: "All subscribers", count: 18760 },
  { name: "VIP customers", count: 612 },
  { name: "New subscribers", count: 940 },
  { name: "Support plan customers", count: 3480 },
  { name: "Waitlist", count: 1260 },
] as const;

const FIXTURE_NOW = Date.UTC(2026, 9, 26, 12);
const DAY = 24 * 60 * 60 * 1000;
const atMorningUtc = (daysFromNow: number) => FIXTURE_NOW + daysFromNow * DAY - 3 * 60 * 60;

const FIXTURES: EmailCampaign[] = [
  { id: "e1", name: "Pipeline check-in", subject: "Keep every opportunity moving", preview: "A practical guide to clearer stages and timely follow-ups.", status: "sent", audience: "All subscribers", recipients: 18420, at: atMorningUtc(-6), opens: 0.468, clicks: 0.071, revenue: 12840, hue: 30 },
  { id: "e2", name: "New team plan", subject: "Meet Rapport CRM — Team", preview: "A shared view of contacts, conversations and deals.", status: "sent", audience: "Waitlist", recipients: 1260, at: atMorningUtc(-13), opens: 0.712, clicks: 0.244, revenue: 6720, hue: 210 },
  { id: "e3", name: "Welcome series #1", subject: "Welcome to Corbel", preview: "A quick start guide to your customer workspace.", status: "sent", audience: "New subscribers", recipients: 940, at: atMorningUtc(-2), opens: 0.583, clicks: 0.129, revenue: 2310, hue: 160 },
  { id: "e4", name: "Sales team playbook", subject: "A simpler rhythm for your sales team", preview: "Practical habits for stronger customer follow-through.", status: "scheduled", audience: "All subscribers", recipients: 18760, at: atMorningUtc(9), opens: 0, clicks: 0, revenue: 0, hue: 350 },
  { id: "e5", name: "VIP early access", subject: "You get first access", preview: "See the latest tools and training for your team.", status: "scheduled", audience: "VIP customers", recipients: 612, at: atMorningUtc(3), opens: 0, clicks: 0, revenue: 0, hue: 167 },
  { id: "e6", name: "Support plan update", subject: "Support that keeps work moving", preview: "", status: "draft", audience: "Support plan customers", recipients: 3480, at: atMorningUtc(-1), opens: 0, clicks: 0, revenue: 0, hue: 190 },
];

export function createInitialEmailCampaigns() {
  return FIXTURES.map((campaign) => ({ ...campaign }));
}
