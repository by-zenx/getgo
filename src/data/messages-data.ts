export type MessageChannel = "chat" | "email" | "instagram";
export type MessageSender = "them" | "me";

export interface ConversationMessage {
  id: string;
  from: MessageSender;
  text: string;
  at: number;
  by?: string;
}

export interface MessageThread {
  id: string;
  customerId: string;
  subject: string;
  channel: MessageChannel;
  unread: boolean;
  starred: boolean;
  done: boolean;
  orderId?: string;
  msgs: ConversationMessage[];
}

export interface MessageContact {
  id: string;
  name: string;
  city: string;
  email: string;
  phone: string;
  hue: number;
  channel: "online" | "store";
  joined: number;
  tags: string[];
  note?: string;
}

const FIXTURE_NOW = Date.UTC(2026, 9, 26, 12);
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

export const MESSAGE_CONTACTS: MessageContact[] = [
  { id: "c1", name: "Elena Marsh", city: "Portland, OR", email: "elena@northwind.test", phone: "+1 (503) 555-0141", hue: 330, channel: "online", joined: FIXTURE_NOW - 640 * DAY, tags: ["VIP", "Subscriber"], note: "Prefers recycled packaging. Gifts often; offer a gift note." },
  { id: "c4", name: "Wren & Field Café", city: "Denver, CO", email: "orders@wrenandfield.test", phone: "+1 (720) 555-0177", hue: 150, channel: "online", joined: FIXTURE_NOW - 520 * DAY, tags: ["Wholesale"], note: "Net-30 terms. Team plan covers two café locations." },
  { id: "c5", name: "Sofia Bianchi", city: "Brooklyn, NY", email: "sofia@northwind.test", phone: "+1 (718) 555-0108", hue: 181, channel: "online", joined: FIXTURE_NOW - 9 * DAY, tags: ["New"] },
  { id: "c8", name: "Oliver Grant", city: "Boston, MA", email: "oliver@northwind.test", phone: "+1 (617) 555-0116", hue: 45, channel: "store", joined: FIXTURE_NOW - 150 * DAY, tags: [] },
  { id: "c12", name: "The Linen Room", city: "Charleston, SC", email: "buying@linenroom.test", phone: "+1 (843) 555-0125", hue: 209, channel: "online", joined: FIXTURE_NOW - 860 * DAY, tags: ["Wholesale", "VIP"], note: "Boutique CRM account. Reviews permissions every six weeks." },
  { id: "c13", name: "Ravi Kapoor", city: "Phoenix, AZ", email: "ravi@northwind.test", phone: "+1 (602) 555-0150", hue: 60, channel: "online", joined: FIXTURE_NOW - 220 * DAY, tags: ["Subscriber"] },
];

const SEEDED_THREADS: MessageThread[] = [
  {
    id: "t1", customerId: "c5", subject: "Where is my order?", channel: "chat", unread: false, starred: false, done: false,
    msgs: [
      { id: "t1m0", from: "them", text: "Hi! I signed up for the Team plan on Monday — when will our workspace be ready?", at: FIXTURE_NOW - 26 * MINUTE },
      { id: "t1m1", from: "me", text: "Hi Sofia, let me check that for you now.", at: FIXTURE_NOW - 18 * MINUTE, by: "Priya Shah" },
      { id: "t1m2", from: "them", text: "Thank you! It’s a birthday present for Saturday.", at: FIXTURE_NOW - 8 * MINUTE },
    ],
  },
  {
    id: "t2", customerId: "c4", subject: "Reorder for both cafés", channel: "email", unread: true, starred: false, done: false,
    msgs: [{ id: "t2m0", from: "them", text: "Morning — could we add 12 more seats to our plan on the same terms? We’ll need access by the 28th.", at: FIXTURE_NOW - 38 * MINUTE }],
  },
  {
    id: "t3", customerId: "c1", subject: "Gift wrapping question", channel: "instagram", unread: true, starred: false, done: false,
    msgs: [
      { id: "t3m0", from: "them", text: "Can you tell me more about the annual support plan for our team?", at: FIXTURE_NOW - 102 * MINUTE },
      { id: "t3m1", from: "me", text: "We do! We can include a tailored onboarding checklist with your order.", at: FIXTURE_NOW - 98 * MINUTE, by: "Priya Shah" },
      { id: "t3m2", from: "them", text: "Perfect. Can I add a handwritten note too?", at: FIXTURE_NOW - 95 * MINUTE },
    ],
  },
  {
    id: "t4", customerId: "c12", subject: "Team access for spring", channel: "email", unread: false, starred: true, done: false,
    msgs: [
      { id: "t4m0", from: "them", text: "Will the new team training be available this spring? Our managers keep asking.", at: FIXTURE_NOW - 300 * MINUTE },
      { id: "t4m1", from: "me", text: "Sage lands in March — I’ll put 40 aside for you.", at: FIXTURE_NOW - 274 * MINUTE, by: "Priya Shah" },
      { id: "t4m2", from: "them", text: "Lovely, thank you Priya.", at: FIXTURE_NOW - 248 * MINUTE },
    ],
  },
  {
    id: "t5", customerId: "c8", subject: "CRM workspace setup", channel: "chat", unread: false, starred: false, done: false,
    msgs: [
      { id: "t5m0", from: "them", text: "I imported some duplicate contacts by mistake. Can I clean those up safely?", at: FIXTURE_NOW - 1500 * MINUTE },
      { id: "t5m1", from: "me", text: "Not at all — scrub, dry on the hob and oil it thinly. Here is our 2-minute guide.", at: FIXTURE_NOW - 1474 * MINUTE, by: "Priya Shah" },
    ],
  },
  {
    id: "t6", customerId: "c13", subject: "Discount code not working", channel: "email", unread: false, starred: false, done: true,
    msgs: [
      { id: "t6m0", from: "them", text: "WELCOME10 says it has expired?", at: FIXTURE_NOW - 2900 * MINUTE },
      { id: "t6m1", from: "me", text: "Sorry about that! I’ve refunded 10% to your card — it shows in 3 to 5 days.", at: FIXTURE_NOW - 2874 * MINUTE, by: "Priya Shah" },
    ],
  },
];

export function createInitialMessageThreads() {
  return SEEDED_THREADS.map((thread) => ({ ...thread, msgs: thread.msgs.map((message) => ({ ...message })) }));
}

export const MESSAGE_QUICK_REPLIES = ["Thanks for checking", "I’ll look into this", "Happy to help"];
