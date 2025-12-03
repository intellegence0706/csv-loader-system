import {
    Legend,
    PolarAngleAxis,
    PolarGrid,
    PolarRadiusAxis,
    Radar,
    RadarChart,
    ResponsiveContainer,
} from "recharts";

type AxisKeyTime = "合計タイム" | "オフ／フィル" | "ケア" | "ベース" | "カラー" | "トップ";

type TimeRadarProps = {
    avgData?: Record<string, any>;
    nationalFallback: number;
    previousTotal: number;
    currentTotal: number;
    averageDetailData?: Record<string, any>;
    previousDetailData?: Record<string, any>;
    currentDetailData?: Record<string, any>;
    timeRadarChartCurrent?: Record<string, any>;
    timeRadarChartPrevious?: Record<string, any>;
};

const axes: AxisKeyTime[] = ["合計タイム", "オフ／フィル", "ケア", "ベース", "カラー", "トップ"];

// Fixed maximum values for each axis (in seconds)
const FIXED_MAX_BY_AXIS: Record<AxisKeyTime, number> = {
    "合計タイム": 80 * 60,
    "オフ／フィル": 17 * 60,
    "ケア": 22 * 60,
    "ベース": 13 * 60,
    "カラー": 19 * 60,
    "トップ": 9 * 60,
};

const legendItems = [
    { label: "全国平均", color: "#64CBD3" },
    { label: "前回", color: "#4075B5" },
    { label: "今回", color: "#F15C4B" },
];

const formatSecondsToTime = (totalSeconds: number | undefined | null): string => {
    if (typeof totalSeconds !== "number" || !isFinite(totalSeconds)) return "—";
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.round(totalSeconds % 60);
    return `${minutes}分${seconds.toString().padStart(2, '0')}秒`;
};

const fmt1 = (n: number | undefined | null) => {
    if (n === null || n === undefined) return "—";
    if (typeof n === "number" && isFinite(n)) {
        return formatSecondsToTime(n);
    }
    return "—";
};

const formatScore = (n: number | undefined | null) => formatSecondsToTime(n);

const normalize = (value: number, max: number) => {
    if (!max) return 0;
    const ratio = (value / max) * 100;
    return Math.max(0, Math.min(100, ratio));
};

const labelPos = (axis: AxisKeyTime, cx: number, cy: number) => {
    if (axis === "合計タイム") return { x: cx, y: cy - 12, anchor: "middle" as const };
    if (axis === "オフ／フィル") return { x: cx + 10, y: cy + 4, anchor: "start" as const };
    if (axis === "ケア") return { x: cx + 10, y: cy + 16, anchor: "start" as const };
    if (axis === "ベース") return { x: cx, y: cy + 18, anchor: "middle" as const };
    if (axis === "カラー") return { x: cx - 10, y: cy + 18, anchor: "end" as const };
    if (axis === "トップ") return { x: cx - 10, y: cy + 4, anchor: "end" as const };
    return { x: cx, y: cy - 10, anchor: "middle" as const };
};

const Dot =
    (color: string, keyName: "nationalRaw" | "previousRaw" | "currentRaw") =>
        (props: any) => {
            const { cx, cy, payload } = props;
            if (typeof cx !== "number" || typeof cy !== "number") return null;
            const raw = payload?.[keyName];
            const axis = payload?.axis as AxisKeyTime;

            // Debug log
            if (axis === "合計タイム") {
                console.log(`Dot [${keyName}] at ${axis}:`, raw, "seconds =", fmt1(raw));
            }

            const { x, y, anchor } = labelPos(axis, cx, cy);
            const displayText = fmt1(raw);

            return (
                <g>
                    <circle cx={cx} cy={cy} r={4.5} fill={color} stroke="#ffffff" strokeWidth={1.8} />
                    <text x={x} y={y} textAnchor={anchor} fontSize={12} fontWeight={600} fill={color === "#64CBD3" ? "#2a8090" : color}>
                        {displayText}
                    </text>
                </g>
            );
        };

const NationalDot = Dot("#64CBD3", "nationalRaw");
const PreviousDot = Dot("#4075B5", "previousRaw");
const CurrentDot = Dot("#F15C4B", "currentRaw");

const pickAverageTimeScore = (avgData?: Record<string, any>, fallback = 0) => {
    if (avgData && typeof avgData === "object") {
        for (const [k, v] of Object.entries(avgData)) {
            if (k.includes("タイム") && k.includes("スコア")) {
                const n = Number(v);
                if (Number.isFinite(n) && n > 0) return n;
            }
        }
    }
    return fallback;
};

