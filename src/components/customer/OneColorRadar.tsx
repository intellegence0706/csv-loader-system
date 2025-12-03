import {
    PolarAngleAxis,
    PolarGrid,
    PolarRadiusAxis,
    Radar,
    RadarChart,
    ResponsiveContainer,
} from "recharts";

type JsonMap = Record<string, number | string | null | undefined>;

type AxisKeyOC = "ベース" | "カラー" | "トップ";
type OCCheckpoint = { code: string; label: string; points: number; highlight?: boolean; starred?: boolean };
type OCItem = { id: number; title: string; required?: boolean; checkpoints: OCCheckpoint[] };
type OCCategory = { name: AxisKeyOC; items: OCItem[] };

type OneColorRadarProps = {
    master: OCCategory[];
    oneColorScoreCurrentData?: JsonMap;
    oneColorScorePreviousData?: JsonMap;
    avgData?: JsonMap;
    oneColorRadarCurrentData?: JsonMap;
    oneColorRadarPreviousData?: JsonMap;
    oneColorRadarAverageData?: JsonMap;
};

const legendItems = [
    { label: "全国平均", color: "#64CBD3" },
    { label: "前回", color: "#4075B5" },
    { label: "今回", color: "#F15C4B" },
];

type BucketTotals = { max: number; prev: number; cur: number };

const ensureMap = (m: any): Record<string, any> => {
    if (!m) return {};
    if (typeof m === "string") {
        try {
            const p = JSON.parse(m);
            return p && typeof p === "object" ? p : {};
        } catch {
            return {};
        }
    }
    return typeof m === "object" ? (m as Record<string, any>) : {};
};

const normalizeKey = (s: string) =>
    (typeof s === "string" ? s : String(s))
        .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xFEE0))
        .replace(/[‐‑–—−ーｰ－]/g, "-")
        .replace(/[［］【】\[\]\(\)\s\u3000]/g, "");

// Helper function to parse numbers
function num(v: unknown): number | null {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
        const trimmed = v.trim();
        if (!trimmed) return null;
        const normalized = trimmed.replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xFEE0)).replace(/[,　\s]/g, "");
        const digitsOnly = normalized.replace(/[^0-9+\-\.]/g, "");
        if (!digitsOnly) return null;
        const parsed = Number(digitsOnly);
        if (!Number.isNaN(parsed) && Number.isFinite(parsed)) return parsed;
    }
    return null;
}

// Helper function to extract percentage value from radar chart data (PO~PR for current, PS~PV for previous)
// Column order: PO=ワンカラー総合, PP=ベース, PR=カラー (current) - Note: トップ might be missing or in different column
// Column order: PS=ワンカラー総合, PT=ベース, PU=カラー, PV=トップ (previous)
// These are already percentages, so use them directly
const getRadarValue = (map: JsonMap | undefined, categoryName: string): number => {
    if (!map) return 0;

    // Normalize function for better matching
    const normalize = (s: string) =>
        (typeof s === "string" ? s : String(s))
            .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xFEE0))
            .replace(/[‐‑–—−ーｰ－]/g, "-")
            .replace(/[［］【】\[\]\(\)\s\u3000]/g, "")
            .toLowerCase();

    const normalizedCategory = normalize(categoryName);

    // Try exact match first
    for (const [key, value] of Object.entries(map)) {
        const normalizedKey = normalize(key);
        if (normalizedKey === normalizedCategory) {
            const val = num(value);
            if (val !== null && val !== undefined && !isNaN(val)) {
                return Math.max(0, Math.min(100, val));
            }
        }
    }

    // Try partial match (key includes category or vice versa)
    for (const [key, value] of Object.entries(map)) {
        const normalizedKey = normalize(key);
        if (normalizedKey.includes(normalizedCategory) || normalizedCategory.includes(normalizedKey)) {
            const val = num(value);
            if (val !== null && val !== undefined && !isNaN(val)) {
                return Math.max(0, Math.min(100, val));
            }
        }
    }

    // Try specific aliases for each category
    const aliases: Record<string, string[]> = {
        "ワンカラー総合": ["ワンカラー総合", "総合", "ワンカラ", "onecolor総合"],
        "ベース": ["ベース", "base"],
        "カラー": ["カラー", "color", "カラ"],
        "トップ": ["トップ", "top"],
    };

    const categoryAliases = aliases[categoryName] || [categoryName];
    for (const alias of categoryAliases) {
        const normalizedAlias = normalize(alias);
        for (const [key, value] of Object.entries(map)) {
            const normalizedKey = normalize(key);
            if (normalizedKey.includes(normalizedAlias) || normalizedAlias.includes(normalizedKey)) {
                const val = num(value);
                if (val !== null && val !== undefined && !isNaN(val)) {
                    return Math.max(0, Math.min(100, val));
                }
            }
        }
    }

    return 0;
};

