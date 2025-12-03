import {
    PolarAngleAxis,
    PolarGrid,
    PolarRadiusAxis,
    Radar,
    RadarChart,
    ResponsiveContainer,
} from "recharts";

type JsonMap = Record<string, number | string | null | undefined>;

type CareCheckpoint = { code: string; label: string; points?: number; starred?: boolean };
type CareItem = { id: number; title: string; required?: boolean; checkpoints: CareCheckpoint[] };
type CareCategory = { name: string; items: CareItem[] };

type CareRadarProps = {
    master: CareCategory[];
    careScoreCurrentData?: JsonMap;
    careScorePreviousData?: JsonMap;
    careRadarAverageData?: JsonMap;
    careRadarPreviousData?: JsonMap;
    careRadarCurrentData?: JsonMap;
    avgData?: JsonMap;
};

const legendItems = [
    { label: "全国平均", color: "#64CBD3" },
    { label: "前回", color: "#4075B5" },
    { label: "今回", color: "#F15C4B" },
];

// Helper function to convert full-width to half-width digits
function toHalfWidthDigits(s: string): string {
    return s.replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xFEE0));
}

// Helper function to parse numbers
function num(v: unknown): number | null {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
        const trimmed = v.trim();
        if (!trimmed) return null;
        const normalized = toHalfWidthDigits(trimmed).replace(/[,　\s]/g, "");
        const digitsOnly = normalized.replace(/[^0-9+\-\.]/g, "");
        if (!digitsOnly) return null;
        const parsed = Number(digitsOnly);
        if (!Number.isNaN(parsed) && Number.isFinite(parsed)) return parsed;
    }
    return null;
}