const normalizeKey = (input: string): string =>
    String(input ?? "")
        .replace(/[０-９Ａ-Ｚａ-ｚ]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xFEE0))
        .replace(/[‐‑–—−ーｰ－]/g, "-")
        .replace(/[\/()\[\]{}＜＞〈〉【】『』「」.,、\s\u3000]/g, "")
        .replace(/ワンカラー/g, "ワンカラ")
        .replace(/カラー/g, "カラ")
        .toLowerCase();

const sanitizeTime = (value: string): string =>
    value
        .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xFEE0))
        .replace(/ /g, "")
        .replace(/[:：]/g, ":")
        .replace(/\s+/g, "");

const parseNumericValue = (value: any): number | null => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
        const match = value.match(/-?\d+(?:\.\d+)?/);
        if (match) {
            const n = Number(match[0]);
            if (Number.isFinite(n)) return n;
        }
    }
    return null;
};

// Helper function to extract percentage value from radar chart data (SK~SP for current, SQ~SV for previous)
// Column order: SK=合計タイム, SL=オフ／フィル, SM=ケア, SN=ベース, SO=カラー, SP=トップ (current)
// Column order: SQ=合計タイム, SR=オフ／フィル, SS=ケア, ST=ベース, SU=カラー, SV=トップ (previous)
// These are already percentages, so use them directly
const getRadarPercentage = (map: Record<string, any> | undefined, categoryName: string): number => {
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
            const val = parseNumericValue(value);
            if (val !== null && val !== undefined && !isNaN(val)) {
                return Math.max(0, Math.min(100, val));
            }
        }
    }

    // Try partial match (key includes category or vice versa)
    for (const [key, value] of Object.entries(map)) {
        const normalizedKey = normalize(key);
        if (normalizedKey.includes(normalizedCategory) || normalizedCategory.includes(normalizedKey)) {
            const val = parseNumericValue(value);
            if (val !== null && val !== undefined && !isNaN(val)) {
                return Math.max(0, Math.min(100, val));
            }
        }
    }

    // Try specific aliases for each category
    const aliases: Record<AxisKeyTime, string[]> = {
        "合計タイム": ["合計タイム", "総合計タイム", "総合計", "両手総合計"],
        "オフ／フィル": ["オフ／フィル", "オフフィル", "オフ", "フィル"],
        "ケア": ["ケア"],
        "ベース": ["ベース", "ワンカラベース", "ワンカラー ベース"],
        "カラー": ["カラー", "ワンカラカラー", "ワンカラー カラー"],
        "トップ": ["トップ", "ワンカラトップ", "ワンカラー トップ"],
    };

    const categoryAliases = aliases[categoryName as AxisKeyTime] || [categoryName];
    for (const alias of categoryAliases) {
        const normalizedAlias = normalize(alias);
        for (const [key, value] of Object.entries(map)) {
            const normalizedKey = normalize(key);
            if (normalizedKey.includes(normalizedAlias) || normalizedAlias.includes(normalizedKey)) {
                const val = parseNumericValue(value);
                if (val !== null && val !== undefined && !isNaN(val)) {
                    return Math.max(0, Math.min(100, val));
                }
            }
        }
    }

    return 0;
};

const parseTimeToSeconds = (value: any): number => {
    if (typeof value === "number") return value;
    if (!value) return 0;
    const str = String(value)
        .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xFEE0))
        .replace(/\s+/g, "");
    const minMatch = str.match(/(\d+)分/);
    const secMatch = str.match(/(\d+)秒/);
    const minutes = minMatch ? parseInt(minMatch[1], 10) : 0;
    const seconds = secMatch ? parseInt(secMatch[1], 10) : 0;
    return minutes * 60 + seconds;
};

const combineTimeFragments = (entries: Array<{ key: string; value: any }>): number => {
    let minutes: number | null = null;
    let seconds: number | null = null;
    let fallbackTime = 0;

    for (const { key, value } of entries) {
        if (value === null || value === undefined) continue;
        const str = String(value).trim();
        if (!str) continue;

        const normalized = sanitizeTime(str);
        if (normalized.includes("分") && normalized.includes("秒")) {
            fallbackTime = parseTimeToSeconds(normalized);
        }

        const num = parseNumericValue(value);
        if (minutes === null && (/分/.test(key) || /minute/i.test(key))) {
            if (num !== null) minutes = num;
        }
        if (seconds === null && (/秒/.test(key) || /second/i.test(key))) {
            if (num !== null) seconds = num;
        }

        if (!fallbackTime) fallbackTime = parseTimeToSeconds(normalized || str);
    }

    if (minutes !== null || seconds !== null) {
        const mm = Math.max(0, minutes ?? 0);
        const ss = Math.max(0, seconds ?? 0);
        return mm * 60 + ss;
    }

    return fallbackTime;
};

