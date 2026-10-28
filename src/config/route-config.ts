export interface TabItem {
  href: string;
  label: string;
  route: string;
  count?: number | string;
  groupedRoutes?: string[];
}

export const MAIN_TABS: TabItem[] = [
  { href: "/dashboard", label: "Dashboard", route: "dashboard" },
  { href: "/orders", label: "Orders", route: "orders", count: 3 },
  { href: "/catalog", label: "Catalog", route: "catalog" },
  { href: "/customers", label: "Customers", route: "customers", groupedRoutes: ["feedback"] },
  { href: "/leads", label: "Leads", route: "leads", count: 2, groupedRoutes: ["email", "scoring"] },
  { href: "/analytics", label: "Analytics", route: "analytics" },
  { href: "/automations", label: "Automations", route: "automations", groupedRoutes: ["integrations"] },
];

export interface SubtabConfig {
  key: string;
  items: { href: string; label: string; key: string; exact?: boolean }[];
}

export const SUBTAB_GROUPS: Record<string, SubtabConfig> = {
  customers: {
    key: "customers",
    items: [
      { href: "/customers", label: "Customers", key: "customers" },
      { href: "/feedback", label: "Feedback", key: "feedback" },
    ],
  },
  feedback: {
    key: "customers",
    items: [
      { href: "/customers", label: "Customers", key: "customers" },
      { href: "/feedback", label: "Feedback", key: "feedback" },
    ],
  },
  leads: {
    key: "leads",
    items: [
      { href: "/leads", label: "Inbox", key: "leads", exact: true },
      { href: "/leads/email", label: "Email", key: "email" },
      { href: "/leads/scoring", label: "Scoring", key: "scoring" },
    ],
  },
  email: {
    key: "leads",
    items: [
      { href: "/leads", label: "Inbox", key: "leads", exact: true },
      { href: "/leads/email", label: "Email", key: "email" },
      { href: "/leads/scoring", label: "Scoring", key: "scoring" },
    ],
  },
  scoring: {
    key: "leads",
    items: [
      { href: "/leads", label: "Inbox", key: "leads", exact: true },
      { href: "/leads/email", label: "Email", key: "email" },
      { href: "/leads/scoring", label: "Scoring", key: "scoring" },
    ],
  },
  automations: {
    key: "automations",
    items: [
      { href: "/automations", label: "Automations", key: "automations" },
      { href: "/integrations", label: "Integrations", key: "integrations" },
    ],
  },
  integrations: {
    key: "automations",
    items: [
      { href: "/automations", label: "Automations", key: "automations" },
      { href: "/integrations", label: "Integrations", key: "integrations" },
    ],
  },
  workspace: {
    key: "workspace",
    items: [
      { href: "/workspace/spring-launch", label: "Spring Launch", key: "spring-launch" },
      { href: "/workspace/retail-plan", label: "Retail Plan", key: "retail-plan" },
    ],
  },
};
