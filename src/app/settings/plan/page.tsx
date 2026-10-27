import Link from "next/link";
import { PageHeading } from "@/components/shell/page-heading";
import { Icon } from "@/components/icons/svg-sprite";

export default function PlanPage() {
  return (
    <>
      <PageHeading title="Upgrade to Corbel Plus" />

      <div data-view="settings">
        <section
          className="card"
          style={{ maxWidth: "680px", margin: "0 auto", textAlign: "center", padding: "40px 24px" }}
        >
          <div
            style={{
              display: "inline-grid",
              placeItems: "center",
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              background: "var(--well)",
              color: "var(--primary)",
              margin: "0 auto 18px",
            }}
          >
            <Icon name="spark" />
          </div>

          <h2 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "8px" }}>
            Unlock Predictive Forecasting & Unlimited Boards
          </h2>

          <p
            style={{
              color: "var(--muted)",
              fontSize: "14px",
              lineHeight: 1.6,
              maxWidth: "480px",
              margin: "0 auto 28px",
            }}
          >
            Get multi-location sales reconciliation, inventory forecasts across seasons, and unlimited team seats with Corbel Plus.
          </p>

          <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
            <Link className="btn btn--primary" href="/dashboard">
              Start 14-day free trial
            </Link>
            <Link className="btn btn--ghost" href="/settings">
              Back to settings
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
