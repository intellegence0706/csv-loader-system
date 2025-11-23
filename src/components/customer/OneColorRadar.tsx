import {
    PolarAngleAxis,
    PolarGrid,
    PolarRadiusAxis,
    Radar,
    RadarChart,
    ResponsiveContainer,
} from "recharts";

export type AxisKeyOC = "ベース" | "カラー" | "トップ";
export type OCCheckpoint = { code: string; label: string; points: number; highlight?: boolean };
export type OCItem = { id: number; title: string; required?: boolean; checkpoints: OCCheckpoint[] };
export type OCCategory = { name: AxisKeyOC; items: OCItem[] };

type BucketTotals = { max: number; prev: number; cur: number };

type OneColorRadarProps = {
    avgData?: Record<string, any>;
    previousData?: Record<string, any>;
    currentData?: Record<string, any>;
    master: OCCategory[];
};

const legendItems = [
    { label: "全国平均", color: "#64CBD3" },
    { label: "前回", color: "#4075B5" },
    { label: "今回", color: "#F15C4B" },
];

const normalizeKey = (value: string) =>
    (typeof value === "string" ? value : String(value ?? ""))
        .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xFEE0))
        .replace(/[‐‑–—−ーｰ－]/g, "-")
        .replace(/[［］【】\[\]\(\)\s\u3000]/g, "");

const toNumber = (v: any) => {
    const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
};

const ensureMap = (m: any): Record<string, any> => {
    if (!m) return {};
    if (typeof m === "string") {
        try {
            const parsed = JSON.parse(m);
            return parsed && typeof parsed === "object" ? parsed : {};
        } catch {
            return {};
        }
    }
    return typeof m === "object" ? (m as Record<string, any>) : {};
};

const getScore = (map: Record<string, any> | undefined, code: string, label: string) => {
    if (!map) return 0;
    const nCode = normalizeKey(code || "");
    const nCodeA = normalizeKey(`[ワンカラ] ${code}`);
    const nCodeB = normalizeKey(`ワンカラ${code}`);
    const nLabel = normalizeKey(label || "");
    for (const [rawKey, rawVal] of Object.entries(map)) {
        const nk = normalizeKey(rawKey);
        if (nCode && nk.includes(nCode)) return toNumber(rawVal);
        if (nCodeA && nk.includes(nCodeA)) return toNumber(rawVal);
        if (nCodeB && nk.includes(nCodeB)) return toNumber(rawVal);
        if (nLabel && nk.includes(nLabel)) return toNumber(rawVal);
    }
    return 0;
};

const pickFromMap = (map: Record<string, any>, keys: string[]) => {
    for (const [k, v] of Object.entries(map || {})) {
        if (keys.some((token) => String(k).includes(token))) return toNumber(v);
    }
    return 0;
};

const fmt1 = (n: number | undefined | null) =>
    typeof n === "number" ? n.toLocaleString(undefined, { maximumFractionDigits: 1 }) : "";

const labelPos = (axis: string, cx: number, cy: number) => {
    if (axis === "ワンカラー総合") return { x: cx, y: cy - 10, anchor: "middle" as const };
    if (axis === "ベース") return { x: cx + 10, y: cy + 4, anchor: "start" as const };
    if (axis === "カラー") return { x: cx, y: cy + 14, anchor: "middle" as const };
    if (axis === "トップ") return { x: cx - 10, y: cy + 4, anchor: "end" as const };
    return { x: cx, y: cy - 10, anchor: "middle" as const };
};

const Dot =
    (color: string, keyName: "nationalRaw" | "previousRaw" | "currentRaw") =>
        (props: any) => {
            const { cx, cy, payload } = props;
            if (typeof cx !== "number" || typeof cy !== "number") return null;
            const raw = payload?.[keyName];
            const { x, y, anchor } = labelPos(payload?.axis, cx, cy);
            return (
                <g>
                    <circle cx={cx} cy={cy} r={4.5} fill={color} stroke="#ffffff" strokeWidth={1.8} />
                    <text x={x} y={y} textAnchor={anchor} fontSize={12} fontWeight={600} fill={color === "#64CBD3" ? "#2a8090" : color}>
                        {fmt1(raw)}
                    </text>
                </g>
            );
        };

