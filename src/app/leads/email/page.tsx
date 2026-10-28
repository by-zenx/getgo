import type { Metadata } from "next";
import { EmailView } from "@/components/email/email-view";
import { PageHeading } from "@/components/shell/page-heading";

export const metadata: Metadata = { title: "Leads email | Corbel" };

export default function LeadsEmailPage() {
  return <>
    <PageHeading title="Leads" />
    <EmailView />
  </>;
}
