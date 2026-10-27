"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Icon } from "@/components/icons/svg-sprite";
import {
  DASHBOARD_KPIS,
  MONTHLY_REVENUE,
  HEATMAP_DAYS,
  HEATMAP_PERIODS,
  HEATMAP_GRID,
  DEVICE_VISITS,
} from "@/data/dashboard-data";
import { moveSegmentPill } from "@/lib/segment-motion";

function formatKpiValue(index: number, value: number) {
  if (index < 2) return `$${Math.round(value).toLocaleString("en-US")}`;
  if (index === 2) return Math.round(value).toLocaleString("en-US");
  return `${value.toFixed(2)}%`;
}

export function DashboardView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [channel, setChannel] = useState<"all" | "online" | "store">("all");
  const [activeMonthIndex, setActiveMonthIndex] = useState<number | null>(9); // Oct

  const gaugeArcRef = useRef<SVGPathElement>(null);
  const gaugeKnobRef = useRef<SVGGElement>(null);
  const scoreValueRef = useRef<HTMLElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);
  const ringPctRef = useRef<HTMLElement>(null);
  const sparkLineRef = useRef<SVGPathElement>(null);
  const channelPillRef = useRef<HTMLSpanElement>(null);
  const visitsTotalRef = useRef<HTMLElement>(null);
  const visitsValueRef = useRef({ value: 0 });
  const kpiValueRefs = useRef([{ value: 0 }, { value: 0 }, { value: 0 }, { value: 0 }]);
  const previousChannelRef = useRef<"all" | "online" | "store" | null>(null);

  const channelTargets = {
    all: [18420, 142860, 1284, 3.42],
    online: [11760, 96840, 842, 3.76],
    store: [6660, 46020, 442, 2.81],
  }[channel];
  const revenueFactor = channel === "online" ? 0.68 : channel === "store" ? 0.32 : 1;
  const channelRevenue = MONTHLY_REVENUE.map((item) => ({
    ...item,
    val: Math.round(item.val * revenueFactor),
  }));
  const visitsTotal = channel === "online" ? "32.7K" : channel === "store" ? "15.5K" : "48.2K";

  const N = 31; // total ticks

  useGSAP(
    () => {
      const isReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (isReduced) {
        if (scoreValueRef.current) scoreValueRef.current.textContent = "84";
        if (gaugeArcRef.current) gaugeArcRef.current.style.strokeDasharray = "84 100";
        if (ringRef.current) ringRef.current.style.strokeDasharray = "86 100";
        if (ringPctRef.current) ringPctRef.current.textContent = "86%";
        visitsValueRef.current.value = Number(visitsTotal.replace("K", "")) * 1000;
        if (visitsTotalRef.current) visitsTotalRef.current.textContent = visitsTotal;
        containerRef.current?.querySelectorAll<HTMLElement>(".db-kpi .stat__val").forEach((el, index) => {
          kpiValueRefs.current[index].value = channelTargets[index];
          el.textContent = formatKpiValue(index, channelTargets[index]);
        });
        return;
      }

      // 1. Cards staggered entrance (Corbel xi helper)
      gsap.fromTo(
        ".db > .card",
        { opacity: 0, y: 26, scale: 0.96 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.85,
          ease: "expo.out",
          stagger: 0.08,
          delay: 0.1,
          clearProps: "transform,opacity",
        }
      );

      // 2. KPIs staggered entrance
      gsap.fromTo(
        ".db-kpi",
        { opacity: 0, y: 16 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          ease: "power3.out",
          stagger: 0.05,
          delay: 0.18,
          clearProps: "transform,opacity",
        }
      );

      // 3. Sales Score Gauge animation: score count 0 -> 84 & arc 0 -> 84 & ticks
      const scoreObj = { val: 0 };
      gsap.to(scoreObj, {
        val: 84,
        duration: 1.7,
        delay: 0.35,
        ease: "power3.inOut",
        onUpdate: () => {
          const current = Math.round(scoreObj.val);
          if (scoreValueRef.current) scoreValueRef.current.textContent = String(current);

          if (gaugeArcRef.current) {
            gaugeArcRef.current.style.strokeDasharray = `${scoreObj.val} 100`;
          }

          // Light up gauge tick lines
          const litCount = Math.floor((scoreObj.val / 100) * N);
          const ticks = containerRef.current?.querySelectorAll<SVGLineElement>(".db-ticks line");
          ticks?.forEach((line, idx) => {
            if (idx <= litCount) {
              line.classList.add("is-lit");
            } else {
              line.classList.remove("is-lit");
            }
          });

          // Move knob along semi-circle (radius 90, center (120, 125))
          // angle from PI (left) to 0 (right)
          const angle = Math.PI - (scoreObj.val / 100) * Math.PI;
          const kx = 120 + 90 * Math.cos(angle);
          const ky = 125 - 90 * Math.sin(angle);
          if (gaugeKnobRef.current) {
            gaugeKnobRef.current.setAttribute("transform", `translate(${kx - 30}, ${ky - 125})`);
          }
        },
      });

      // 4. Units progress ring animation
      if (ringRef.current) {
        gsap.fromTo(
          ringRef.current,
          { strokeDasharray: "0 100" },
          {
            strokeDasharray: "86 100",
            duration: 1.4,
            delay: 0.4,
            ease: "power3.inOut",
          }
        );
      }

      // 5. Units percentage text count
      const ringObj = { pct: 0 };
      gsap.to(ringObj, {
        pct: 86,
        duration: 1.4,
        delay: 0.4,
        ease: "power3.inOut",
        onUpdate: () => {
          if (ringPctRef.current) {
            ringPctRef.current.textContent = `${Math.round(ringObj.pct)}%`;
          }
        },
      });

      // 6. Mini equalizer bars entrance
      gsap.fromTo(
        ".db-ef",
        { scaleY: 0, transformOrigin: "bottom" },
        {
          scaleY: 1,
          duration: 0.8,
          delay: 0.45,
          stagger: 0.04,
          ease: "expo.out",
        }
      );

      // 7. Mini bar chart entrance
      gsap.fromTo(
        ".db-mf",
        { scaleY: 0, transformOrigin: "bottom" },
        {
          scaleY: 1,
          duration: 0.7,
          delay: 0.35,
          stagger: 0.06,
          ease: "back.out(1.5)",
        }
      );

      gsap.fromTo(
        ".db-col__fill",
        { scaleY: 0, transformOrigin: "50% 100%" },
        { scaleY: 1, duration: 0.7, ease: "expo.out", stagger: 0.045, delay: 0.25 }
      );
      gsap.fromTo(
        ".db-cell i",
        { opacity: 0, scale: 0.72, transformOrigin: "50% 50%" },
        { opacity: 1, scale: 1, duration: 0.45, ease: "back.out(1.7)", stagger: 0.018, delay: 0.35 }
      );
      const donutSegments = gsap.utils.toArray<SVGCircleElement>(".db-seg");
      donutSegments.forEach((segment, index) => {
        const dash = segment.style.strokeDasharray;
        gsap.fromTo(segment, { strokeDasharray: "0 100", opacity: 0 }, {
          strokeDasharray: dash, opacity: 1, duration: 1.1, delay: index * 0.1, ease: "power3.out",
        });
      });
      const end = Number(visitsTotal.replace("K", "")) * 1000;
      visitsValueRef.current.value = 0;
      if (visitsTotalRef.current) visitsTotalRef.current.textContent = "0.0K";
      gsap.to(visitsValueRef.current, {
        value: end,
        duration: 1.1,
        delay: 0.3,
        ease: "power3.out",
        onUpdate: () => {
          if (visitsTotalRef.current) {
            visitsTotalRef.current.textContent = `${(visitsValueRef.current.value / 1000).toFixed(1)}K`;
          }
        },
      });
    },
    { scope: containerRef }
  );

  useGSAP(() => {
    const isInitial = previousChannelRef.current === null;
    const isReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pill = channelPillRef.current;
    const tabs = containerRef.current?.querySelector<HTMLElement>(".db-bar .seg");
    const active = tabs?.querySelector<HTMLElement>('button[aria-selected="true"]');
    if (!pill || !tabs || !active) return;
    moveSegmentPill(pill, active, isInitial);

    const valueElements = containerRef.current?.querySelectorAll<HTMLElement>(".db-kpi .stat__val");
    valueElements?.forEach((el, index) => {
      const target = channelTargets[index];
      if (isReduced) {
        kpiValueRefs.current[index].value = target;
        el.textContent = formatKpiValue(index, target);
      } else {
        el.textContent = formatKpiValue(index, kpiValueRefs.current[index].value);
        gsap.to(kpiValueRefs.current[index], {
          value: target,
          duration: isInitial ? 1.25 : 0.95,
          delay: isInitial ? index * 0.06 : 0,
          ease: "power3.out",
          overwrite: true,
          onUpdate: () => {
            el.textContent = formatKpiValue(index, kpiValueRefs.current[index].value);
          },
        });
      }
    });

    const channelEnd = Number(visitsTotal.replace("K", "")) * 1000;
    if (isReduced) {
      visitsValueRef.current.value = channelEnd;
      if (visitsTotalRef.current) visitsTotalRef.current.textContent = visitsTotal;
    } else if (!isInitial) {
      if (visitsTotalRef.current) {
        visitsTotalRef.current.textContent = `${(visitsValueRef.current.value / 1000).toFixed(1)}K`;
      }
      gsap.to(visitsValueRef.current, {
        value: channelEnd,
        duration: 0.65,
        ease: "power3.out",
        overwrite: true,
        onUpdate: () => {
          if (visitsTotalRef.current) {
            visitsTotalRef.current.textContent = `${(visitsValueRef.current.value / 1000).toFixed(1)}K`;
          }
        },
      });
    }
    previousChannelRef.current = channel;
  }, { dependencies: [channel], scope: containerRef });

  // Generate 31 ticks along semi-circle
  const gaugeTicks = Array.from({ length: N }, (_, t) => {
    const angle = Math.PI - (t / (N - 1)) * Math.PI;
    const r = t % 5 === 0 ? 113 : 109;
    const x1 = 120 + 104 * Math.cos(angle);
    const y1 = 125 - 104 * Math.sin(angle);
    const x2 = 120 + r * Math.cos(angle);
    const y2 = 125 - r * Math.sin(angle);
    return (
      <line
        key={t}
        x1={x1.toFixed(1)}
        y1={y1.toFixed(1)}
        x2={x2.toFixed(1)}
        y2={y2.toFixed(1)}
      />
    );
  });

  return (
    <div ref={containerRef} data-view="dashboard">
      {/* Top Toolbar */}
      <div className="toolbar db-bar">
        <div className="seg db-channel" role="tablist" aria-label="Sales channel">
          <span ref={channelPillRef} className="seg__pill" aria-hidden="true" />
          <button
            type="button"
            role="tab"
            aria-controls="db-board"
            aria-selected={channel === "all"}
            onClick={() => setChannel("all")}
          >
            Overview
          </button>
          <button
            type="button"
            role="tab"
            aria-controls="db-board"
            aria-selected={channel === "online"}
            onClick={() => setChannel("online")}
          >
            Online
          </button>
          <button
            type="button"
            role="tab"
            aria-controls="db-board"
            aria-selected={channel === "store"}
            onClick={() => setChannel("store")}
          >
            In store
          </button>
        </div>

        <p className="db-asof">
          <Icon name="clock" />
          <span>October 2026, month to date</span>
        </p>

        <div className="toolbar__end">
          <Link className="btn" href="/analytics">
            <Icon name="chart" />
            Full analytics
          </Link>
          <button className="btn btn--dark" type="button">
            <Icon name="download" />
            Export
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="db" id="db-board" role="tabpanel" aria-label="Overview">
        {/* KPI Cards Row */}
        <section className="card db-kpis" aria-label="Key figures">
          {DASHBOARD_KPIS.map((kpi, index) => (
            <div key={kpi.id} className={`db-kpi tile--${["sky", "mint", "lemon", "coral"][index]}`}>
              <div className="db-kpi__row">
                <div className="db-kpi__fig">
                  <div className="stat__label">
                    <span>{kpi.title}</span>
                    <span
                      className="db-info"
                      tabIndex={0}
                      role="note"
                      aria-label={kpi.info}
                      title={kpi.info}
                    >
                      <Icon name="info" />
                    </span>
                  </div>
                  <b className="stat__val">{formatKpiValue(index, channelTargets[index])}</b>
                  <div className="stat__meta">
                    <span className="delta">
                      <Icon name="arrow-up" />
                      {kpi.delta}
                    </span>
                    <span>{kpi.meta}</span>
                  </div>
                </div>

                {/* KPI Visual Graphics */}
                <div className="db-kpi__mini">
                  {kpi.id === "active" && (
                    <span className="db-mbars" aria-hidden="true">
                      <span className="db-mt"><span className="db-mf" style={{ height: "45%" }} /></span>
                      <span className="db-mt"><span className="db-mf" style={{ height: "70%" }} /></span>
                      <span className="db-mt"><span className="db-mf" style={{ height: "100%" }} /></span>
                    </span>
                  )}
                  {kpi.id === "revenue" && (
                    <svg className="db-spark" viewBox="0 0 84 40" aria-hidden="true">
                      <defs>
                        <linearGradient id="db-spark-g" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0" style={{ stopColor: "var(--c1)", stopOpacity: 0.28 }} />
                          <stop offset="1" style={{ stopColor: "var(--c1)", stopOpacity: 0 }} />
                        </linearGradient>
                      </defs>
                      <path
                        className="db-spark__area"
                        fill="url(#db-spark-g)"
                        d="M0,32 Q20,24 40,28 T84,8 L84,40 L0,40 Z"
                      />
                      <path
                        ref={sparkLineRef}
                        className="db-spark__line"
                        d="M0,32 Q20,24 40,28 T84,8"
                      />
                      <circle className="db-spark__dot" cx="84" cy="8" r="3.2" />
                    </svg>
                  )}
                  {kpi.id === "units" && (
                    <span className="db-ring" aria-hidden="true">
                      <svg viewBox="0 0 44 44">
                        <circle className="db-ring__track" cx="22" cy="22" r="17" />
                        <circle
                          ref={ringRef}
                          className="db-ring__fill"
                          cx="22"
                          cy="22"
                          r="17"
                          style={{ strokeDasharray: "0 100" }}
                        />
                      </svg>
                      <b ref={ringPctRef} className="db-ring__pct">0%</b>
                    </span>
                  )}
                  {kpi.id === "conv" && (
                    <span className="db-eq" aria-hidden="true">
                      {[35, 45, 60, 40, 70, 55, 80, 65, 90, 85].map((h, i) => (
                        <span key={i} className="db-et">
                          <span className="db-ef" style={{ height: `${h}%` }} />
                        </span>
                      ))}
                    </span>
                  )}
                </div>
              </div>

              <Link className="more-link" href={kpi.href}>
                {kpi.linkText} <Icon name="arrow-right" />
              </Link>
            </div>
          ))}
        </section>

        {/* Sales Performance Score Card */}
        <section className="card tile--ocean db-perf" aria-labelledby="db-perf-h">
          <header className="card__head">
            <h2 className="card__title" id="db-perf-h">
              Sales performance{" "}
              <span
                className="db-info"
                tabIndex={0}
                role="note"
                aria-label="A score out of 100 from revenue, orders and conversion against plan."
                title="A score out of 100 from revenue, orders and conversion against plan."
              >
                <Icon name="info" />
              </span>
            </h2>
          </header>

          <div className="db-gauge">
            <svg viewBox="0 0 240 136" role="img" aria-labelledby="db-gauge-sr">
              <title id="db-gauge-sr">Sales score: 84 of 100 points</title>
              <defs>
                <linearGradient id="db-gauge-g" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0" style={{ stopColor: "var(--c2)" }} />
                  <stop offset="0.55" style={{ stopColor: "var(--c1)" }} />
                  <stop offset="1" style={{ stopColor: "var(--c4)" }} />
                </linearGradient>
              </defs>
              <g className="db-ticks">{gaugeTicks}</g>
              <path
                className="db-g-track"
                d="M30 125 A90 90 0 0 1 210 125"
                pathLength="100"
              />
              <path
                ref={gaugeArcRef}
                className="db-g-arc"
                d="M30 125 A90 90 0 0 1 210 125"
                pathLength="100"
                style={{ strokeDasharray: "0 100" }}
              />
              <g ref={gaugeKnobRef} className="db-g-knob">
                <circle cx="30" cy="125" r="10" />
                <circle cx="30" cy="125" r="4" />
              </g>
            </svg>
            <div className="db-gauge__c">
              <p>
                <b ref={scoreValueRef}>0</b>
                <span className="delta">
                  <Icon name="arrow-up" />
                  +6
                </span>
              </p>
              <small>of 100 points</small>
            </div>
          </div>

          <div className="db-note" aria-live="polite">
            <h3>Strong conversion lift</h3>
            <p>Online conversion rose 0.4% after checkout redesign, outpacing plan.</p>
          </div>

          <Link className="more-link db-perf__more" href="/analytics">
            Improve your score <Icon name="arrow-right" />
          </Link>
        </section>

        {/* Revenue Analytics Chart */}
        <section className="card db-an" aria-labelledby="db-an-h">
          <header className="card__head">
            <h2 className="card__title" id="db-an-h">
              Revenue{" "}
              <span
                className="db-info"
                tabIndex={0}
                role="note"
                aria-label="Monthly revenue. November and December this year are the forecast."
                title="Monthly revenue. November and December this year are the forecast."
              >
                <Icon name="info" />
              </span>
            </h2>
            <span className="db-an__sum">
              ${Math.round(1_458_720 * revenueFactor).toLocaleString("en-US")} YTD
            </span>
            <div className="card__actions">
              <div className="seg seg--sm" role="group" aria-label="Year">
                <button type="button">2025</button>
                <button type="button" aria-selected="true">2026</button>
              </div>
            </div>
          </header>

          <div className="db-chart">
            <div className="db-plot">
              <div className="db-grid" aria-hidden="true">
                {[160, 120, 80, 40, 0].map((v) => (
                  <div key={v} className="db-gl">
                    <span>${v}K</span>
                    <i />
                  </div>
                ))}
              </div>

              {/* Target average dashed line */}
              <div className="db-avg" style={{ top: "34%" }}>
                <span>Target: $118K/mo</span>
              </div>

              {/* 12 Month Column Bars */}
              <div className="db-cols">
                {channelRevenue.map((item, idx) => {
                  const heightPct = Math.round((item.val / item.max) * 100);
                  const isHovered = activeMonthIndex === idx;

                  return (
                    <div
                      key={item.month}
                      className={`db-col ${item.isForecast ? "is-fc" : ""} ${isHovered ? "is-on" : ""}`}
                      onMouseEnter={() => setActiveMonthIndex(idx)}
                      tabIndex={0}
                    >
                      <div className="db-col__track">
                        <div
                          className="db-col__fill"
                          style={{ height: `${heightPct}%`, top: "auto", bottom: 0 }}
                        />
                      </div>

                      {/* Active highlight pill */}
                      {isHovered && (
                        <div
                          className={`db-hl ${item.isForecast ? "is-fc" : ""}`}
                          style={{
                            height: `${heightPct}%`,
                            top: "auto",
                            bottom: 0,
                            left: "50%",
                            marginLeft: "-15px",
                          }}
                        >
                          <div className="db-hl__fill" />
                          <div className="db-hl__cap" />
                        </div>
                      )}

                      <span className="db-col__x">{item.month}</span>
                    </div>
                  );
                })}
              </div>

              {/* Tooltip on active bar */}
              {activeMonthIndex !== null && (
                <div
                  className="db-tip"
                  style={{
                    left: `calc(44px + ${(activeMonthIndex / 12) * 100}% - 20px)`,
                    top: "10px",
                  }}
                >
                  <div className="db-tip__h">
                    <b>{MONTHLY_REVENUE[activeMonthIndex].month} 2026</b>
                    {MONTHLY_REVENUE[activeMonthIndex].isForecast ? (
                      <em>Forecast</em>
                    ) : (
                      <em>Actual</em>
                    )}
                  </div>
                  <dl>
                    <div>
                      <dt>Revenue</dt>
                      <dd>${(channelRevenue[activeMonthIndex].val / 1000).toFixed(1)}K</dd>
                    </div>
                    <div>
                      <dt>vs Target</dt>
                      <dd className="up">+14.2%</dd>
                    </div>
                  </dl>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Visits by Hour Heatmap */}
        <section className="card db-heatc" aria-labelledby="db-heatc-h">
          <header className="card__head">
            <h2 className="card__title" id="db-heatc-h">
              Visits by hour{" "}
              <span
                className="db-info"
                tabIndex={0}
                role="note"
                aria-label="Concentration of web visits and foot traffic by day and hour."
                title="Concentration of web visits and foot traffic by day and hour."
              >
                <Icon name="info" />
              </span>
            </h2>
            <div className="card__actions db-scale">
              <span>Less</span>
              {[0, 1, 2, 3, 4].map((lvl) => (
                <span
                  key={lvl}
                  className="db-sw"
                  style={{ background: `var(--heat-${lvl})` }}
                />
              ))}
              <span>More</span>
            </div>
          </header>

          <div className="db-heat">
            <span />
            {HEATMAP_DAYS.map((d) => (
              <span key={d} className="db-heat__d">
                <span className="db-long">{d}</span>
                <span className="db-short">{d[0]}</span>
              </span>
            ))}

            {HEATMAP_PERIODS.map((period, pIdx) => (
              <div key={period} style={{ display: "contents" }}>
                <span className="db-heat__p">{period}</span>
                {HEATMAP_GRID[pIdx].map((baseLevel, dIdx) => {
                  const lvl = channel === "online"
                    ? Math.min(4, baseLevel + (pIdx === 1 || pIdx === 2 ? 1 : 0))
                    : channel === "store"
                      ? Math.max(0, baseLevel + (dIdx >= 5 ? 1 : -1))
                      : baseLevel;
                  return (
                    <div key={dIdx} className="db-cell">
                      <i style={{ background: `var(--heat-${lvl})` }} />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </section>

        {/* Visits by Device Donut */}
        <section className="card db-vis" aria-labelledby="db-vis-h">
          <header className="card__head">
            <h2 className="card__title" id="db-vis-h">
              Visits by device{" "}
              <span
                className="db-info"
                tabIndex={0}
                role="note"
                aria-label="Device share of store shoppers and web browsers."
                title="Device share of store shoppers and web browsers."
              >
                <Icon name="info" />
              </span>
            </h2>
          </header>

          <div className="db-vis__body">
            <div className="db-legend">
              {DEVICE_VISITS.map((item) => (
                <button key={item.label} type="button">
                  <i style={{ background: item.color }} />
                  <span className="db-legend__l">{item.label}</span>
                  <span className="db-legend__v">{item.count}</span>
                  <span className="db-legend__v" style={{ opacity: 0.6 }}>
                    {item.pct}%
                  </span>
                </button>
              ))}
            </div>

            <div className="db-donut">
              <svg viewBox="0 0 168 168">
                <circle className="db-donut__track" cx="84" cy="84" r="62" />
                <circle
                  className="db-seg"
                  cx="84"
                  cy="84"
                  r="62"
                  stroke="var(--c1)"
                  style={{ strokeDasharray: "58 100", strokeDashoffset: "0" }}
                />
                <circle
                  className="db-seg"
                  cx="84"
                  cy="84"
                  r="62"
                  stroke="var(--c2)"
                  style={{ strokeDasharray: "34 100", strokeDashoffset: "-58" }}
                />
                <circle
                  className="db-seg"
                  cx="84"
                  cy="84"
                  r="62"
                  stroke="var(--c4)"
                  style={{ strokeDasharray: "8 100", strokeDashoffset: "-92" }}
                />
              </svg>
              <div className="db-donut__c">
                <b ref={visitsTotalRef}>{visitsTotal}</b>
                <small>total visits</small>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
