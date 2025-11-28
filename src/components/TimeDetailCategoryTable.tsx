import React, { useMemo } from "react";

type JsonPrimitive = string | number | null | undefined;
type JsonMap = Record<string, JsonPrimitive>;
type SeriesKey = "national" | "previous" | "current";

interface TimeDetailCategoryTableProps {
    averageData?: JsonMap;
    averageComparison?: JsonMap;
    previousData?: JsonMap;
    previousComparison?: JsonMap;
    currentData?: JsonMap;
    evaluationCurrent?: JsonMap;
    evaluationPrevious?: JsonMap;
    evaluationAverage?: JsonMap;
}

interface TimeRowDefinition {
    id: string;
    type: "summary" | "detail";
    summaryLabel?: string;
    detailLabel?: string;
    points?: number;
    groupKey?: string;
    groupLabel?: string;
    groupRowSpan?: number;
}

interface TimeDetailRow extends TimeRowDefinition {
    showGroupCell?: boolean;
    computedGroupRowSpan?: number;
    averageComparison?: number | null;
    averageScore?: string;
    previousComparison?: number | null;
    previousScore?: string;
    currentScore?: string;
    ranks: Partial<Record<SeriesKey, number | null>>;
}

const RANK_BANDS = [
    { value: 1, label: "B" },
    { value: 2, label: "A" },
    { value: 3, label: "AA" },
    { value: 4, label: "AAA" },
] as const;

const SERIES_META: Array<{ key: SeriesKey; label: string; color: string; offset: number }> = [
    { key: "national", label: "全国平均", color: "#64CBD3", offset: -10 },
    { key: "previous", label: "前回", color: "#3D80B8", offset: 0 },
    { key: "current", label: "今回", color: "#F24822", offset: 10 },
];

const ROW_DEFS: TimeRowDefinition[] = [
    { id: "29-total", type: "summary", summaryLabel: "29.合計タイム", detailLabel: "29.合計タイム", points: 10 },
    { id: "29-1", type: "detail", detailLabel: "29-1.タイムオフ", points: 20, groupKey: "breakdown", groupLabel: "内訳", groupRowSpan: 3 },
    { id: "29-2", type: "detail", detailLabel: "29-2.タイムフィル", points: 10, groupKey: "breakdown" },
    { id: "29-3", type: "detail", detailLabel: "29-3.タイムケア", points: 10, groupKey: "breakdown" },
    { id: "29-4", type: "detail", detailLabel: "29-4.ベース", points: 20, groupKey: "onecolor", groupLabel: "ワンカラー", groupRowSpan: 4 },
    { id: "29-5", type: "detail", detailLabel: "29-5.カラー", points: 10, groupKey: "onecolor" },
    { id: "29-6", type: "detail", detailLabel: "29-6.トップ", points: 20, groupKey: "onecolor" },
    { id: "29-7", type: "detail", detailLabel: "29-7.合計", points: 20, groupKey: "onecolor" },
];

const AVERAGE_SCORE_FALLBACK: Record<string, string> = {
    "29-total": "112分42秒",
    "29-1": "21分18秒",
    "29-2": "19分50秒",
    "29-3": "21分18秒",
    "29-4": "16分44秒",
    "29-5": "20分54秒",
    "29-6": "11分50秒",
    "29-7": "49分30秒",
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

const ROW_KEY_ALIASES: Record<string, string[]> = {
    "29-total": ["両手総合計", "総合計タイム"],
    "29-1": ["オフ"],
    "29-2": ["フィル", "フィルイン"],
    "29-3": ["ケア"],
    "29-4": ["ワンカラベース", "ワンカラー ベース", "ベース"],
    "29-5": ["ワンカラカラー", "ワンカラー カラー", "カラー"],
    "29-6": ["ワンカラトップ", "ワンカラー トップ", "トップ"],
    "29-7": ["ワンカラ合計", "ワンカラー 合計", "合計"],
};

const COMPARISON_KEY_ALIASES: Record<string, string[]> = {
    "29-total": ["両手総合計", "総合評価", "タイム"],
    "29-1": ["オフ"],
    "29-2": ["フィル"],
    "29-3": ["ケア"],
    "29-4": ["ベース"],
    "29-5": ["カラー"],
    "29-6": ["トップ"],
    "29-7": ["合計"],
};

const parseComparisonValue = (value: JsonPrimitive): number | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === "number") {
        const n = Math.round(value);
        if (n >= 1 && n <= 3) return n;
    }
    const str = String(value).trim();
    if (!str) return null;
    if (/[↗↑▲△]/.test(str)) return 1;
    if (/[→➡⇨]/.test(str)) return 2;
    if (/[↘↓▼▽]/.test(str)) return 3;
    const numeric = Number(str.replace(/[^\d-]/g, ""));
    if (Number.isFinite(numeric) && numeric >= 1 && numeric <= 3) return numeric;
    return null;
};