const findValueInData = (data: Record<string, any> | undefined, aliases: string[]): number => {
    if (!data) return 0;

    const entries: Array<{ key: string; value: any }> = [];

    for (const [key, value] of Object.entries(data)) {
        const nk = normalizeKey(key).replace(/ケア評価|ワンカラ評価|タイム評価/g, "");
        if (aliases.some(alias => nk.includes(normalizeKey(alias)))) {
            entries.push({ key, value });
        }
    }

    if (entries.length === 0) return 0;

    return combineTimeFragments(entries);
};

export default function TimeRadar({
    avgData,
    nationalFallback,
    previousTotal,
    currentTotal,
    averageDetailData,
    previousDetailData,
    currentDetailData,
    timeRadarChartCurrent,
    timeRadarChartPrevious
}: TimeRadarProps) {
    // Data is already in percentage format (0-100), use it directly from SK~SP (current) and SQ~SV (previous)
    // Column order: SK=合計タイム, SL=オフ／フィル, SM=ケア, SN=ベース, SO=カラー, SP=トップ (current)
    // Column order: SQ=合計タイム, SR=オフ／フィル, SS=ケア, ST=ベース, SU=カラー, SV=トップ (previous)
    const clampPercentage = (value: number): number => {
        return Math.max(0, Math.min(100, value));
    };

    const rows = axes.map((axis) => {
        const currentPercent = clampPercentage(getRadarPercentage(timeRadarChartCurrent, axis));
        const previousPercent = clampPercentage(getRadarPercentage(timeRadarChartPrevious, axis));
        // For national average, use averageDetailData or fallback to 0
        const nationalPercent = clampPercentage(getRadarPercentage(averageDetailData, axis));

        return {
            axis,
            national: nationalPercent,
            previous: previousPercent,
            current: currentPercent,
            nationalRaw: nationalPercent,
            previousRaw: previousPercent,
            currentRaw: currentPercent,
            max: 100,
        };
    });

    return (
        <div className="relative h-[700px] overflow-hidden rounded-2xl border border-[#e8e9f4] bg-white">
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
            <div className="relative h-[540px] px-6 pb-12 pt-6">
                <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={rows} startAngle={90} endAngle={-270} margin={{ top: 24, right: 24, bottom: 24, left: 24 }} outerRadius="85%">
                        <PolarGrid gridType="polygon" radialLines stroke="#e6e9f5" />
                        <PolarAngleAxis dataKey="axis" tick={false} />
                        <PolarRadiusAxis angle={90} domain={[0, 100]} tickCount={11} axisLine={false} tick={false} />
                        <Radar name="前回" dataKey="previous" stroke="#4075B5" strokeWidth={2} fill="#4075B5" fillOpacity={0.15} dot />
                        <Radar name="今回" dataKey="current" stroke="#F15C4B" strokeWidth={2} fill="#F15C4B" fillOpacity={0.18} dot />
                    </RadarChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0">

                    <div className="absolute left-1/2 top-[8%] -translate-x-1/2 text-center">
                        <div className="text-sm font-semibold text-[#2a8090]">合計タイム</div>
                    </div>
                    <div className="absolute left-[67%] top-[30%] -translate-y-1/2 text-left">
                        <div className="text-sm font-semibold text-[#2a8090]">オフ／フィル</div>
                    </div>
                    <div className="absolute left-[67%] bottom-[32%] -translate-y-1/2 text-left">
                        <div className="text-sm font-semibold text-[#2a8090]">ケア</div>
                    </div>
                    <div className="absolute bottom-[12%] left-1/2 -translate-x-1/2 text-center">
                        <div className="text-sm font-semibold text-[#2a8090]">ワンカラー（ベース）</div>
                    </div>
                    <div className="absolute left-[20%] bottom-[32%] -translate-y-1/2 text-right">
                        <div className="text-sm font-semibold text-[#2a8090]">ワンカラー（カラー）</div>
                    </div>
                    <div className="absolute left-[20%] top-[31%] -translate-y-1/2 text-right">
                        <div className="text-sm font-semibold text-[#2a8090]">ワンカラー（トップ）</div>
                    </div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[12%]">100</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[18.5%]">90</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[21.5%]">80</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[25%]">70</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[28%]">60</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[31%]">50</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[34%]">40</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[37%]">30</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[40%]">20</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">10</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[47%]">0</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[50.5%]">10</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[53.5%]">20</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[56.5%]">30</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[59.5%]">40</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[62.5%]">50</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[65.5%]">60</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[69%]">70</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[72%]">80</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[75.5%]">90</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[82%]">100</div>
                    <div className="absolute left-[34%] -translate-x-1/2 text-[7px] text-gray-500 top-[30%]">100</div>
                    <div className="absolute left-[36.5%] -translate-x-1/2 text-[7px] text-gray-500 top-[32%]">90</div>
                    <div className="absolute left-[38%] -translate-x-1/2 text-[7px] text-gray-500 top-[34%]">80</div>
                    <div className="absolute left-[39.5%] -translate-x-1/2 text-[7px] text-gray-500 top-[36%]">70</div>
                    <div className="absolute left-[41%] -translate-x-1/2 text-[7px] text-gray-500 top-[37.5%]">60</div>
                    <div className="absolute left-[42.5%] -translate-x-1/2 text-[7px] text-gray-500 top-[39%]">50</div>
                    <div className="absolute left-[44%] -translate-x-1/2 text-[7px] text-gray-500 top-[40.5%]">40</div>
                    <div className="absolute left-[45.5%] -translate-x-1/2 text-[7px] text-gray-500 top-[42.5%]">30</div>
                    <div className="absolute left-[47%] -translate-x-1/2 text-[7px] text-gray-500 top-[44%]">20</div>
                    <div className="absolute left-[48.5%] -translate-x-1/2 text-[7px] text-gray-500 top-[45.5%]">10</div>
                    <div className="absolute left-[51%] -translate-x-1/2 text-[7px] text-gray-500 top-[48.5%]">10</div>
                    <div className="absolute left-[52.5%] -translate-x-1/2 text-[7px] text-gray-500 top-[50.5%]">20</div>
                    <div className="absolute left-[54%] -translate-x-1/2 text-[7px] text-gray-500 top-[52%]">30</div>
                    <div className="absolute left-[55.5%] -translate-x-1/2 text-[7px] text-gray-500 top-[53.5%]">40</div>
                    <div className="absolute left-[57%] -translate-x-1/2 text-[7px] text-gray-500 top-[55.5%]">50</div>
                    <div className="absolute left-[58.5%] -translate-x-1/2 text-[7px] text-gray-500 top-[57%]">60</div>
                    <div className="absolute left-[60%] -translate-x-1/2 text-[7px] text-gray-500 top-[58.5%]">70</div>
                    <div className="absolute left-[61.5%] -translate-x-1/2 text-[7px] text-gray-500 top-[60%]">80</div>
                    <div className="absolute left-[63%] -translate-x-1/2 text-[7px] text-gray-500 top-[61.5%]">90</div>
                    <div className="absolute left-[65.5%] -translate-x-1/2 text-[7px] text-gray-500 top-[64%]">100</div>
                    <div className="absolute left-[34%] -translate-x-1/2 text-[7px] text-gray-500 top-[64%]">100</div>
                    <div className="absolute left-[37%] -translate-x-1/2 text-[7px] text-gray-500 top-[62%]">90</div>
                    <div className="absolute left-[38.5%] -translate-x-1/2 text-[7px] text-gray-500 top-[60.5%]">80</div>
                    <div className="absolute left-[40%] -translate-x-1/2 text-[7px] text-gray-500 top-[59%]">70</div>
                    <div className="absolute left-[41.5%] -translate-x-1/2 text-[7px] text-gray-500 top-[57%]">60</div>
                    <div className="absolute left-[43%] -translate-x-1/2 text-[7px] text-gray-500 top-[55%]">50</div>
                    <div className="absolute left-[44.5%] -translate-x-1/2 text-[7px] text-gray-500 top-[53.5%]">40</div>
                    <div className="absolute left-[46%] -translate-x-1/2 text-[7px] text-gray-500 top-[52%]">30</div>
                    <div className="absolute left-[47.5%] -translate-x-1/2 text-[7px] text-gray-500 top-[50.5%]">20</div>
                    <div className="absolute left-[49%] -translate-x-1/2 text-[7px] text-gray-500 top-[49%]">10</div>
                    <div className="absolute left-[51.5%] -translate-x-1/2 text-[7px] text-gray-500 top-[46%]">10</div>
                    <div className="absolute left-[53%] -translate-x-1/2 text-[7px] text-gray-500 top-[44%]">20</div>
                    <div className="absolute left-[54.5%] -translate-x-1/2 text-[7px] text-gray-500 top-[42%]">30</div>
                    <div className="absolute left-[56%] -translate-x-1/2 text-[7px] text-gray-500 top-[40.5%]">40</div>
                    <div className="absolute left-[57.5%] -translate-x-1/2 text-[7px] text-gray-500 top-[39%]">50</div>
                    <div className="absolute left-[59%] -translate-x-1/2 text-[7px] text-gray-500 top-[37.5%]">60</div>
                    <div className="absolute left-[60.5%] -translate-x-1/2 text-[7px] text-gray-500 top-[35.5%]">70</div>
                    <div className="absolute left-[62%] -translate-x-1/2 text-[7px] text-gray-500 top-[34%]">80</div>
                    <div className="absolute left-[63.5%] -translate-x-1/2 text-[7px] text-gray-500 top-[32%]">90</div>
                    <div className="absolute left-[65.5%] -translate-x-1/2 text-[7px] text-gray-500 top-[29%]">100</div>

                </div>
            </div>
        </div >
    );
}