const CareRadar = ({
    master,
    careScoreCurrentData,
    careScorePreviousData,
    careRadarAverageData,
    careRadarPreviousData,
    careRadarCurrentData,
    avgData,
}: CareRadarProps) => {
    // Extract percentage values directly from radar chart data (GG~GJ for current, GK~GN for previous)
    // Column order: GG=ケア総合, GH=オフ／フィル, GI=ファイル, GJ=プレパレーション (current)
    // Column order: GK=ケア総合, GL=オフ／フィル, GM=ファイル, GN=プレパレーション (previous)
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
            "ケア総合": ["ケア総合", "総合", "ケア", "care総合"],
            "オフ／フィル": ["オフ／フィル", "オフフィル", "オフ", "フィル"],
            "ファイル": ["ファイル", "file"],
            "プレパレーション": ["プレパレーション", "プレパ", "preparation", "prep"],
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

    // Calculate max values for display labels (using score data for denominators)
    const ensureCareMap = (m: any): Record<string, any> => {
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

    let curBlob = ensureCareMap(careScoreCurrentData);
    let prevBlob = ensureCareMap(careScorePreviousData);

    const normalizeKey = (s: string) =>
        (typeof s === "string" ? s : String(s))
            .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xFEE0))
            .replace(/[‐‑–—−ーｰ－]/g, "-")
            .replace(/[［］【】\[\]\(\)\s\u3000]/g, "");

    const scoreFrom = (map: Record<string, any>, code: string, label: string) => {
        if (!map) return 0;
        const nCode = normalizeKey(code || "");
        const nCodeA = normalizeKey(`[ケア] ${code}`);
        const nCodeB = normalizeKey(`ケア${code}`);
        const nLabel = normalizeKey(label || "");
        for (const [k, v] of Object.entries(map)) {
            const nk = normalizeKey(k);
            if (nk.includes(nCode) || nk.includes(nCodeA) || nk.includes(nCodeB) || nk.includes(nLabel)) {
                const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
                return Number.isFinite(n) ? n : 0;
            }
        }
        return 0;
    };

    type BucketKey = "オフ／フィル" | "ファイル" | "プレパレーション";
    const bucketForCode = (code: string, fallbackCategory?: string): BucketKey | undefined => {
        const m = String(code || "").match(/^(\d{1,2})-/);
        if (m) {
            const major = parseInt(m[1], 10);
            if (major >= 1 && major <= 2) return "オフ／フィル";
            if (major >= 3 && major <= 6) return "ファイル";
            if (major >= 7 && major <= 13) return "プレパレーション";
        }
        if (fallbackCategory?.includes("オフ")) return "オフ／フィル";
        if (fallbackCategory?.includes("ファイル")) return "ファイル";
        if (fallbackCategory?.includes("プレパレーション")) return "プレパレーション";
        return undefined;
    };

    const bucketTotals: Record<BucketKey, { max: number }> = {
        "オフ／フィル": { max: 0 },
        "ファイル": { max: 0 },
        "プレパレーション": { max: 0 },
    };

    master.forEach((cat) => {
        cat.items.forEach((it) => {
            it.checkpoints.forEach((cp) => {
                const pts = cp.points ?? 0;
                const bucket = bucketForCode(cp.code, cat.name);
                if (!bucket) return;
                bucketTotals[bucket].max += pts;
            });
        });
    });

    const maxOverall = bucketTotals["オフ／フィル"].max + bucketTotals["ファイル"].max + bucketTotals["プレパレーション"].max;
    const maxOffFill = bucketTotals["オフ／フィル"].max;
    const maxFile = bucketTotals["ファイル"].max;
    const maxPrep = bucketTotals["プレパレーション"].max;

    // Data is already in percentage format (0-100), use it directly
    // Ensure values are within 0-100 range
    const clampPercentage = (value: number): number => {
        return Math.max(0, Math.min(100, value));
    };

    const radarRows = [
        {
            axis: "ケア総合",
            national: clampPercentage(getRadarValue(careRadarAverageData || avgData, "ケア総合")),
            previous: clampPercentage(getRadarValue(careRadarPreviousData, "ケア総合")),
            current: clampPercentage(getRadarValue(careRadarCurrentData, "ケア総合")),
            max: maxOverall,
        },
        {
            axis: "オフ／フィル",
            national: clampPercentage(getRadarValue(careRadarAverageData || avgData, "オフ／フィル")),
            previous: clampPercentage(getRadarValue(careRadarPreviousData, "オフ／フィル")),
            current: clampPercentage(getRadarValue(careRadarCurrentData, "オフ／フィル")),
            max: maxOffFill,
        },
        {
            axis: "ファイル",
            national: clampPercentage(getRadarValue(careRadarAverageData || avgData, "ファイル")),
            previous: clampPercentage(getRadarValue(careRadarPreviousData, "ファイル")),
            current: clampPercentage(getRadarValue(careRadarCurrentData, "ファイル")),
            max: maxFile,
        },
        {
            axis: "プレパレーション",
            national: clampPercentage(getRadarValue(careRadarAverageData || avgData, "プレパレーション")),
            previous: clampPercentage(getRadarValue(careRadarPreviousData, "プレパレーション")),
            current: clampPercentage(getRadarValue(careRadarCurrentData, "プレパレーション")),
            max: maxPrep,
        },
    ];

    const labelPositionForAxis = (axis: string, cx: number, cy: number) => {
        if (axis === "ケア総合") return { x: cx, y: cy - 12, anchor: "middle" as const };
        if (axis === "オフ／フィル") return { x: cx + 10, y: cy + 4, anchor: "start" as const };
        if (axis === "ファイル") return { x: cx, y: cy + 14, anchor: "middle" as const };
        if (axis === "プレパレーション") return { x: cx - 10, y: cy + 4, anchor: "end" as const };
        return { x: cx, y: cy - 10, anchor: "middle" as const };
    };

    const renderCurrentDot = (props: any) => {
        const { cx, cy, payload } = props;
        if (typeof cx !== "number" || typeof cy !== "number") return null;
        const { x, y, anchor } = labelPositionForAxis(payload?.axis, cx, cy);
        return (
            <g>
                <circle cx={cx} cy={cy} r={4.5} fill="#F15C4B" stroke="#ffffff" strokeWidth={1.8} />
            </g>
        );
    };

    const renderPreviousDot = (props: any) => {
        const { cx, cy, payload } = props;
        if (typeof cx !== "number" || typeof cy !== "number") return null;
        const { x, y, anchor } = labelPositionForAxis(payload?.axis, cx, cy);
        return (
            <g>
                <circle cx={cx} cy={cy} r={4.5} fill="#4075B5" stroke="#ffffff" strokeWidth={1.8} />
            </g>
        );
    };

    const renderNationalDot = (props: any) => {
        const { cx, cy, payload } = props;
        if (typeof cx !== "number" || typeof cy !== "number") return null;
        const { x, y, anchor } = labelPositionForAxis(payload?.axis, cx, cy);
        return (
            <g>
                <circle cx={cx} cy={cy} r={4.5} fill="#64CBD3" stroke="#ffffff" strokeWidth={1.8} />
            </g>
        );
    };

    return (
        <div id="pdf-care-radar" className="relative h-[550px] overflow-hidden rounded-2xl border border-[#e8e9f4] bg-white">
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#e87674] via-white to-[#54b4bd]" />
            <div className="flex flex-col gap-2 px-6 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="text-sm font-semibold text-slate-700">グラフの名前</div>
                </div>
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
            <div className="relative h-[500px] px-6 pb-12 pt-6">
                <ResponsiveContainer width="100%" height="100%">
                    <RadarChart
                        data={radarRows}
                        startAngle={90}
                        endAngle={-270}
                        margin={{ top: 24, right: 24, bottom: 24, left: 24 }}
                        outerRadius="85%"
                    >
                        <PolarGrid
                            gridType="polygon"
                            radialLines={true}
                            stroke="#e6e9f5"
                        />
                        <PolarAngleAxis dataKey="axis" tick={false} />
                        <PolarRadiusAxis angle={90} domain={[0, 100]} tickCount={11} axisLine={false} tick={false} />
                        <Radar
                            name="全国平均"
                            dataKey="national"
                            stroke="#64CBD3"
                            strokeWidth={2}
                            fill="#64CBD3"
                            fillOpacity={0.18}
                            dot={renderNationalDot}
                        />
                        <Radar
                            name="前回"
                            dataKey="previous"
                            stroke="#4075B5"
                            strokeWidth={2}
                            fill="#4075B5"
                            fillOpacity={0.15}
                            dot={renderPreviousDot}
                        />
                        <Radar
                            name="今回"
                            dataKey="current"
                            stroke="#F15C4B"
                            strokeWidth={2}
                            fill="#F15C4B"
                            fillOpacity={0.18}
                            dot={renderCurrentDot}
                        />
                    </RadarChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0">
                    <div className="absolute left-1/2 top-[8%] -translate-x-1/2 text-center">
                        <div className="text-sm font-semibold text-[#2a8090]">ケア総合</div>
                    </div>
                    <div className="absolute left-[67%] top-1/2 -translate-y-1/2 text-right">
                        <div className="text-sm font-semibold text-[#2a8090]" style={{ writingMode: "vertical-rl" }}>
                            オフ／フィル
                        </div>
                    </div>
                    <div className="absolute bottom-[12%] left-1/2 -translate-x-1/2 text-center">
                        <div className="text-sm font-semibold text-[#2a8090]">ファイル</div>
                    </div>
                    <div className="absolute left-[30%] top-1/2 -translate-y-1/2 text-left">
                        <div className="text-sm font-semibold text-[#2a8090]" style={{ writingMode: "vertical-rl" }}>
                            プレパレーション
                        </div>
                    </div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[13%]">100</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[16.5%]">90</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[20%]">80</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[23.5%]">70</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[27%]">60</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[30%]">50</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[33%]">40</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[36%]">30</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[39.5%]">20</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[42.5%]">10</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[50%]">10</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[53.5%]">20</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[57%]">30</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[60%]">40</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[63%]">50</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[66%]">60</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[69%]">70</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[72%]">80</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[75.5%]">90</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[79.5%]">100</div>
                    <div className="absolute left-[34%] top-[46%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">100</div>
                    <div className="absolute left-[36%] top-[46%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">90</div>
                    <div className="absolute left-[37.5%] top-[46%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">80</div>
                    <div className="absolute left-[39%] top-[46%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">70</div>
                    <div className="absolute left-[40.5%] top-[46%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">60</div>
                    <div className="absolute left-[42%] top-[46%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">50</div>
                    <div className="absolute left-[43.5%] top-[46%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">40</div>
                    <div className="absolute left-[45%] top-[46%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">30</div>
                    <div className="absolute left-[46.5%] top-[46%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">20</div>
                    <div className="absolute left-[48%] top-[46%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">10</div>
                    <div className="absolute left-[51.5%] top-[46%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">10</div>
                    <div className="absolute left-[53%] top-[46%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">20</div>
                    <div className="absolute left-[54.5%] top-[46%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">30</div>
                    <div className="absolute left-[56%] top-[46%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">40</div>
                    <div className="absolute left-[58%] top-[46%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">50</div>
                    <div className="absolute left-[59.5%] top-[46%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">60</div>
                    <div className="absolute left-[61%] top-[46%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">70</div>
                    <div className="absolute left-[62.5%] top-[46%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">80</div>
                    <div className="absolute left-[64%] top-[46%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">90</div>
                    <div className="absolute left-[66%] top-[46%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">100</div>
                </div>
            </div>
        </div >
    );
};

export default CareRadar;