const parseRankToken = (value: JsonPrimitive, keyNorm?: string): number | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === "number") {
        const n = Math.round(value);
        if (n >= 1 && n <= 4) return n;
    }
    const str = String(value).trim();
    if (!str) return null;
    const ascii = str
        .replace(/[０-９Ａ-Ｚａ-ｚ]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xFEE0))
        .toUpperCase();
    if (/AAA/.test(ascii)) return 4;
    if (/AA/.test(ascii)) return 3;
    if (/A/.test(ascii)) return 2;
    if (/B/.test(ascii)) return 1;
    const digits = ascii.replace(/[^\d-]/g, "");
    if (digits) {
        const n = Number(digits);
        if (n >= 1 && n <= 4) return n;
    }
    if (keyNorm) {
        const band = RANK_BANDS.find((b) => keyNorm.includes(normalizeKey(b.label)));
        if (band && /[○◯●1YES可◎〇]/i.test(ascii)) {
            return band.value;
        }
    }
    return null;
};

const parseNumericValue = (value: JsonPrimitive): number | null => {
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

const combineTimeFragments = (entries: Array<{ key: string; value: JsonPrimitive }>): string => {
    let minutes: number | null = null;
    let seconds: number | null = null;
    let fallback = "";
    for (const { key, value } of entries) {
        if (value === null || value === undefined) continue;
        const str = String(value).trim();
        if (!str) continue;
        const normalized = sanitizeTime(str);
        if (normalized.includes("分") && normalized.includes("秒")) {
            fallback = normalized;
        }
        const num = parseNumericValue(value);
        if (minutes === null && (/分/.test(key) || /minute/i.test(key))) {
            if (num !== null) minutes = num;
        }
        if (seconds === null && (/秒/.test(key) || /second/i.test(key))) {
            if (num !== null) seconds = num;
        }
        if (!fallback) fallback = normalized || str;
    }
    if (fallback && fallback.includes("分") && fallback.includes("秒")) return fallback;
    if (minutes !== null || seconds !== null) {
        const mm = Math.max(0, minutes ?? 0);
        const ss = Math.max(0, seconds ?? 0);
        return `${mm}分${String(ss).padStart(2, "0")}秒`;
    }
    return fallback;
};

const buildTokens = (def: TimeRowDefinition): string[] => {
    const tokens = new Set<string>();
    if (def.id) tokens.add(normalizeKey(def.id));
    if (def.detailLabel) {
        const normalized = normalizeKey(def.detailLabel);
        tokens.add(normalized);
        tokens.add(normalized.replace(/\./g, ""));
    }
    if (def.summaryLabel) {
        const normalized = normalizeKey(def.summaryLabel);
        tokens.add(normalized);
        tokens.add(normalized.replace(/\./g, ""));
    }
    const aliases = ROW_KEY_ALIASES[def.id];
    if (aliases) {
        aliases.forEach((alias) => {
            const nk = normalizeKey(alias);
            tokens.add(nk);
        });
    }
    return Array.from(tokens).filter(Boolean);
};

const TimeDetailCategoryTable: React.FC<TimeDetailCategoryTableProps> = ({
    averageData,
    averageComparison,
    previousData,
    previousComparison,
    currentData,
    evaluationCurrent,
    evaluationPrevious,
    evaluationAverage,
}) => {
    const rows = useMemo<TimeDetailRow[]>(() => {
        console.log('[TimeDetailCategoryTable] averageComparison:', averageComparison);
        console.log('[TimeDetailCategoryTable] previousComparison:', previousComparison);
        console.log('[TimeDetailCategoryTable] averageData:', averageData);
        console.log('[TimeDetailCategoryTable] previousData:', previousData);
        console.log('[TimeDetailCategoryTable] currentData:', currentData);

        const groupTracker = new Map<string, { remaining: number; rowSpan: number; label?: string }>();

        const collectEntries = (map: JsonMap | undefined, tokens: string[]) => {
            if (!map) return [];
            return Object.entries(map)
                .map(([rawKey, value]) => ({
                    rawKey,
                    normalizedKey: normalizeKey(rawKey).replace(/ケア評価|ワンカラ評価|タイム評価/g, ""),
                    value,
                }))
                .filter(({ normalizedKey }) => tokens.some((token) => normalizedKey.includes(token)));
        };

        const extractTime = (map: JsonMap | undefined, def: TimeRowDefinition) => {
            const tokens = buildTokens(def);
            if (!map || !tokens.length) return "";
            const entries = collectEntries(map, tokens);
            if (!entries.length) return "";
            return combineTimeFragments(entries.map(({ rawKey, value }) => ({ key: rawKey, value })));
        };

        const extractComparisonValue = (map: JsonMap | undefined, def: TimeRowDefinition) => {
            if (!map) return null;

            // First, try exact match with the row ID (e.g., "29-1", "29-2")
            if (def.id && map[def.id] !== undefined && map[def.id] !== null) {
                const parsed = parseComparisonValue(map[def.id]);
                if (parsed !== null) return parsed;
            }

            // Try aliases from COMPARISON_KEY_ALIASES
            const aliases = COMPARISON_KEY_ALIASES[def.id] || [];
            for (const alias of aliases) {
                if (map[alias] !== undefined && map[alias] !== null) {
                    const parsed = parseComparisonValue(map[alias]);
                    if (parsed !== null) return parsed;
                }
            }

            // Only if no direct match, try normalized key matching (more strict)
            const tokens = buildTokens(def);
            if (!tokens.length) return null;

            for (const [key, raw] of Object.entries(map)) {
                const keyNorm = normalizeKey(key);
                // Require exact token match, not just includes
                if (!tokens.some((token) => keyNorm === token)) continue;
                const parsed = parseComparisonValue(raw);
                if (parsed !== null) return parsed;
            }

            return null;
        };

        const extractRank = (
            map: JsonMap | undefined,
            def: TimeRowDefinition,
            hints: string[],
        ): number | null => {
            if (!map) return null;
            const tokens = buildTokens(def);
            if (!tokens.length) return null;
            const attempt = (hintList: string[]) => {
                const flavorNorms = hintList.map(normalizeKey);
                const bandCandidates: number[] = [];
                for (const [key, raw] of Object.entries(map)) {
                    const keyNorm = normalizeKey(key);
                    if (!tokens.some((token) => keyNorm.includes(token))) continue;
                    if (flavorNorms.length && !flavorNorms.some((hint) => keyNorm.includes(hint))) {
                        continue;
                    }
                    const parsed = parseRankToken(raw, keyNorm);
                    if (parsed) return parsed;
                    const band = RANK_BANDS.find((b) => keyNorm.includes(normalizeKey(b.label)));
                    if (band) {
                        const str = String(raw ?? "").trim();
                        if (str && str !== "0" && str !== "-" && str !== "無") {
                            bandCandidates.push(band.value);
                        }
                    }
                }
                if (bandCandidates.length) {
                    return Math.max(...bandCandidates);
                }
                return null;
            };
            const primary = attempt(hints);
            if (primary !== null) return primary;
            if (hints.length) {
                return attempt([]);
            }
            return null;
        };

        return ROW_DEFS.map((def) => {
            const base: TimeDetailRow = {
                ...def,
                ranks: {},
            };

            if (def.groupKey) {
                const tracker = groupTracker.get(def.groupKey);
                if (!tracker) {
                    const span =
                        def.groupRowSpan ??
                        ROW_DEFS.filter((row) => row.groupKey === def.groupKey).length;
                    groupTracker.set(def.groupKey, {
                        remaining: Math.max(0, span - 1),
                        rowSpan: span,
                        label: def.groupLabel,
                    });
                    base.showGroupCell = true;
                    base.computedGroupRowSpan = span;
                    base.groupLabel = def.groupLabel;
                } else {
                    base.showGroupCell = false;
                    base.computedGroupRowSpan = tracker.rowSpan;
                    base.groupLabel = tracker.label;
                    tracker.remaining = Math.max(0, tracker.remaining - 1);
                    groupTracker.set(def.groupKey, tracker);
                }
            }

            const resolvedAverage = extractTime(averageData, def);
            const cleaned = resolvedAverage?.replace(/\s+/g, "");
            const looksLikeTime = cleaned ? /(分|秒|:)/.test(cleaned) : false;
            const isEmptyAverage =
                !cleaned ||
                cleaned === "-" ||
                cleaned === "—" ||
                cleaned === "ー" ||
                /0分0秒/.test(cleaned) ||
                !looksLikeTime;
            base.averageScore = isEmptyAverage
                ? AVERAGE_SCORE_FALLBACK[def.id] || ""
                : resolvedAverage;
            base.previousScore = extractTime(previousData, def);
            base.currentScore = extractTime(currentData, def);
            base.averageComparison = extractComparisonValue(averageComparison, def);
            base.previousComparison = extractComparisonValue(previousComparison, def);

            if (base.averageComparison !== null || base.previousComparison !== null) {
                console.log(`[${def.id}] avgComp: ${base.averageComparison}, prevComp: ${base.previousComparison}`);
            }

            const nationalRank =
                extractRank(evaluationAverage, def, ["全国平均", "平均"]) ??
                extractRank(evaluationCurrent, def, ["全国平均", "平均"]) ??
                extractRank(evaluationPrevious, def, ["全国平均", "平均"]);
            const previousRank =
                extractRank(evaluationPrevious, def, ["前回", "previous", "final"]) ??
                extractRank(evaluationCurrent, def, ["前回", "previous", "final"]);
            const currentRank = extractRank(evaluationCurrent, def, ["今回", "current"]);

            base.ranks = {
                national: nationalRank,
                previous: previousRank,
                current: currentRank,
            };
            console.log(base);
            return base;
        });
    }, [
        averageData,
        averageComparison,
        previousData,
        previousComparison,
        currentData,
        evaluationCurrent,
        evaluationPrevious,
        evaluationAverage,
    ]);

    const renderArrow = (value?: number | null) => {
        if (value === null || value === undefined) {
            return <span className="text-slate-400">—</span>;
        }
        if (value !== 1 && value !== 2 && value !== 3) {
            return <span className="text-slate-400">—</span>;
        }
        const direction = value === 1 ? "up" : value === 2 ? "right" : value === 3 ? "down" : null;
        if (!direction) {
            return <span className="text-slate-400">—</span>;
        }
        const color = direction === "up" ? "#1a73e8" : direction === "down" ? "#f44336" : "#2ea44f";
        const rotation = direction === "right" ? 90 : direction === "down" ? 180 : 0;
        return (
            <div className="flex items-center justify-center">
                <svg
                    width={20}
                    height={18}
                    viewBox="0 0 24 24"
                    style={{ transform: `rotate(${rotation}deg)` }}
                    aria-hidden="true"
                >
                    <path d="M10 18v-6H7l5-6 5 6h-3v6h-2z" fill={color} />
                </svg>
            </div>
        );
    };

    const renderEvaluationGraph = (row: TimeDetailRow) => {
        const activeBands = new Set<number>();
        SERIES_META.forEach((meta) => {
            const rank = row.ranks[meta.key];
            if (rank && rank >= 1 && rank <= RANK_BANDS.length) {
                activeBands.add(rank);
            }
        });

        const hasRank = activeBands.size > 0;
        if (!hasRank) {
            return (
                <div className="flex h-12 w-full items-center px-2" aria-hidden="true">
                    <div className="h-[28px] w-full bg-[#fce2de]" />
                </div>
            );
        }

        return (
            <div className="relative h-14 rounded bg-[#f8fbfd] px-3 py-2 overflow-hidden">
                {/* Vertical dotted guides for each band */}
                {RANK_BANDS.map((band, index) => {
                    const columnWidth = 100 / RANK_BANDS.length;
                    const centerPercent = (index + 0.5) * columnWidth;
                    return (
                        <div
                            key={`guide-${band.label}`}
                            className="absolute pointer-events-none"
                            style={{
                                top: "6px",
                                bottom: "6px",
                                left: `calc(${centerPercent}% + 20px)`,
                                borderLeft: "1px dashed #d9e4ea",
                                opacity: 0.9,
                            }}
                        />
                    );
                })}
                {SERIES_META.map((series) => {
                    const rank = row.ranks[series.key];
                    if (!rank || rank < 1 || rank > RANK_BANDS.length) return null;
                    const columnWidth = 100 / RANK_BANDS.length;
                    const centerPercent = (rank - 0.5) * columnWidth;
                    const topPosition = `calc(50% + ${series.offset}px)`;


                    return (
                        <div
                            key={`${row.id}-${series.key}`}
                            className="absolute h-[2px]"
                            style={{
                                left: "8px",
                                width: `calc(${centerPercent}% + 14px)`,
                                top: topPosition,
                                backgroundColor: series.color,
                                opacity: 0.85,
                                height: "4px"
                            }}
                        >
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="w-full">
            <div className="mb-2 flex justify-end gap-4 text-[11px] text-slate-600">
                {SERIES_META.map((series) => (
                    <span key={series.key} className="flex items-center gap-2">
                        <span
                            className="h-[2px] w-6 rounded-full"
                            style={{ backgroundColor: series.color }}
                        />
                        {series.label}
                    </span>
                ))}
            </div>
            <table className="w-full border-collapse text-[11px] text-slate-700">
                <thead>
                    <tr>
                        <th
                            rowSpan={2}
                            colSpan={2}
                            className="bg-[#5eb9c5] px-1 py-1 text-center text-white border border-[#d4d4d4]"
                        >
                            カテゴリー
                        </th>
                        <th
                            rowSpan={2}
                            className="bg-[#5eb9c5] px-1 py-1 text-center text-white border border-[#d4d4d4]"
                            style={{ width: 40 }}
                        >
                            配点
                        </th>
                        <th
                            colSpan={2}
                            className="bg-[#5eb9c5] px-1 py-1 text-center text-white border border-[#d4d4d4]"
                        >
                            平均
                        </th>
                        <th
                            colSpan={2}
                            className="bg-[#3D80B8] px-1 py-1 text-center text-white border border-[#d4d4d4]"
                        >
                            前回
                        </th>
                        <th className="bg-[#ff9a98] px-1 py-1 text-center text-white border border-[#d4d4d4]">
                            今回
                        </th>
                        <th
                            colSpan={4}
                            className="bg-[#5eb9c5] px-1 py-1 text-center text-white border border-[#d4d4d4]"
                        >
                            評価グラフ
                        </th>
                    </tr>
                    <tr>
                        <th className="bg-[#5eb9c5] px-1 py-1 text-center text-[10px] text-white border border-[#d4d4d4]">
                            比較
                        </th>
                        <th className="bg-[#5eb9c5] px-1 py-1 text-center text-[10px] text-white border border-[#d4d4d4]">
                            スコア
                        </th>
                        <th className="bg-[#7AA9D0] px-1 py-1 text-center text-[10px] text-white border border-[#d4d4d4]">
                            比較
                        </th>
                        <th className="bg-[#7AA9D0] px-1 py-1 text-center text-[10px] text-white border border-[#d4d4d4]">
                            スコア
                        </th>
                        <th className="bg-[#ffb8b6] px-1 py-1 text-center text-[10px] text-white border border-[#d4d4d4]">
                            スコア
                        </th>
                        {RANK_BANDS.map((band) => (
                            <th
                                key={band.label}
                                className={`${band.label === "B" ? "bg-[#FFE78E] text-[#4FB1BC]" : "bg-[#5eb9c5] text-white"} px-1 py-1 text-center text-[10px] border border-[#d4d4d4]`}
                                style={{ width: 45 }}
                            >
                                {band.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.id}>
                            {row.type === "summary" ? (
                                <td
                                    colSpan={2}
                                    className="border border-[#d4d4d4] bg-white px-1 py-1 text-center font-semibold"
                                >
                                    {row.summaryLabel}
                                </td>
                            ) : (
                                <>
                                    {row.showGroupCell && (
                                        <td
                                            rowSpan={row.computedGroupRowSpan}
                                            className="border border-[#d4d4d4] bg-[#f3fafb] px-1 py-1 text-center font-semibold text-slate-700 align-top"
                                        >
                                            {row.groupLabel}
                                        </td>
                                    )}
                                    <td className="border border-[#d4d4d4] bg-white px-1 py-1 text-left">
                                        {row.detailLabel}
                                    </td>
                                </>
                            )}
                            <td className="border border-[#d4d4d4] bg-white px-1 py-1 text-center font-semibold text-slate-700">
                                {row.points ?? ""}
                            </td>
                            <td className="border border-[#d4d4d4] bg-[#edf7f8] px-1 py-1 text-center">
                                {renderArrow(row.averageComparison)}
                            </td>
                            <td className="border border-[#d4d4d4] bg-[#edf7f8] px-1 py-1 text-center font-semibold text-[#268aa3]">
                                {row.averageScore || ""}
                            </td>
                            <td className="border border-[#d4d4d4] bg-[#eef3f8]  text-center">
                                {renderArrow(row.previousComparison)}
                            </td>
                            <td className="border border-[#d4d4d4] bg-[#eef3f8] px-1 py-1 text-center font-semibold text-[#3d7fb6]">
                                {row.previousScore || "—"}
                            </td>
                            <td className="border border-[#d4d4d4] bg-[#fff5f5] px-1 py-1 text-center font-semibold text-[#e94444]">
                                {row.currentScore || "—"}
                            </td>
                            <td colSpan={4} className="border border-[#d4d4d4] bg-white px-1 py-1">
                                {renderEvaluationGraph(row)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default TimeDetailCategoryTable;

