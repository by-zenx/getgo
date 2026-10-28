"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Icon } from "@/components/icons/svg-sprite";
import { moveSegmentPill } from "@/lib/segment-motion";
import { aggregateAnalytics, analyticsProducts, ANALYTICS_RANGES, createAnalyticsSeries, TRAFFIC_SOURCES, type AnalyticsRange, type AnalyticsScope } from "@/data/analytics-data";

type MetricKey = "rev" | "orders" | "aov" | "conv" | "ret";
type Grouping = "weekday" | "hour";
const SCOPE_OPTIONS = [{ value: "all", label: "All" }, { value: "online", label: "Online" }, { value: "store", label: "In store" }] as const;
const METRICS: { key: MetricKey; label: string }[] = [
  { key: "rev", label: "Revenue" }, { key: "orders", label: "Orders" },
  { key: "aov", label: "Average order value" }, { key: "conv", label: "Conversion" },
  { key: "ret", label: "Returning customers" },
];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = ["12a", "2a", "4a", "6a", "8a", "10a", "12p", "2p", "4p", "6p", "8p", "10p"];
const ONLINE_HOURS = [1.2, 0.7, 0.4, 0.3, 0.3, 0.5, 1.2, 2.4, 3.6, 4.2, 4.6, 5.2, 6.1, 6, 5.1, 4.6, 4.8, 5.4, 6.2, 7.1, 7.8, 7.4, 5.6, 2.9];
const STORE_HOURS = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6.2, 9.1, 11.8, 13.4, 11.2, 10.6, 12.1, 13, 9.8, 0, 0, 0, 0, 0];
const SOURCE_SHARE: Record<AnalyticsScope, number[]> = {
  all: [0.36, 0.29, 0.15, 0.12, 0.08],
  online: [0.29, 0.34, 0.17, 0.12, 0.08],
  store: [0.52, 0.18, 0.14, 0.09, 0.07],
};
const PERIOD_NAMES: Record<AnalyticsRange, string> = { "7D": "last 7 days", "30D": "last 30 days", "90D": "last 90 days", "12M": "last 12 months" };

function money(value: number, compact = false) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0, ...(compact ? { notation: "compact" as const } : {}) }).format(value);
}
function number(value: number) { return Math.round(value).toLocaleString("en-US"); }
function percent(value: number, digits = 1) { return `${(value * 100).toFixed(digits)}%`; }
function metricValue(key: MetricKey, value: ReturnType<typeof aggregateAnalytics>) {
  return key === "rev" ? value.revenue : key === "orders" ? value.orders : key === "aov" ? value.aov : key === "conv" ? value.conv : value.ret;
}
function formatMetric(key: MetricKey, value: number) {
  if (key === "rev" || key === "aov") return money(value, true);
  if (key === "orders") return number(value);
  return percent(value);
}
function linePath(values: number[], max: number, width: number, height: number, top: number, bottom: number) {
  if (!values.length) return "";
  const usable = height - top - bottom;
  return values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : index / (values.length - 1) * width;
    const y = height - bottom - value / max * usable;
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}
function delta(current: number, previous: number) {
  return (current - previous) / Math.max(Math.abs(previous), 0.0001);
}