const OneColorRadar = ({
    master,
    oneColorScoreCurrentData,
    oneColorScorePreviousData,
    avgData,
    oneColorRadarCurrentData,
    oneColorRadarPreviousData,
    oneColorRadarAverageData,
}: OneColorRadarProps) => {
    // Data is already in percentage format (0-100), use it directly from PO~PR (current) and PS~PV (previous)
    const clampPercentage = (value: number): number => {
        return Math.max(0, Math.min(100, value));
    };

    const rows = [
        {
            axis: "ワンカラー総合",
            national: clampPercentage(getRadarValue(oneColorRadarAverageData || avgData, "ワンカラー総合")),
            previous: clampPercentage(getRadarValue(oneColorRadarPreviousData, "ワンカラー総合")),
            current: clampPercentage(getRadarValue(oneColorRadarCurrentData, "ワンカラー総合")),
            nationalRaw: clampPercentage(getRadarValue(oneColorRadarAverageData || avgData, "ワンカラー総合")),
            previousRaw: clampPercentage(getRadarValue(oneColorRadarPreviousData, "ワンカラー総合")),
            currentRaw: clampPercentage(getRadarValue(oneColorRadarCurrentData, "ワンカラー総合")),
            max: 100,
        },
        {
            axis: "ベース",
            national: clampPercentage(getRadarValue(oneColorRadarAverageData || avgData, "ベース")),
            previous: clampPercentage(getRadarValue(oneColorRadarPreviousData, "ベース")),
            current: clampPercentage(getRadarValue(oneColorRadarCurrentData, "ベース")),
            nationalRaw: clampPercentage(getRadarValue(oneColorRadarAverageData || avgData, "ベース")),
            previousRaw: clampPercentage(getRadarValue(oneColorRadarPreviousData, "ベース")),
            currentRaw: clampPercentage(getRadarValue(oneColorRadarCurrentData, "ベース")),
            max: 100,
        },
        {
            axis: "カラー",
            national: clampPercentage(getRadarValue(oneColorRadarAverageData || avgData, "カラー")),
            previous: clampPercentage(getRadarValue(oneColorRadarPreviousData, "カラー")),
            current: clampPercentage(getRadarValue(oneColorRadarCurrentData, "カラー")),
            nationalRaw: clampPercentage(getRadarValue(oneColorRadarAverageData || avgData, "カラー")),
            previousRaw: clampPercentage(getRadarValue(oneColorRadarPreviousData, "カラー")),
            currentRaw: clampPercentage(getRadarValue(oneColorRadarCurrentData, "カラー")),
            max: 100,
        },
        {
            axis: "トップ",
            national: clampPercentage(getRadarValue(oneColorRadarAverageData || avgData, "トップ")),
            previous: clampPercentage(getRadarValue(oneColorRadarPreviousData, "トップ")),
            current: clampPercentage(getRadarValue(oneColorRadarCurrentData, "トップ")),
            nationalRaw: clampPercentage(getRadarValue(oneColorRadarAverageData || avgData, "トップ")),
            previousRaw: clampPercentage(getRadarValue(oneColorRadarPreviousData, "トップ")),
            currentRaw: clampPercentage(getRadarValue(oneColorRadarCurrentData, "トップ")),
            max: 100,
        },
    ];

    const fmt1 = (n: number | undefined | null) =>
        typeof n === "number" ? n.toLocaleString(undefined, { maximumFractionDigits: 1 }) : "";

    const labelPos = (axis: string, cx: number, cy: number) => {
        if (axis === "ワンカラー総合") return { x: cx, y: cy - 10, anchor: "middle" as const };
        if (axis === "ベース") return { x: cx + 10, y: cy + 4, anchor: "start" as const };
        if (axis === "カラー") return { x: cx, y: cy + 14, anchor: "middle" as const };
        if (axis === "トップ") return { x: cx - 10, y: cy + 4, anchor: "end" as const };
        return { x: cx, y: cy - 10, anchor: "middle" as const };
    };

    const Dot = (color: string, keyName: "nationalRaw" | "previousRaw" | "currentRaw") =>
        (props: any) => {
            const { cx, cy, payload } = props;
            if (typeof cx !== "number" || typeof cy !== "number") return null;
            const raw = payload?.[keyName];
            const { x, y, anchor } = labelPos(payload?.axis, cx, cy);
            return (
                <g>
                    <circle cx={cx} cy={cy} r={4.5} fill={color} stroke="#ffffff" strokeWidth={1.8} />
                    <text
                        x={x}
                        y={y}
                        textAnchor={anchor}
                        fontSize={12}
                        fontWeight={600}
                        fill={color === "#64CBD3" ? "#2a8090" : color}
                    >
                        {fmt1(raw)}
                    </text>
                </g>
            );
        };

    const NationalDot = Dot("#64CBD3", "nationalRaw");
    const PreviousDot = Dot("#4075B5", "previousRaw");
    const CurrentDot = Dot("#F15C4B", "currentRaw");

    return (
        <div id="pdf-onecolor-radar" className="relative h-[600px] overflow-hidden rounded-2xl border border-[#e8e9f4] bg-white">
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#e87674] via-white to-[#54b4bd]" />
            <div className="flex flex-col gap-2 px-6 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm font-semibold text-slate-700">グラフの名前</div>
                <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-600">
                    {legendItems.map((item) => (
                        <div key={item.label} className="flex items-center gap-2">
                            <span
                                className="inline-flex h-2.5 w-8 rounded-full"
                                style={{ backgroundColor: item.color }}
                            />
                            <span>{item.label}</span>
                        </div>
                    ))}
                </div>
            </div>
            <div className="relative h-[540px] px-6 pb-20 pt-6">
                <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={rows} startAngle={90} endAngle={-270} margin={{ top: 24, right: 24, bottom: 24, left: 24 }} outerRadius="85%">
                        <PolarGrid gridType="polygon" radialLines stroke="#e6e9f5" />
                        <PolarAngleAxis dataKey="axis" tick={false} />
                        <PolarRadiusAxis angle={90} domain={[0, 100]} tickCount={11} axisLine={false} tick={false} />
                        <Radar
                            name="全国平均"
                            dataKey="national"
                            stroke="#64CBD3"
                            strokeWidth={2}
                            fill="#64CBD3"
                            fillOpacity={0.18}
                            dot={<NationalDot />}
                        />
                        <Radar
                            name="前回"
                            dataKey="previous"
                            stroke="#4075B5"
                            strokeWidth={2}
                            fill="#4075B5"
                            fillOpacity={0.15}
                            dot={<PreviousDot />}
                        />
                        <Radar
                            name="今回"
                            dataKey="current"
                            stroke="#F15C4B"
                            strokeWidth={2}
                            fill="#F15C4B"
                            fillOpacity={0.18}
                            dot={<CurrentDot />}
                        />
                    </RadarChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0">
                    <div className="absolute top-[8%] left-1/2 -translate-x-1/2 text-center">
                        <div className="text-sm font-semibold text-[#2a8090]">ワンカラー総合</div>
                    </div>
                    <div className="absolute left-[67%] top-[45%] -translate-y-1/2 text-right">
                        <div className="text-sm font-semibold text-[#2a8090]" style={{ writingMode: "vertical-rl" }}>
                            ベース
                        </div>
                    </div>
                    <div className="absolute bottom-[19%] left-1/2 -translate-x-1/2 text-center">
                        <div className="text-sm font-semibold text-[#2a8090]">カラー</div>
                    </div>
                    <div className="absolute left-[31%] top-[45%] -translate-y-1/2 text-left">
                        <div className="text-sm font-semibold text-[#2a8090]" style={{ writingMode: "vertical-rl" }}>
                            トップ
                        </div>
                    </div>
                </div>
                <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[12%]">100</div>
                <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[15.5%]">90</div>
                <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[18.5%]">80</div>
                <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[21.5%]">70</div>
                <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[25%]">60</div>
                <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[28%]">50</div>
                <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[31%]">40</div>
                <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[34%]">30</div>
                <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[37%]">20</div>
                <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[40%]">10</div>
                <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">0</div>
                <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[47.5%]">10</div>
                <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[50.5%]">20</div>
                <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[53.5%]">30</div>
                <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[56.5%]">40</div>
                <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[59.5%]">50</div>
                <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[62.5%]">60</div>
                <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[65.5%]">70</div>
                <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[69%]">80</div>
                <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[72%]">90</div>
                <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[75.5%]">100</div>
                <div className="absolute left-[33.5%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">100</div>
                <div className="absolute left-[36%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">90</div>
                <div className="absolute left-[37.5%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">80</div>
                <div className="absolute left-[39%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">70</div>
                <div className="absolute left-[40.5%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">60</div>
                <div className="absolute left-[42%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">50</div>
                <div className="absolute left-[43.5%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">40</div>
                <div className="absolute left-[45%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">30</div>
                <div className="absolute left-[46.5%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">20</div>
                <div className="absolute left-[48%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">10</div>
                <div className="absolute left-[50%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">0</div>
                <div className="absolute left-[52%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">10</div>
                <div className="absolute left-[53%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">20</div>
                <div className="absolute left-[54.5%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">30</div>
                <div className="absolute left-[56%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">40</div>
                <div className="absolute left-[57.5%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">50</div>
                <div className="absolute left-[59%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">60</div>
                <div className="absolute left-[60.5%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">70</div>
                <div className="absolute left-[62.5%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">80</div>
                <div className="absolute left-[64%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">90</div>
                <div className="absolute left-[66.5%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">100</div>

            </div>
        </div>
    );
};

export default OneColorRadar;