const NationalDot = Dot("#64CBD3", "nationalRaw");
const PreviousDot = Dot("#4075B5", "previousRaw");
const CurrentDot = Dot("#F15C4B", "currentRaw");

const OneColorRadar = ({ avgData, previousData, currentData, master }: OneColorRadarProps) => {
    const currentMap = ensureMap(currentData);
    const previousMap = ensureMap(previousData);
    const avgMap = ensureMap(avgData);

    const buckets: Record<AxisKeyOC, BucketTotals> = {
        "ベース": { max: 0, prev: 0, cur: 0 },
        "カラー": { max: 0, prev: 0, cur: 0 },
        "トップ": { max: 0, prev: 0, cur: 0 },
    };

    (master || []).forEach((cat) => {
        const axis: AxisKeyOC = cat?.name || "ベース";
        if (!buckets[axis]) return;
        (cat.items || []).forEach((item) => {
            (item.checkpoints || []).forEach((cp) => {
                const pts = cp.points ?? 0;
                buckets[axis].max += pts;
                const prev = getScore(previousMap, cp.code, cp.label);
                const cur = getScore(currentMap, cp.code, cp.label);
                buckets[axis].prev += Math.max(0, Math.min(pts, prev));
                buckets[axis].cur += Math.max(0, Math.min(pts, cur));
            });
        });
    });

    const maxBase = buckets["ベース"].max;
    const maxColor = buckets["カラー"].max;
    const maxTop = buckets["トップ"].max;
    const maxOverall = maxBase + maxColor + maxTop;

    const nationalBuckets: Record<AxisKeyOC, number> = {
        "ベース": pickFromMap(avgMap, ["ベース", "base"]) || buckets["ベース"].prev,
        "カラー": pickFromMap(avgMap, ["カラー", "color"]) || buckets["カラー"].prev,
        "トップ": pickFromMap(avgMap, ["トップ", "top"]) || buckets["トップ"].prev,
    };

    const nationalOverall = nationalBuckets["ベース"] + nationalBuckets["カラー"] + nationalBuckets["トップ"];
    const previousOverall = buckets["ベース"].prev + buckets["カラー"].prev + buckets["トップ"].prev;
    const currentOverall = buckets["ベース"].cur + buckets["カラー"].cur + buckets["トップ"].cur;

    const normalize = (value: number, max: number) =>
        max ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;

    const rows = [
        {
            axis: "ワンカラー総合",
            national: normalize(nationalOverall, maxOverall),
            previous: normalize(previousOverall, maxOverall),
            current: normalize(currentOverall, maxOverall),
            nationalRaw: nationalOverall,
            previousRaw: previousOverall,
            currentRaw: currentOverall,
            max: maxOverall,
        },
        {
            axis: "ベース",
            national: normalize(nationalBuckets["ベース"], maxBase),
            previous: normalize(buckets["ベース"].prev, maxBase),
            current: normalize(buckets["ベース"].cur, maxBase),
            nationalRaw: nationalBuckets["ベース"],
            previousRaw: buckets["ベース"].prev,
            currentRaw: buckets["ベース"].cur,
            max: maxBase,
        },
        {
            axis: "カラー",
            national: normalize(nationalBuckets["カラー"], maxColor),
            previous: normalize(buckets["カラー"].prev, maxColor),
            current: normalize(buckets["カラー"].cur, maxColor),
            nationalRaw: nationalBuckets["カラー"],
            previousRaw: buckets["カラー"].prev,
            currentRaw: buckets["カラー"].cur,
            max: maxColor,
        },
        {
            axis: "トップ",
            national: normalize(nationalBuckets["トップ"], maxTop),
            previous: normalize(buckets["トップ"].prev, maxTop),
            current: normalize(buckets["トップ"].cur, maxTop),
            nationalRaw: nationalBuckets["トップ"],
            previousRaw: buckets["トップ"].prev,
            currentRaw: buckets["トップ"].cur,
            max: maxTop,
        },
    ];

    return (
        <div className="relative h-[600px] overflow-hidden rounded-2xl border border-[#e8e9f4] bg-white">
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#e87674] via-white to-[#54b4bd]" />
            <div className="flex flex-col gap-2 px-6 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm font-semibold text-slate-700">グラフの名前</div>
                <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-600">
                    {legendItems.map((item) => (
                        <div key={item.label} className="flex items-center gap-2">
                            <span className="inline-flex h-2.5 w-8 rounded-full" style={{ backgroundColor: item.color }} />
                            <span>{item.label}</span>
                        </div>
                    ))}
                </div>
            </div>
            <div className="relative h-[540px] px-6 pb-20 pt-6">
                <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={rows} startAngle={90} endAngle={-270} margin={{ top: 24, right: 24, bottom: 24, left: 24 }}>
                        <PolarGrid gridType="polygon" radialLines polarRadius={[45, 90, 135, 180, 225]} stroke="#e6e9f5" />
                        <PolarAngleAxis dataKey="axis" tick={false} />
                        <PolarRadiusAxis domain={[0, 100]} tickCount={5} axisLine={false} tick={false} />
                        <Radar name="全国平均" dataKey="national" stroke="#64CBD3" strokeWidth={2} fill="#64CBD3" fillOpacity={0.18} dot={<NationalDot />} />
                        <Radar name="前回" dataKey="previous" stroke="#4075B5" strokeWidth={2} fill="#4075B5" fillOpacity={0.15} dot={<PreviousDot />} />
                        <Radar name="今回" dataKey="current" stroke="#F15C4B" strokeWidth={2} fill="#F15C4B" fillOpacity={0.18} dot={<CurrentDot />} />
                    </RadarChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0">
                    <div className="absolute left-1/2 -translate-x-1/2 text-center">
                        <div className="text-sm font-semibold text-[#2a8090]">ワンカラー総合</div>
                    </div>
                    <div className="absolute left-[72%] top-1/2 -translate-y-1/2 text-right">
                        <div className="text-sm font-semibold text-[#2a8090]" style={{ writingMode: "vertical-rl" }}>ベース</div>
                    </div>
                    <div className="absolute bottom-[5%] left-1/2 -translate-x-1/2 text-center">
                        <div className="text-sm font-semibold text-[#2a8090]">カラー</div>
                    </div>
                    <div className="absolute left-[26%] top-1/2 -translate-y-1/2 text-left">
                        <div className="text-sm font-semibold text-[#2a8090]" style={{ writingMode: "vertical-rl" }}>トップ</div>
                    </div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[10px] text-gray-500 top-[4%]">610</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[10px] text-gray-500 top-[12%]">488</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[10px] text-gray-500 top-[20%]">366</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[10px] text-gray-500 top-[30%]">244</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[10px] text-gray-500 top-[39%]">122</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[10px] text-gray-500 top-[55%]">42</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[10px] text-gray-500 top-[63%]">84</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[10px] text-gray-500 top-[71%]">126</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[10px] text-gray-500 top-[79%]">168</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[10px] text-gray-500 top-[88%]">210</div>
                    <div className="absolute top-[48.5%] -translate-y-1/2 text-[10px] text-gray-500 left-[28%]">140</div>
                    <div className="absolute top-[48.5%] -translate-y-1/2 text-[10px] text-gray-500 left-[32%]">112</div>
                    <div className="absolute top-[48.5%] -translate-y-1/2 text-[10px] text-gray-500 left-[36%]">84</div>
                    <div className="absolute top-[48.5%] -translate-y-1/2 text-[10px] text-gray-500 left-[40%]">56</div>
                    <div className="absolute top-[48.5%] -translate-y-1/2 text-[10px] text-gray-500 left-[45%]">28</div>
                    <div className="absolute top-[48.5%] -translate-y-1/2 text-[10px] text-gray-500 left-[49%]">0</div>
                    <div className="absolute top-[48.5%] -translate-y-1/2 text-[10px] text-gray-500 left-[54%]">52</div>
                    <div className="absolute top-[48.5%] -translate-y-1/2 text-[10px] text-gray-500 left-[58%]">104</div>
                    <div className="absolute top-[48.5%] -translate-y-1/2 text-[10px] text-gray-500 left-[62%]">156</div>
                    <div className="absolute top-[48.5%] -translate-y-1/2 text-[10px] text-gray-500 left-[66%]">208</div>
                    <div className="absolute top-[48.5%] -translate-y-1/2 text-[10px] text-gray-500 left-[70%]">260</div>
                </div>
            </div>
        </div>
    );
};

export default OneColorRadar;