function SegmentToggle<T extends string>({ value, options, label, className = "", onChange }: { value: T; options: readonly { value: T; label: string }[]; label: string; className?: string; onChange: (value: T) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const initialized = useRef(false);
  useGSAP(() => {
    const group = ref.current;
    const pill = pillRef.current;
    const active = group?.querySelector<HTMLButtonElement>(`button[data-value="${value}"]`);
    if (!group || !pill || !active) return;
    moveSegmentPill(pill, active, !initialized.current);
    initialized.current = true;
  }, { dependencies: [value], scope: ref });
  return <div ref={ref} className={`seg ${className}`.trim()} role="group" aria-label={label}>
    <span ref={pillRef} className="seg__pill" aria-hidden="true" />
    {options.map((option) => <button key={option.value} type="button" data-value={option.value} aria-pressed={value === option.value} onClick={() => onChange(option.value)}>{option.label}</button>)}
  </div>;
}

function Sparkline({ values, id }: { values: number[]; id: string }) {
  const max = Math.max(...values, 1) * 1.08;
  const path = linePath(values, max, 100, 30, 3, 3);
  return <div className="an-spark"><svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id={`an-sgrad-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" className="an-sgrad-a" /><stop offset="1" className="an-grad-b" /></linearGradient></defs><path className="an-spark__area" fill={`url(#an-sgrad-${id})`} d={`${path} L100,27 L0,27 Z`} /><path className="an-spark__line" pathLength="100" d={path} /></svg></div>;
}

export function AnalyticsView() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<AnalyticsRange>("30D");
  const [scope, setScope] = useState<AnalyticsScope>("all");
  const [compare, setCompare] = useState(true);
  const [grouping, setGrouping] = useState<Grouping>("weekday");
  const [chartIndex, setChartIndex] = useState<number | null>(null);
  const [sourceIndex, setSourceIndex] = useState<number>(-1);

  const currentSeries = useMemo(() => createAnalyticsSeries(range), [range]);
  const previousSeries = useMemo(() => createAnalyticsSeries(range, true), [range]);
  const current = useMemo(() => aggregateAnalytics(currentSeries, scope), [currentSeries, scope]);
  const previous = useMemo(() => aggregateAnalytics(previousSeries, scope), [previousSeries, scope]);
  const products = useMemo(() => analyticsProducts(current.revenue, scope), [current.revenue, scope]);
  const split = useMemo(() => ({ online: aggregateAnalytics(currentSeries, "online"), store: aggregateAnalytics(currentSeries, "store") }), [currentSeries]);
  const rawRevenue = split.online.revenue + split.store.revenue;
  const onlineShare = split.online.revenue / Math.max(1, rawRevenue);
  const visibleCurrent = currentSeries.map((point) => (scope === "all" ? point.online + point.store : point[scope]));
  const visiblePrevious = previousSeries.map((point) => (scope === "all" ? point.online + point.store : point[scope]));
  const chartMax = Math.max(...visibleCurrent, ...(compare ? visiblePrevious : []), 1) * 1.18;
  const chartWidth = 900;
  const chartHeight = 300;
  const chartLeft = 58;
  const chartRight = 18;
  const chartTop = 18;
  const chartBottom = 34;
  const plotWidth = chartWidth - chartLeft - chartRight;
  const chartLine = linePath(visibleCurrent, chartMax, plotWidth, chartHeight, chartTop, chartBottom);
  const chartPrev = linePath(visiblePrevious, chartMax, plotWidth, chartHeight, chartTop, chartBottom);
  const area = chartLine ? `${chartLine} L${plotWidth},${chartHeight - chartBottom} L0,${chartHeight - chartBottom} Z` : "";
  const selectedIndex = chartIndex === null ? currentSeries.length - 1 : Math.max(0, Math.min(currentSeries.length - 1, chartIndex));
  const selectedPoint = currentSeries[selectedIndex];
  const selectedValue = visibleCurrent[selectedIndex] ?? 0;
  const selectedPrevious = visiblePrevious[selectedIndex] ?? 0;
  const plotY = chartHeight - chartBottom - selectedValue / chartMax * (chartHeight - chartTop - chartBottom);
  const plotX = currentSeries.length <= 1 ? chartLeft + plotWidth / 2 : chartLeft + selectedIndex / (currentSeries.length - 1) * plotWidth;
  const xLabelIndexes = useMemo(() => {
    const maxLabels = range === "7D" ? 7 : range === "30D" ? 6 : range === "90D" ? 7 : 12;
    const step = Math.max(1, Math.ceil((currentSeries.length - 1) / (maxLabels - 1)));
    const indexes = Array.from({ length: currentSeries.length }, (_, index) => index).filter((index) => index % step === 0);
    if (indexes.at(-1) !== currentSeries.length - 1) indexes.push(currentSeries.length - 1);
    return indexes;
  }, [currentSeries.length, range]);
  const revenueDelta = delta(current.revenue, previous.revenue);
  const onlinePct = onlineShare;
  const funnel = [current.visits, current.visits * (scope === "store" ? 0.82 : 0.58), current.visits * (scope === "store" ? 0.24 : 0.118), current.visits * (scope === "store" ? 0.11 : 0.068), current.orders];
  const sources = SOURCE_SHARE[scope].map((share, index) => share * current.visits * (0.9 + 0.2 * Math.sin(index + range.length + 0.5)));
  const sourceTotal = sources.reduce((sum, value) => sum + value, 0) || 1;
  const sourceShares = sources.map((value) => value / sourceTotal);
  const selectedSource = sourceIndex < 0 ? -1 : sourceIndex;
  const weekdaySales = Array(7).fill(0) as number[];
  currentSeries.forEach((point) => { weekdaySales[(new Date(point.date).getUTCDay() + 6) % 7] += scope === "all" ? point.online + point.store : point[scope]; });
  const hourlySales = HOURS.map((_, index) => {
    const online = ONLINE_HOURS.slice(index * 2, index * 2 + 2).reduce((sum, value) => sum + value, 0);
    const store = STORE_HOURS.slice(index * 2, index * 2 + 2).reduce((sum, value) => sum + value, 0);
    const total = scope === "online" ? online : scope === "store" ? store : online * 0.69 + store * 0.31;
    return total * current.revenue / (scope === "store" ? 28 : scope === "online" ? 94 : 76);
  });
  const barValues = grouping === "weekday" ? weekdaySales : hourlySales;
  const barLabels = grouping === "weekday" ? WEEKDAYS : HOURS;
  const barMax = Math.max(...barValues, 1);

  useGSAP(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cards = rootRef.current?.querySelectorAll<HTMLElement>(".an-kpis .an-kpi, .an-grid > .card");
    if (!reduced && cards?.length) gsap.fromTo(cards, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.48, stagger: 0.045, delay: 0.08, ease: "power3.out", clearProps: "transform,opacity" });
    rootRef.current?.querySelectorAll<HTMLElement>(".an-fstep__fill, .an-pbar__fill").forEach((fill, index) => {
      const scale = Number(fill.dataset.v ?? 0);
      if (reduced) gsap.set(fill, { scaleX: scale });
      else gsap.fromTo(fill, { scaleX: 0 }, { scaleX: scale, duration: 0.9, delay: 0.15 + index * 0.025, ease: "expo.out" });
    });
    rootRef.current?.querySelectorAll<HTMLElement>(".an-bar__fill").forEach((fill, index) => {
      const scale = Number(fill.dataset.v ?? 0);
      if (reduced) gsap.set(fill, { scaleY: scale });
      else gsap.fromTo(fill, { scaleY: 0 }, { scaleY: scale, duration: 0.8, delay: 0.15 + index * 0.025, ease: "expo.out" });
    });
    rootRef.current?.querySelectorAll<SVGCircleElement>(".an-donut__seg").forEach((segment, index) => {
      const dash = getComputedStyle(segment).strokeDasharray;
      if (reduced) gsap.set(segment, { strokeDasharray: dash });
      else gsap.fromTo(segment, { strokeDasharray: "0 100" }, { strokeDasharray: dash, duration: 0.9, delay: 0.25 + index * 0.08, ease: "power3.out" });
    });
    if (!reduced) {
      const line = rootRef.current?.querySelector<SVGPathElement>(".an-line");
      if (line) gsap.fromTo(line, { strokeDashoffset: 100 }, { strokeDashoffset: 0, duration: 1.1, delay: 0.2, ease: "power2.inOut" });
      const areaPath = rootRef.current?.querySelector<SVGPathElement>(".an-area");
      if (areaPath) gsap.fromTo(areaPath, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.8, delay: 0.3, ease: "power3.out" });
    }
  }, { dependencies: [range, scope, grouping], scope: rootRef });

  useGSAP(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const values = [current.revenue, current.orders, current.aov, current.conv * 100, current.ret * 100];
    rootRef.current?.querySelectorAll<HTMLElement>(".an-kpi [data-val]").forEach((element, index) => {
      const key = METRICS[index].key;
      const counter = { value: reduced ? values[index] : 0 };
      const render = () => { element.textContent = key === "rev" || key === "aov" ? money(counter.value, true) : key === "orders" ? number(counter.value) : `${counter.value.toFixed(1)}%`; };
      render();
      if (!reduced) gsap.to(counter, { value: values[index], duration: 0.95, delay: 0.2 + index * 0.06, ease: "power3.out", onUpdate: render });
    });
  }, { dependencies: [range, scope], scope: rootRef });

  const exportCsv = () => {
    const lines: (string | number)[][] = [["Date", "Revenue", "Previous period revenue", "Change"]];
    currentSeries.forEach((point, index) => {
      const currentValue = visibleCurrent[index] ?? 0;
      const previousValue = visiblePrevious[index] ?? 0;
      lines.push([point.long, currentValue.toFixed(2), previousValue.toFixed(2), `${(delta(currentValue, previousValue) * 100).toFixed(1)}%`]);
    });
    lines.push([], ["Metric", "This period", "Previous period"]);
    METRICS.forEach((metric) => lines.push([metric.label, formatMetric(metric.key, metricValue(metric.key, current)), formatMetric(metric.key, metricValue(metric.key, previous))]));
    lines.push([], ["Catalog item", "Units", "Revenue"]);
    products.forEach(({ product, units, revenue }) => lines.push([product.name, units, revenue.toFixed(2)]));
    const csv = lines.map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `corbel-analytics-${range.toLowerCase()}-${scope}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleChartKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    setChartIndex((index) => Math.max(0, Math.min(currentSeries.length - 1, (index ?? currentSeries.length - 1) + (event.key === "ArrowRight" ? 1 : -1))));
  };
  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const amount = Math.max(0, Math.min(1, (event.clientX - bounds.left - bounds.width * chartLeft / chartWidth) / (bounds.width * plotWidth / chartWidth)));
    setChartIndex(Math.round(amount * (currentSeries.length - 1)));
  };
  const pointX = (index: number) => chartLeft + (currentSeries.length <= 1 ? 0.5 : index / (currentSeries.length - 1)) * plotWidth;

  return <div ref={rootRef} data-view="analytics" className="view an">
    <div className="toolbar an-toolbar">
      <SegmentToggle value={range} options={ANALYTICS_RANGES} label="Date range" className="an-range" onChange={(value) => { setRange(value); setChartIndex(null); }} />
      <SegmentToggle value={scope} options={SCOPE_OPTIONS} label="Sales channel" className="an-scope" onChange={setScope} />
      <div className="toolbar__end">
        <label className="an-compare"><span className="switch"><input type="checkbox" checked={compare} onChange={(event) => setCompare(event.target.checked)} /><span className="switch__track" /><span className="switch__knob" /></span><span>vs previous period</span></label>
        <button className="btn" type="button" onClick={exportCsv}><Icon name="download" />Export CSV</button>
      </div>
    </div>

    <section className="card statbar an-kpis" style={{ "--n": 5 } as CSSProperties} aria-label="Key figures">
      {METRICS.map((metric) => {
        const value = metricValue(metric.key, current);
        const previousValue = metricValue(metric.key, previous);
        const change = delta(value, previousValue);
        const points = currentSeries.map((point) => metricValue(metric.key, aggregateAnalytics([point], scope)));
        return <div className="stat an-kpi" key={metric.key} data-k={metric.key}>
          <span className="stat__label">{metric.label}</span><span className="stat__val" data-val>{formatMetric(metric.key, value)}</span>
          <span className="stat__meta">{compare && <><span className={`an-cmp${change < 0 ? " is-down" : ""}`}>{metric.key === "conv" || metric.key === "ret" ? `${(value - previousValue) * 100 >= 0 ? "+" : ""}${((value - previousValue) * 100).toFixed(1)}%` : `${change >= 0 ? "+" : ""}${(change * 100).toFixed(1)}%`}</span><span className="an-cmp an-kpi__vs">vs previous</span></>}</span>
          <Sparkline values={points} id={metric.key} />
        </div>;
      })}
    </section>

    <div className="an-grid">
      <section className="card an-main" aria-labelledby="an-main-h">
        <div className="card__head an-main__head"><div className="an-main__fig"><h2 className="card__title" id="an-main-h">Revenue over time</h2><div className="an-main__total"><b data-total>{money(current.revenue)}</b>{compare && <span className={`an-cmp${revenueDelta < 0 ? " is-down" : ""}`} data-total-delta>{`${revenueDelta >= 0 ? "+" : ""}${(revenueDelta * 100).toFixed(1)}%`}</span>}</div><p className="card__sub" data-range-note>{`${PERIOD_NAMES[range]}, ${scope === "all" ? "all channels" : scope}`}</p></div>
          <ul className="an-legend" aria-hidden="true"><li><i className="an-sw an-sw--cur" />This period</li>{compare && <li className="an-cmp"><i className="an-sw an-sw--prev" />Previous period</li>}</ul>
        </div>
        <div className="an-chart" tabIndex={0} role="group" aria-label="Revenue chart. Use the left and right arrow keys to read each point." onKeyDown={handleChartKey} onPointerMove={handlePointerMove} onPointerLeave={() => setChartIndex(null)}>
          <svg className="an-chart__svg" viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" role="img" aria-labelledby="an-chart-sum">
            <title id="an-chart-sum">Revenue by {range === "12M" ? "month" : "day"}</title>
            <defs><linearGradient id="an-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" className="an-grad-a" /><stop offset="1" className="an-grad-b" /></linearGradient></defs>
            <g className="an-gridlines">{Array.from({ length: 5 }, (_, index) => { const y = chartTop + index / 4 * (chartHeight - chartTop - chartBottom); return <g key={index}><line x1={chartLeft} x2={chartWidth - chartRight} y1={y} y2={y} /><text x={chartLeft - 10} y={y + 4} textAnchor="end">{money(chartMax * (1 - index / 4), true)}</text></g>; })}</g>
            <g className="an-xlabels">{xLabelIndexes.map((index) => <text key={index} x={pointX(index)} y={chartHeight - 8} textAnchor={index === 0 ? "start" : index === currentSeries.length - 1 ? "end" : "middle"}>{currentSeries[index].label}</text>)}</g>
            <g transform={`translate(${chartLeft} 0)`}><path className="an-area" d={area} />{compare && <path className="an-prev" d={chartPrev} />}<path className="an-line" d={chartLine} /></g>
            {chartIndex !== null && <><line className="an-cross" x1={plotX} x2={plotX} y1={chartTop} y2={chartHeight - chartBottom} />{compare && <circle className="an-dot an-dot--prev" cx={plotX} cy={chartHeight - chartBottom - selectedPrevious / chartMax * (chartHeight - chartTop - chartBottom)} r="4" />}<circle className="an-dot" cx={plotX} cy={plotY} r="5.5" /></>}
          </svg>
          {chartIndex !== null && selectedPoint && <div className="an-tip" style={{ left: `${plotX / chartWidth * 100}%`, top: `${Math.max(3, plotY / chartHeight * 100 - 4)}%`, transform: plotX > chartWidth * 0.72 ? "translate(-100%, -100%)" : "translate(12px, -100%)" }} aria-hidden="true">
            <b>{selectedPoint.long}</b><div className="an-tip__row"><i className="an-sw an-sw--cur" /><span>This period</span><b>{money(selectedValue)}</b></div>{compare && <><div className="an-tip__row an-tip__prev"><i className="an-sw an-sw--prev" /><span>{previousSeries[selectedIndex]?.long}</span><b>{money(selectedPrevious)}</b></div><div className={`an-tip__delta${selectedValue < selectedPrevious ? " is-down" : ""}`}>{`${selectedValue >= selectedPrevious ? "+" : ""}${(delta(selectedValue, selectedPrevious) * 100).toFixed(1)}% vs previous`}</div></>}
          </div>}
          <p className="sr-only" aria-live="polite">{chartIndex !== null && selectedPoint ? `${selectedPoint.long}: ${money(selectedValue)}${compare ? `, previous period ${money(selectedPrevious)}` : ""}` : ""}</p>
        </div>
        <table className="sr-only"><caption>Revenue by period</caption><thead><tr><th>Date</th><th>Revenue</th><th>Previous period</th></tr></thead><tbody>{currentSeries.map((point, index) => <tr key={`${point.date}-${index}`}><td>{point.long}</td><td>{money(visibleCurrent[index])}</td><td>{money(visiblePrevious[index])}</td></tr>)}</tbody></table>
      </section>

      <section className="card an-split" aria-labelledby="an-split-h"><div className="card__head"><h2 className="card__title" id="an-split-h">Online vs in store</h2></div>
        <div className="an-split__share"><div className="an-split__pcts"><span><b data-share="online">{percent(onlinePct, 0)}</b> online</span><span><b data-share="store">{percent(1 - onlinePct, 0)}</b> in store</span></div><div className="an-split__track" role="img" aria-label={`Revenue split: ${percent(onlinePct, 0)} online, ${percent(1 - onlinePct, 0)} in store`}><span className="an-split__fill an-split__fill--on" style={{ transform: `scaleX(${onlinePct})` }} /><span className="an-split__fill an-split__fill--st" style={{ transform: `scaleX(${1 - onlinePct})` }} /></div></div>
        <ul className="an-split__rows">{(["online", "store"] as const).map((channel) => { const value = split[channel]; const previousChannel = aggregateAnalytics(previousSeries, channel); const change = delta(value.revenue, previousChannel.revenue); return <li key={channel} className="an-split__row" data-ch={channel}><i className={`an-split__key an-split__key--${channel}`} aria-hidden="true" /><div className="an-split__txt"><b>{channel === "online" ? "Online shop" : "Main St + Harbor"}</b><small>{number(value.orders)} orders</small></div><div className="an-split__fig"><b data-rev>{money(value.revenue, true)}</b>{compare && <span className={`an-cmp${change < 0 ? " is-down" : ""}`}>{`${change >= 0 ? "+" : ""}${(change * 100).toFixed(1)}%`}</span>}</div></li>; })}</ul>
        <p className="card__sub an-split__note">Online demand is {percent(onlineShare, 0)} of revenue in this period. In-store revenue combines Main St and Harbor.</p>
      </section>

      <section className="card an-funnel-card" aria-labelledby="an-funnel-h"><div className="card__head"><h2 className="card__title" id="an-funnel-h">Conversion funnel</h2><span className="card__actions card__sub" data-funnel-note>{scope === "store" ? "Door counts and till data" : scope === "online" ? "Website sessions" : "Website sessions and door counts"}</span></div>
        <ol className="an-funnel">{["Visits", "Catalog views", "Enquiries", "Proposals", "Purchase"].map((label, index) => { const value = funnel[index]; const previousValue = funnel[index - 1] ?? value; const share = value / Math.max(1, funnel[0]); const drop = index ? Math.max(0, 1 - value / Math.max(1, previousValue)) : 0; return <li key={label}>
          {index > 0 && <div className={`an-drop${drop > 0.65 ? " is-worst" : ""}`} aria-hidden="true"><span>{percent(drop, 0)}</span> drop off</div>}
          <div className="an-fstep" data-step={index}><div className="an-fstep__top"><span className="an-fstep__name">{label}</span><b data-fv>{number(value)}</b><span className="an-fstep__pct" data-fp>{percent(share, 1)}</span></div><div className="an-fstep__track"><span className="an-fstep__fill" data-v={share} style={{ transform: `scaleX(${share})` }} /></div></div>
        </li>; })}</ol>
      </section>

      <section className="card an-traffic" aria-labelledby="an-traffic-h"><div className="card__head"><h2 className="card__title" id="an-traffic-h">Traffic sources</h2></div>
        <div className="an-traffic__body"><div className="an-donut"><svg viewBox="0 0 180 180" role="img" aria-labelledby="an-donut-sum"><title id="an-donut-sum">Traffic sources: {TRAFFIC_SOURCES.map((label, index) => `${label} ${percent(sourceShares[index], 0)}`).join(", ")}</title><circle className="an-donut__track" cx="90" cy="90" r="70" />
          <g transform="rotate(-90 90 90)">{sourceShares.map((share, index) => { const gap = 0.8; const amount = Math.max(0, share * 100 - gap); const before = sourceShares.slice(0, index).reduce((sum, value) => sum + value * 100, 0); return <circle key={TRAFFIC_SOURCES[index]} className="an-donut__seg" data-src={index} cx="90" cy="90" r="70" pathLength="100" style={{ stroke: `var(--c${index + 1})`, strokeDasharray: `${amount} ${100 - amount}`, strokeDashoffset: -before, opacity: selectedSource >= 0 && selectedSource !== index ? 0.35 : 1 }} />; })}</g></svg>
          <div className="an-donut__mid" aria-hidden="true"><b data-mid-v>{selectedSource < 0 ? number(current.visits) : percent(sourceShares[selectedSource], 0)}</b><span data-mid-l>{selectedSource < 0 ? "visits" : "of visits"}</span></div></div>
          <ul className="an-legend-list">{TRAFFIC_SOURCES.map((label, index) => <li key={label}><button type="button" className={`an-src${selectedSource === index ? " is-hl" : ""}`} data-src={index} aria-pressed={selectedSource === index} onClick={() => setSourceIndex(selectedSource === index ? -1 : index)}><i className="an-src__sw" style={{ background: `var(--c${index + 1})` }} /><span>{label}</span><b data-src-pct>{percent(sourceShares[index], 0)}</b><small data-src-v>{number(sources[index])} visits</small></button></li>)}</ul>
        </div>
      </section>

      <section className="card an-products" aria-labelledby="an-products-h"><div className="card__head"><h2 className="card__title" id="an-products-h">Top catalog items</h2><Link className="card__actions more-link" href="/catalog">All items</Link></div>
        <div className="table-wrap"><table className="table an-ptable"><thead><tr><th scope="col">#</th><th scope="col">Item</th><th scope="col" className="num">Units</th><th scope="col" className="num">Revenue</th><th scope="col" className="an-ptable__barh"><span className="sr-only">Share of top seller</span></th></tr></thead>
          <tbody>{products.slice(0, 10).map(({ product, units, revenue }, index) => <tr key={product.id} data-pid={product.id}><td className="an-rank" data-rank>{index + 1}</td><td><div className="cell-main"><span className="thumb" style={{ "--h": product.hue } as CSSProperties}>{product.name.split(/[ ,]/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase()}</span><div><Link className="an-plink" href={`/catalog/${product.id}`}><b>{product.name}</b></Link><small>{product.category}</small></div></div></td><td className="num" data-units>{number(units)}</td><td className="num"><b data-prow>{money(revenue)}</b></td><td className="an-ptable__bar"><span className="an-pbar"><span className="an-pbar__fill" data-v={revenue / Math.max(1, products[0]?.revenue ?? 1)} style={{ transform: `scaleX(${revenue / Math.max(1, products[0]?.revenue ?? 1)})` }} /></span></td></tr>)}</tbody>
        </table></div>
      </section>

      <section className="card an-week" aria-labelledby="an-week-h"><div className="card__head"><h2 className="card__title" id="an-week-h">When people buy</h2><div className="card__actions"><SegmentToggle value={grouping} options={[{ value: "weekday", label: "Weekday" }, { value: "hour", label: "Hour" }]} label="Group sales by" className="seg--sm an-wmode" onChange={setGrouping} /></div></div>
        <p className="an-week__cap" aria-live="polite"><b>{grouping === "weekday" ? "Sales by day of week" : "Sales by time of day"}</b><span>{PERIOD_NAMES[range]}</span></p>
        <div className={`an-bars${grouping === "hour" ? " an-bars--h" : ""}`} style={{ "--n": barValues.length } as CSSProperties} role="group" aria-label={grouping === "weekday" ? "Sales by weekday" : "Sales by hour"}>{barValues.map((value, index) => <button key={barLabels[index]} type="button" className={`an-bar${index === selectedIndex % barValues.length ? " is-on" : ""}`} aria-label={`${barLabels[index]}: ${money(value)}`} title={`${barLabels[index]}: ${money(value)}`} onClick={() => setChartIndex(index % currentSeries.length)}><span className="an-bar__fill" data-v={value / barMax} style={{ transform: `scaleY(${value / barMax})` }} /></button>)}</div>
        <div className="an-bars__x" style={{ "--n": barLabels.length } as CSSProperties}>{barLabels.map((label) => <span key={label}>{label}</span>)}</div>
        <dl className="an-week__sum"><div><dt>Best {grouping}</dt><dd>{barLabels[barValues.indexOf(barMax)]}</dd></div><div><dt>Highest revenue</dt><dd>{money(barMax, true)}</dd></div><div><dt>Period total</dt><dd>{money(current.revenue, true)}</dd></div></dl>
      </section>
    </div>
  </div>;
}
