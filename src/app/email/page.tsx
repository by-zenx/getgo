import { redirect } from "next/navigation";

export default function LegacyEmailPage() {
  redirect("/leads/email");
}
