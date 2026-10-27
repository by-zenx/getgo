import Link from "next/link";
import { Icon } from "@/components/icons/svg-sprite";

export function SectionPlaceholder({
  viewName,
  title,
  description,
  actionText = "Back to Dashboard",
  actionHref = "/dashboard",
  icon = "grid",
}: {
  viewName: string;
  title: string;
  description: string;
  actionText?: string;
  actionHref?: string;
  icon?: string;
}) {
  return (
    <div data-view={viewName}>
      <section className="card" style={{ padding: "40px 28px", textAlign: "center" }}>
        <div
          style={{
            display: "inline-grid",
            placeItems: "center",
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            background: "var(--well)",
            color: "var(--primary)",
            margin: "0 auto 16px",
          }}
        >
          <Icon name={icon} />
        </div>
        <h2 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "8px" }}>
          {title}
        </h2>
        <p
          style={{
            color: "var(--muted)",
            fontSize: "14px",
            maxWidth: "460px",
            margin: "0 auto 24px",
            lineHeight: 1.5,
          }}
        >
          {description}
        </p>
        <Link className="btn btn--primary" href={actionHref}>
          {actionText}
        </Link>
      </section>
    </div>
  );
}
