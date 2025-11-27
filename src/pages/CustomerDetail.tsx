import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import Sidebar from "@/components/layout/Sidebar";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
    RadarChart,
    Radar,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    Legend,
    ResponsiveContainer
} from "recharts";
import { FileText, Crown, Download, Edit, CrownIcon } from "lucide-react";
import EvaluationRankStandardTable from "@/components/EvaluationRankStandardTable";
import ReferenceTimeTable from "@/components/ReferenceTimeTable";
import TimeDetailCategoryTable from "@/components/TimeDetailCategoryTable";
import AssessmentTabs from "@/components/customer/AssessmentTabs";
import { LiteNoticeBanner } from "@/components/customer/LiteNoticeBanner";
import OverviewRadar from "../components/customer/OverviewRadar";
import TimeRadar from "../components/customer/TimeRadar";
import { downloadPDF } from "@/utils/pdfGenerator";
import { elementToImage } from "@/utils/chartToImage";


type JsonMap = Record<string, number | string | null | undefined>;
type JsonbRow = { id: string; customer_id: string; type?: string | null; data: JsonMap };
type Customer = {
    id: string;
    external_id: string;
    name: string;
    email: string | null;
    issuer: string | null;
    prefecture: string | null;
    application_date: string | null;
};

type CareCheckpoint = { code: string; label: string; points?: number };
type CareItem = { id: number; title: string; required?: boolean; checkpoints: CareCheckpoint[] };
type CareCategory = { name: string; items: CareItem[] };

const CARE_EVALUATION_MASTER: CareCategory[] = [
    {
        name: "オフ",
        items: [
            { id: 1, title: "オフ 削り", checkpoints: [{ code: "1-1", label: "削りすぎ", points: 10 }, { code: "1-2", label: "削り不足", points: 10 }] },
            { id: 2, title: "オフ 仕上", required: true, checkpoints: [{ code: "2-1", label: "ジェル残り", points: 20 }] },
        ],
    },
    {
        name: "ファイル",
        items: [
            {
                id: 3,
                title: "ファイル 仕上り",
                checkpoints: [
                    { code: "3-1", label: "根元段差", points: 10 },
                    { code: "3-2", label: "表面凹凸", points: 10 },
                    { code: "3-3", label: "サイド削り", points: 20 },
                    { code: "3-4", label: "厚み", points: 10 },
                ],
            },
            {
                id: 4,
                title: "ファイル 長さ・形",
                checkpoints: [
                    { code: "4-1", label: "ガタつき", points: 10 },
                    { code: "4-2", label: "バランス", points: 20 },
                    { code: "4-3", label: "形の統一", points: 10 },
                ],
            },
            {
                id: 5,
                title: "ファイル サイドストレート",
                checkpoints: [
                    { code: "5-1", label: "サイド下がり", points: 10 },
                    { code: "5-2", label: "サイド上がり", points: 10 },
                    { code: "5-3", label: "角残り", points: 20 },
                ],
            },
            {
                id: 6,
                title: "ファイル 左右対称",
                checkpoints: [
                    { code: "6-1", label: "中心", points: 10 },
                    { code: "6-2", label: "左右対称", points: 20 },
                ],
            },
        ],
    },
    {
        name: "プレパレーション",
        items: [
            {
                id: 7,
                title: "右コーナー",
                checkpoints: [{ code: "7-1", label: "ルースキューティクル", points: 20 }],
            },
            {
                id: 8,
                title: "左コーナー",
                checkpoints: [{ code: "8-1", label: "ルースキューティクル", points: 20 }],
            },
            {
                id: 9,
                title: "右サイド",
                checkpoints: [{ code: "9-1", label: "ルースキューティクル", points: 30 }],
            },
            {
                id: 10,
                title: "左サイド",
                checkpoints: [{ code: "10-1", label: "ルースキューティクル", points: 30 }],
            },
            {
                id: 11,
                title: "サイドウォール",
                checkpoints: [
                    { code: "11-1", label: "小爪", points: 10 },
                    { code: "11-2", label: "ハードスキン", points: 10 },
                ],
            },
            {
                id: 12,
                title: "サイドウォール",
                checkpoints: [
                    { code: "12-1", label: "ルースキューティクル", points: 20 },
                    { code: "12-2", label: "ガタつき", points: 20 },
                ],
            },
            {
                id: 13,
                title: "ニッパー処理",
                checkpoints: [
                    { code: "13-1", label: "ガタつき", points: 20 },
                    { code: "13-2", label: "切りすぎ", points: 20 },
                    { code: "13-3", label: "ささくれ", points: 10 },
                ],
            },
        ],
    },
];

// ---- Time tab static table master data ----
type TimeTableRow = {
    id: string;
    mainCategory?: string;
    mainRowSpan?: number;
    detailLabel: string;
    points?: number;
};


const TIME_TABLE_ROWS: TimeTableRow[] = [
    // 29.合計タイム ブロック（4 行）
    { id: "29-total", mainCategory: "29.合計タイム", mainRowSpan: 4, detailLabel: "29.合計タイム", points: 10 },
    { id: "29-1", detailLabel: "29-1.タイムオフ", points: 20 },
    { id: "29-2", detailLabel: "29-2.タイムフィル", points: 10 },
    { id: "29-3", detailLabel: "29-3.タイムケア", points: 10 },

    { id: "29-4", mainCategory: "内訳", mainRowSpan: 5, detailLabel: "29-4.ベース", points: 20 },
    { id: "onecolor-header", detailLabel: "ワンカラー" }, // 見出し行（配点なし）
    { id: "29-5", detailLabel: "29-5.カラー", points: 10 },
    { id: "29-6", detailLabel: "29-6.トップ", points: 20 },
    { id: "29-7", detailLabel: "29-7.合計", points: 20 },
];

const RANK_BANDS: Array<{ value: number; label: string }> = [
    { value: 1, label: "B" },
    { value: 2, label: "A" },
    { value: 3, label: "AA" },
    { value: 4, label: "AAA" },
];

const JP_KEYS = ["総合", "ケア", "ワンカラー", "タイム"] as const;
type AxisKey = (typeof JP_KEYS)[number];

type LocalCardProps = React.HTMLAttributes<HTMLDivElement> & {
    title?: string;
    children: React.ReactNode;
};

const Card: React.FC<LocalCardProps> = ({ title, children, className = "", ...rest }) => (
    <div className={`rounded-2xl bg-white shadow-sm ${className}`} {...rest}>
        {title && <div className="border-b px-4 py-2 text-sm font-semibold">{title}</div>}
        <div className="p-4">{children}</div>
    </div>
);

const Chip: React.FC<{ tone?: "info" | "success" | "danger" | "muted"; children: React.ReactNode }> = ({
    tone = "muted",
    children,
}) => {
    const toneMap = {
        info: "bg-sky-50 text-sky-700 border border-sky-100",
        success: "bg-emerald-50 text-emerald-700 border border-emerald-100",
        danger: "bg-rose-50 text-rose-700 border border-rose-100",
        muted: "bg-slate-100 text-slate-700 border border-slate-200",
    } as const;
    return <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs ${toneMap[tone]}`}>{children}</span>;
};

/** ---------- Helpers ---------- */
function toHalfWidthDigits(s: string): string {
    return s.replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xFEE0));
}

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

function sumKeys(data?: JsonMap, keys: AxisKey[] = [...JP_KEYS]): number {
    if (!data) return 0;
    return keys.reduce((acc, k) => {
        const v = num(data[k]);
        return acc + (v ?? 0);
    }, 0);
}

function rankFromScore(score: number, max: number) {
    // Simple tiering; tweak thresholds to your official spec if needed
    const pct = (score / max) * 100;
    if (pct >= 90) return "AAA";
    if (pct >= 80) return "AA";
    if (pct >= 70) return "A";
    if (pct >= 60) return "B";
    return "C";
}

function parseScoreFromString(scoreStr: string): number {
    if (!scoreStr) return 0;
    const match = scoreStr.match(/(\d+)\/(\d+)/);
    if (match) {
        return parseInt(match[1], 10);
    }
    return 0;
}

function parseTimeToSeconds(timeStr: string): number {
    if (!timeStr) return 0;
    const match = timeStr.match(/(\d+)分(\d+)秒/);
    if (match) {
        return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
    }
    return 0;
}

function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}分${secs.toString().padStart(2, '0')}秒`;
}

function extractSubItem(key: string): string {
    return key.replace(/^\[.*?\] /, '').replace(/ \[^\s]*$/, '');
}

// Robust helpers for tolerant key extraction and numeric parsing across CSV variations
function firstNum(...vals: Array<unknown>): number {
    for (const v of vals) {
        const n = num(v);
        if (n !== null && n !== 0) return n;
        if (typeof v === "string") {
            const parsed = parseScoreFromString(v);
            if (parsed) return parsed;
        }
    }
    return 0;
}

function findNumByKeyIncludes(data: JsonMap | undefined, includesAll: string[]): number {
    if (!data) return 0;
    for (const [k, v] of Object.entries(data)) {
        if (includesAll.every(s => k.includes(s))) {
            const n = firstNum(v);
            if (n) return n;
        }
    }
    return 0;
}

type CareRankDatum = {
    label: string;
    rowIndex: number;
    national: number | null;
    prev: number | null;
    curr: number | null;
};

type AxisKeyOC = "ベース" | "カラー" | "トップ";
type OCCheckpoint = { code: string; label: string; points: number; highlight?: boolean };
type OCItem = { id: number; title: string; required?: boolean; checkpoints: OCCheckpoint[] };
type OCCategory = { name: AxisKeyOC; items: OCItem[] };

const ONE_COLOR_MASTER: OCCategory[] = [
    {
        name: "ベース",
        items: [
            {
                id: 14,
                title: "はみ出し",
                required: true,
                checkpoints: [
                    { code: "14-1", label: "キューティクルライン", points: 10 },
                    { code: "14-2", label: "コーナー・サイド", points: 20 },
                ],
            },
            {
                id: 15,
                title: "キューティクルライン",
                required: true,
                checkpoints: [
                    { code: "15-1", label: "すき間・塗漏れ", points: 10 },
                    { code: "15-2", label: "ガタつき", points: 20 },
                ],
            },
            {
                id: 16,
                title: "コーナー",
                checkpoints: [
                    { code: "16-1", label: "すき間・塗漏れ", points: 10 },
                    { code: "16-2", label: "ガタつき", points: 20 },
                ],
            },
            {
                id: 17,
                title: "サイド",
                checkpoints: [
                    { code: "17-1", label: "すき間・塗漏れ", points: 20 },
                    { code: "17-2", label: "ガタつき", points: 30 },
                ],
            },
            {
                id: 18,
                title: "ハイポイント",
                checkpoints: [
                    { code: "18-1", label: "位置", points: 10 },
                    { code: "18-2", label: "アーチのガタつき", points: 30 },
                ],
            },
            {
                id: 19,
                title: "たまりへこみ",
                checkpoints: [
                    { code: "19-1", label: "キューティクルエリア", points: 10 },
                    { code: "19-2", label: "コーナー", points: 10 },
                    { code: "19-3", label: "イエローライン", points: 10 },
                    { code: "19-4", label: "先端", points: 10 },
                    { code: "19-5", label: "サイド", points: 20 },
                    { code: "19-6", label: "サイドストレート", points: 20 },
                ],
            },
        ],
    },
    {
        name: "カラー",
        items: [
            {
                id: 20,
                title: "キューティクルライン",
                checkpoints: [
                    { code: "20-1", label: "すき間・塗漏れ", points: 10 },
                    { code: "20-2", label: "ガタつき", points: 10 },
                ],
            },
            {
                id: 21,
                title: "右コーナー",
                checkpoints: [
                    { code: "21-1", label: "すき間・塗漏れ", points: 20 },
                    { code: "21-2", label: "ガタつき", points: 20 },
                ],
            },
            {
                id: 22,
                title: "右コーナー",
                checkpoints: [
                    { code: "22-1", label: "すき間・塗漏れ", points: 10 },
                    { code: "22-2", label: "ガタつき", points: 20 },
                ],
            },
            {
                id: 23,
                title: "右コーナー",
                checkpoints: [
                    { code: "23-1", label: "すき間・塗漏れ", points: 20 },
                    { code: "23-2", label: "ガタつき", points: 30 },
                ],
            },
            {
                id: 24,
                title: "左サイド",
                checkpoints: [
                    { code: "24-1", label: "すき間・塗漏れ", points: 10 },
                    { code: "24-2", label: "ガタつき", points: 20 },
                ],
            },
            {
                id: 25,
                title: "エッジ",
                checkpoints: [
                    { code: "25-1", label: "塗り漏れ", points: 10 },
                    { code: "25-2", label: "ガタつき", points: 10 },
                    { code: "25-3", label: "裏流れ", points: 10 },
                ],
            },
        ],
    },
    {
        name: "トップ",
        items: [
            {
                id: 26,
                title: "ハイポイント",
                checkpoints: [
                    { code: "26-1", label: "位置", points: 10 },
                    { code: "26-2", label: "アーチガタつき", points: 20 },
                ],
            },
            {
                id: 27,
                title: "たまりへこみ",
                checkpoints: [
                    { code: "27-1", label: "キューティクルエリア", points: 10 },
                    { code: "27-2", label: "コーナー", points: 10 },
                    { code: "27-3", label: "イエローライン", points: 10 },
                    { code: "27-4", label: "先端", points: 10 },
                    { code: "27-5", label: "サイド", points: 20 },
                    { code: "27-6", label: "サイドストレート", points: 20 },
                ],
            },
            {
                id: 28,
                title: "はみ出し",
                checkpoints: [
                    { code: "28-1", label: "キューティクルライン", points: 10 },
                    { code: "28-2", label: "コーナー・サイド", points: 20 },
                ],
            },
        ],
    },
];

function ensureRecord(value: unknown): Record<string, any> | undefined {
    if (!value) return undefined;
    if (typeof value === "string") {
        try {
            const parsed = JSON.parse(value);
            return parsed && typeof parsed === "object" ? (parsed as Record<string, any>) : undefined;
        } catch {
            return undefined;
        }
    }
    if (typeof value === "object") {
        return value as Record<string, any>;
    }
    return undefined;
}

function normalizeCareKey(input: string): string {
    return toHalfWidthDigits(String(input ?? ""))
        .toUpperCase()
        .replace(/[‐‑–—−ーｰ－]/g, "-")
        .replace(/[［\[\]］【】（）\(\)\s\u3000]/g, "")
        .replace(/ケア/g, "")
        .replace(/^\[CARE\]/g, "")
        .replace(/^\[ケア\]/g, "");
}

function extractRankValue(map: Record<string, any> | undefined, code: string, label: string): number | null {
    if (!map) return null;
    const targets = [
        normalizeCareKey(code),
        normalizeCareKey(`[ケア]${code}`),
        normalizeCareKey(`ケア${code}`),
        normalizeCareKey(label),
    ].filter(Boolean);

    // First build a map from explicit "NN-N" codes found in keys to rank values.
    const codeRankMap = new Map<string, number | null>();
    const parseRawToRank = (rawVal: any): number | null => {
        if (rawVal === null || rawVal === undefined) return null;
        if (typeof rawVal === "number") {
            const n = Math.floor(rawVal);
            return n >= 1 && n <= 4 ? n : null;
        }
        if (typeof rawVal === "string") {
            if (rawVal.includes("未評価")) return null;
            const ascii = toHalfWidthDigits(rawVal).toUpperCase();
            if (ascii.includes("AAA")) return 4;
            if (ascii.includes("AA")) return 3;
            if (ascii.includes("A")) return 2;
            if (ascii.includes("B")) return 1;
            const digits = ascii.replace(/[^0-9-]/g, "");
            if (digits) {
                const numeric = Number(digits);
                if (Number.isFinite(numeric) && numeric >= 1 && numeric <= 4) {
                    return Math.floor(numeric);
                }
            }
        }
        return null;
    };

    for (const [rawKey, rawVal] of Object.entries(map)) {
        const nk = normalizeCareKey(rawKey);
        const m = nk.match(/(\d{1,2}-\d{1,2})/);
        if (m) {
            const codeKey = m[1];
            if (!codeRankMap.has(codeKey)) {
                codeRankMap.set(codeKey, parseRawToRank(rawVal));
            }
        }
    }

    // If we have a direct mapping for the requested code, return it.
    const direct = code && codeRankMap.has(code) ? codeRankMap.get(code) ?? null : null;
    if (direct !== null) return direct;

    // Fallback: try to match by normalized key/label inclusions (existing behavior)
    for (const [rawKey, rawVal] of Object.entries(map)) {
        const nk = normalizeCareKey(rawKey);
        if (!targets.some((target) => target && nk.includes(target))) continue;
        const parsed = parseRawToRank(rawVal);
        if (parsed !== null) return parsed;
    }
    return null;
}

// Parse a single raw value (number/string) into rank 1-4 or null
function parseRankScalar(rawVal: any): number | null {
    if (rawVal === null || rawVal === undefined) return null;
    if (typeof rawVal === "number") {
        const n = Math.floor(rawVal);
        return n >= 1 && n <= 4 ? n : null;
    }
    if (typeof rawVal === "string") {
        const s = rawVal.trim();
        if (!s) return null;
        if (s.includes("未評価")) return null;
        const ascii = toHalfWidthDigits(s).toUpperCase();
        if (ascii.includes("AAA")) return 4;
        if (ascii.includes("AA")) return 3;
        if (ascii.includes("A")) return 2;
        if (ascii.includes("B")) return 1;
        const digits = ascii.replace(/[^0-9-]/g, "");
        if (digits) {
            const n = Number(digits);
            if (Number.isFinite(n) && n >= 1 && n <= 4) return Math.floor(n);
        }
    }
    return null;
}


function extractCareRankSeries(map: Record<string, any> | undefined): Array<number | null> {
    if (!map) return [];

    // 1) Try to find explicit NN-N keys -> map them directly
    const codeMap = new Map<string, number | null>();
    for (const [rawKey, rawVal] of Object.entries(map)) {
        const nk = normalizeCareKey(rawKey);
        const m = nk.match(/(\d{1,2}-\d{1,2})/);
        if (m) {
            const codeKey = m[1];
            if (!codeMap.has(codeKey)) {
                codeMap.set(codeKey, parseRankScalar(rawVal));
            }
        }
    }

    const allCodes = CARE_EVALUATION_MASTER.flatMap((cat) => cat.items.flatMap((it) => it.checkpoints.map((cp) => cp.code)));

    // If we have any explicit code keys, prefer building series from them
    if (codeMap.size > 0) {
        return allCodes.map((code) => (codeMap.has(code) ? codeMap.get(code) ?? null : null));
    }

    // 2) Fallback: derive sequence from map values ordering (best-effort)
    const sequentialRanks: number[] = [];
    for (const rawVal of Object.values(map)) {
        const parsed = parseRankScalar(rawVal);
        if (parsed !== null) sequentialRanks.push(parsed);
    }

    // Map sequence into series aligned with allCodes by index
    return allCodes.map((_, idx) => (idx < sequentialRanks.length ? sequentialRanks[idx] : null));
}

function sumAllNumbers(data?: JsonMap): number {
    if (!data) return 0;
    let sum = 0;
    for (const v of Object.values(data)) {
        const n = num(v);
        if (n) sum += n;
    }
    return sum;
}

// ---- Time normalization helpers ----
function normalizeTimeString(s?: string): string {
    return toHalfWidthDigits(String(s ?? "")).replace(/[\s\u3000]+/g, "");
}
function parseFlexibleTimeToSeconds(s?: string): number {
    const t = normalizeTimeString(s);
    if (!t) return 0;
    const m = t.match(/(\d+)分/);
    const sec = t.match(/(\d+)秒/);
    const mm = m ? parseInt(m[1], 10) : 0;
    const ss = sec ? parseInt(sec[1], 10) : 0;
    return mm * 60 + ss;
}

// Prefer totals like "総合計タイム" or "両手総合計" to avoid picking partial step times
function findPreferredTimeText(data?: JsonMap, preferredKeys: string[] = ["総合計タイム", "両手総合計", "両手総合計タイム"]): string {
    if (!data) return "";
    // 1) Look for explicit text like "mm分ss秒" on preferred keys
    for (const [k, v] of Object.entries(data)) {
        if (!preferredKeys.some(pk => String(k).includes(pk))) continue;
        if (typeof v !== "string") continue;
        const t = normalizeTimeString(v);
        const both = t.match(/(\d+)分(\d+)秒/);
        if (both) {
            const mm = parseInt(both[1], 10);
            const ss = parseInt(both[2], 10);
            return `${mm}分${String(ss).padStart(2, "0")}秒`;
        }
    }

    // 2) Check for numeric minute / second fields on preferred keys
    let prefMinutes: number | null = null;
    let prefSeconds: number | null = null;
    for (const [k, v] of Object.entries(data)) {
        if (!preferredKeys.some(pk => String(k).includes(pk))) continue;
        const n = num(v);
        if (n === null) continue;
        if (/分/.test(k) && prefMinutes === null) prefMinutes = n;
        if (/秒/.test(k) && prefSeconds === null) prefSeconds = n;
    }
    if ((prefMinutes ?? 0) || (prefSeconds ?? 0)) {
        const mm = prefMinutes ?? 0;
        const ss = prefSeconds ?? 0;
        return `${mm}分${String(ss).padStart(2, "0")}秒`;
    }

    return "";
}


function findTimeTextInData(data?: JsonMap): string {
    if (!data) return "";
    let bestOnlyMin: string | "" = "";
    for (const v of Object.values(data)) {
        if (typeof v !== "string") continue;
        const t = normalizeTimeString(v);

        const both = t.match(/(\d+)分(\d+)秒/);
        if (both) {
            const mm = parseInt(both[1], 10);
            const ss = parseInt(both[2], 10);
            return `${mm}分${String(ss).padStart(2, "0")}秒`;
        }
        const onlyM = t.match(/(\d+)分/);
        if (onlyM) {
            const mm = parseInt(onlyM[1], 10);
            bestOnlyMin = `${mm}分`;
        }
    }

    if (bestOnlyMin) return bestOnlyMin;

    // 3) As a final fallback, try to derive from numeric fields containing 分 / 秒 in their key names
    let minutes: number | null = null;
    let seconds: number | null = null;
    for (const [k, v] of Object.entries(data)) {
        const n = num(v);
        if (n === null) continue;
        if (/分/.test(k) && minutes === null) minutes = n;
        if (/秒/.test(k) && seconds === null) seconds = n;
    }
    if ((minutes ?? 0) || (seconds ?? 0)) {
        const mm = minutes ?? 0;
        const ss = seconds ?? 0;
        return `${mm}分${String(ss).padStart(2, "0")}秒`;
    }

    return "";
}

function radarDataForCategory(category: string, currentData?: JsonMap, averageData?: JsonMap) {
    const categoryKeys = {
        care: ["ケア"],
        one_color: ["ワンカラー"],
        time: ["タイム"],
        overall: ["総合"]
    };

    const keys = categoryKeys[category as keyof typeof categoryKeys] || ["総合"];

    const result = [];
    for (const key of keys) {
        const currentVal = currentData ? num(currentData[key]) : 0;
        const averageVal = averageData ? num(averageData[key]) : 0;

        result.push({
            name: key,
            "全国平均": averageVal,
            "今回": currentVal

        });
    }

    return result;
}


export default function CustomerDetail() {
    const { id } = useParams<{ id: string }>();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [assessment, setAssessment] = useState<any | null>(null);
    const [prevAssessment, setPrevAssessment] = useState<any | null>(null);
    const [prevScoresByCategory, setPrevScoresByCategory] = useState<Record<string, Record<string, number>>>({});
    const [prevTotalScore, setPrevTotalScore] = useState<number>(0);

    const [scoreCurrent, setScoreCurrent] = useState<JsonMap | undefined>();
    const [scorePrevious, setScorePrevious] = useState<JsonMap | undefined>();
    const [avgData, setAvgData] = useState<JsonMap | undefined>(); // 全国平均 (comparison.type = 'average')

    const [radarCurrent, setRadarCurrent] = useState<JsonMap | undefined>();
    const [radarAverage, setRadarAverage] = useState<JsonMap | undefined>();

    const [careScores, setCareScores] = useState<JsonMap | undefined>();
    const [oneColorScores, setOneColorScores] = useState<JsonMap | undefined>();
    const [timeScores, setTimeScores] = useState<JsonMap | undefined>();

    const [careEvaluationGraph, setCareEvaluationGraph] = useState<JsonMap | undefined>();
    const [careEvaluationGraphPrevious, setCareEvaluationGraphPrevious] = useState<JsonMap | undefined>();
    const [careComparison, setCareComparison] = useState<JsonMap | undefined>();
    const [careComparisonAverageData, setCareComparisonAverageData] = useState<JsonMap | undefined>();
    const [careComparisonPreviousData, setCareComparisonPreviousData] = useState<JsonMap | undefined>();
    const [careRadarChart, setCareRadarChart] = useState<JsonMap | undefined>();
    const [careRadarAverageData, setCareRadarAverageData] = useState<JsonMap | undefined>();
    // care_radar_chart blobs (current/previous)
    const [careRadarCurrentData, setCareRadarCurrentData] = useState<JsonMap | undefined>();
    const [careRadarPreviousData, setCareRadarPreviousData] = useState<JsonMap | undefined>();
    // care_score blobs (CSV ranges: AG〜BF current, DG〜EF previous)
    const [careScoreCurrentData, setCareScoreCurrentData] = useState<JsonMap | undefined>();
    const [careScorePreviousData, setCareScorePreviousData] = useState<JsonMap | undefined>();
    // one_color_score blobs (current/previous)
    const [oneColorScoreCurrentData, setOneColorScoreCurrentData] = useState<JsonMap | undefined>();
    const [oneColorScorePreviousData, setOneColorScorePreviousData] = useState<JsonMap | undefined>();
    const [oneColorEvaluationGraph, setOneColorEvaluationGraph] = useState<JsonMap | undefined>();
    const [oneColorEvaluationGraphPrevious, setOneColorEvaluationGraphPrevious] = useState<JsonMap | undefined>();
    const [oneColorComparison, setOneColorComparison] = useState<JsonMap | undefined>();
    // one color comparison average/previous (JO〜LA, OB〜PN)
    const [oneColorComparisonAverageData, setOneColorComparisonAverageData] = useState<JsonMap | undefined>();
    const [oneColorComparisonPreviousData, setOneColorComparisonPreviousData] = useState<JsonMap | undefined>();
    const [oneColorRadarChart, setOneColorRadarChart] = useState<JsonMap | undefined>();
    const [timeEvaluationGraph, setTimeEvaluationGraph] = useState<JsonMap | undefined>();
    const [timeComparison, setTimeComparison] = useState<JsonMap | undefined>();
    const [timeComparisonAverage, setTimeComparisonAverage] = useState<JsonMap | undefined>();
    const [timeRadarChart, setTimeRadarChart] = useState<JsonMap | undefined>();
    const [timeBothHandCurrentData, setTimeBothHandCurrentData] = useState<JsonMap | undefined>();
    const [timeBothHandPreviousData, setTimeBothHandPreviousData] = useState<JsonMap | undefined>();
    const [timeEvaluationGraphPreviousData, setTimeEvaluationGraphPreviousData] = useState<JsonMap | undefined>();
    const [prevTimeRaw, setPrevTimeRaw] = useState<string>("");
    const [prevRatings, setPrevRatings] = useState<{ total?: string; care?: string; one_color?: string; time?: string }>({});
    const [prevTotalFromBlob, setPrevTotalFromBlob] = useState<number>(0);
    const [prevCareTotalFromBlob, setPrevCareTotalFromBlob] = useState<number>(0);
    const [prevOneColorTotalFromBlob, setPrevOneColorTotalFromBlob] = useState<number>(0);
    const [prevTimeTotalFromBlob, setPrevTimeTotalFromBlob] = useState<number>(0);
    const [currTimeRaw, setCurrTimeRaw] = useState<string>("");
    const [activeTab, setActiveTab] = useState<string>("overall");
    const activeTabRef = useRef("overall");

    useEffect(() => {
        activeTabRef.current = activeTab;
    }, [activeTab]);

    const handleSavePdf = async () => {
        const captureElement = async (elementId: string) => {
            const element = document.getElementById(elementId);
            if (!element) throw new Error(`Element ${elementId} not found`);
            element.scrollIntoView({ block: "center" });
            return await elementToImage(elementId, {
                scale: 2,
                backgroundColor: "#ffffff",
            });
        };

        const waitForRender = (duration = 450) =>
            new Promise<void>((resolve) => {
                setTimeout(resolve, duration);
            });

        const switchTab = async (tabValue: string) => {
            if (activeTabRef.current !== tabValue) {
                setActiveTab(tabValue);
            }
            await waitForRender();
        };

        const sectionsPlan = [
            { tab: "overall", id: "pdf-overview-card", title: "総合サマリー" },
            { tab: "overall", id: "pdf-rank-explanation", title: "評価ランク説明" },
            { tab: "overall", id: "pdf-rank-standard-overall", title: "評価ランク表" },
            { tab: "care", id: "pdf-care-card", title: "ケア評価" },
            { tab: "care", id: "pdf-care-rank-standard", title: "ケア評価ランク表" },
            { tab: "onecolor", id: "pdf-onecolor-summary", title: "ワンカラー評価" },
            { tab: "onecolor", id: "pdf-onecolor-detail", title: "ワンカラー評価（詳細）" },
            { tab: "onecolor", id: "pdf-onecolor-rank-standard", title: "ワンカラー評価ランク表" },
            { tab: "time", id: "pdf-time-card", title: "タイム評価" },
            { tab: "time", id: "pdf-time-radar-card", title: "タイム詳細" },
        ];

        const sections: Array<{ title: string; image?: string }> = [];
        const previousTab = activeTabRef.current;

        try {
            toast({
                title: "PDF生成中...",
                description: "セクションを順番にキャプチャしています。",
            });

            for (const section of sectionsPlan) {
                try {
                    await switchTab(section.tab);
                    const image = await captureElement(section.id);
                    sections.push({ title: section.title, image });
                } catch (error) {
                    console.warn(`Failed to capture ${section.id}`, error);
                    sections.push({ title: section.title });
                }
            }

            await switchTab(previousTab);

            const filename = `${customer?.name || "customer"}_${customer?.application_date || "assessment"}.pdf`;

            await downloadPDF(
                {
                    customer,
                    sections,
                },
                filename,
            );

            toast({
                title: "PDF生成成功",
                description: "PDFファイルがダウンロードされました。",
            });
        } catch (e) {
            console.error("Failed to generate PDF", e);
            toast({
                title: "PDF生成エラー",
                description: "PDFの生成に失敗しました。",
                variant: "destructive",
            });
            await switchTab(previousTab);
        }
    };

    useEffect(() => {
        let alive = true;
        async function run() {
            if (!id) return;
            try {
                setLoading(true);

                const { data: cust, error: cErr } = await supabase.from("customers").select("*").eq("id", id).single();
                if (cErr) throw cErr;
                if (!alive) return;
                if (!cust) {
                    throw new Error("Customer not found");
                }
                setCustomer(cust as Customer);

                const { data: assessments, error: aErr } = await supabase
                    .from("assessments")
                    .select("*")
                    .eq("customer_id", id)
                    .eq("is_current", true)
                    .order("assessment_date", { ascending: false })
                    .order("created_at", { ascending: false })
                    .limit(1);
                if (aErr) throw aErr;

                if (!assessments || assessments.length === 0) {
                    setScoreCurrent({});
                    setScorePrevious({});
                    return;
                }
                const assessment = assessments[0];
                setAssessment(assessment);
                const { data: scoreRows, error: sErr } = await supabase
                    .from("scores")
                    .select("*")
                    .eq("assessment_id", assessment.id);
                if (sErr) console.error("Scores table error:", sErr);

                const { data: blobRows, error: bErr } = await supabase
                    .from("section_blobs")
                    .select("*")
                    .eq("assessment_id", assessment.id)
                    .in("section", [
                        "score",
                        "care_score",
                        "one_color_score",
                        "time_score",
                        "time_both_hand",
                        "care_evaluation_graph",
                        "care_comparison",
                        "care_radar_chart",
                        "one_color_evaluation_graph",
                        "final_one_color_comparison",
                        "one_color_comparison",
                        "one_color_radar_chart",
                        "time_evaluation_graph",
                        "time_lapse_comparison",
                        "time_radar_chart"
                    ]);
                if (bErr) console.error("Section blobs error:", bErr);

                const scorePrevBlob = blobRows?.find((b: any) => b.section === "score" && b.subtype === "previous");
                const scoreCurBlob = blobRows?.find((b: any) => b.section === "score" && b.subtype === "current");
                const carePrevBlob = blobRows?.find((b: any) => b.section === "care_score" && b.subtype === "previous");
                const onePrevBlob = blobRows?.find((b: any) => b.section === "one_color_score" && (b.subtype === "previous" || b.subtype === "final"));
                const oneEvalCurBlob = blobRows?.find((b: any) => b.section === "one_color_evaluation_graph" && (!b.subtype || b.subtype === "current"));
                const oneEvalPrevBlob = blobRows?.find((b: any) => b.section === "one_color_evaluation_graph" && (b.subtype === "previous" || b.subtype === "final"));
                const onePrevRadarBlob = blobRows?.find((b: any) => b.section === "one_color_radar_chart" && b.subtype === "previous");
                const timePrevBlob = blobRows?.find((b: any) => (b.section === "time_score" || b.section === "time_both_hand") && (b.subtype === "previous" || b.subtype === "final"));
                const timePrevEvalBlob = blobRows?.find((b: any) => b.section === "time_evaluation_graph" && (b.subtype === "previous" || b.subtype === "final"));
                const timePrevLapseBlob = blobRows?.find((b: any) => b.section === "time_lapse_comparison" && b.subtype === "previous");
                const timeAvgLapseBlob = blobRows?.find((b: any) => b.section === "time_lapse_comparison" && (b.subtype === "average" || b.subtype === "current"));
                const timeBothHandPrev = blobRows?.find((b: any) => b.section === "time_both_hand" && (b.subtype === "previous" || b.subtype === "final"));

                const prevOverallFromBlob = firstNum(
                    findNumByKeyIncludes(scorePrevBlob?.data as JsonMap, ["総合", "スコア"]),
                    (scorePrevBlob?.data && num((scorePrevBlob.data as any)["総合"])) ?? 0
                );
                const prevCareFromBlob = firstNum(
                    findNumByKeyIncludes(scorePrevBlob?.data as JsonMap, ["ケア", "スコア"]),
                    findNumByKeyIncludes(carePrevBlob?.data as JsonMap, ["総合"]),
                    sumAllNumbers(carePrevBlob?.data as JsonMap)
                );
                const prevOneFromBlob = firstNum(
                    // Prefer direct previous "score" totals
                    findNumByKeyIncludes(scorePrevBlob?.data as JsonMap, ["ワンカラー", "スコア"]),
                    // Fallback to section totals labeled as 総合/合計 in one_color_score / evaluation / radar
                    findNumByKeyIncludes(onePrevBlob?.data as JsonMap, ["総合"]),
                    findNumByKeyIncludes(oneEvalCurBlob?.data as JsonMap, ["総合"]),
                    findNumByKeyIncludes(oneEvalPrevBlob?.data as JsonMap, ["総合"]),
                    findNumByKeyIncludes(onePrevRadarBlob?.data as JsonMap, ["総合"]),
                    // Last resort: sum any numeric values present
                    sumAllNumbers(onePrevBlob?.data as JsonMap),
                    sumAllNumbers(oneEvalCurBlob?.data as JsonMap),
                    sumAllNumbers(oneEvalPrevBlob?.data as JsonMap),
                    sumAllNumbers(onePrevRadarBlob?.data as JsonMap)
                );
                const prevTimeFromBlob = firstNum(
                    // Prefer direct previous "score" totals
                    findNumByKeyIncludes(scorePrevBlob?.data as JsonMap, ["タイム", "スコア"]),
                    findNumByKeyIncludes(timePrevBlob?.data as JsonMap, ["総合"]),
                    findNumByKeyIncludes(timePrevEvalBlob?.data as JsonMap, ["総合"]),
                    findNumByKeyIncludes(timePrevLapseBlob?.data as JsonMap, ["総合"]),
                    sumAllNumbers(timePrevBlob?.data as JsonMap),
                    sumAllNumbers(timePrevEvalBlob?.data as JsonMap),
                    sumAllNumbers(timePrevLapseBlob?.data as JsonMap)
                );

                const prevTimeTextFromBlob =
                    // Strictly prefer totals on score/time blobs
                    findPreferredTimeText(scorePrevBlob?.data as JsonMap) ||
                    findPreferredTimeText(timePrevBlob?.data as JsonMap) ||
                    findPreferredTimeText(timePrevEvalBlob?.data as JsonMap) ||
                    findPreferredTimeText(timePrevLapseBlob?.data as JsonMap) ||
                    findTimeTextInData(scorePrevBlob?.data as JsonMap) ||
                    findTimeTextInData(timePrevBlob?.data as JsonMap) ||
                    findTimeTextInData(timePrevEvalBlob?.data as JsonMap) ||
                    findTimeTextInData(timePrevLapseBlob?.data as JsonMap);

                const timeBothHandCur = blobRows?.find((b: any) => b.section === "time_both_hand" && b.subtype === "current");
                const timeEvalCur = blobRows?.find((b: any) => b.section === "time_evaluation_graph" && b.subtype === "current");
                const currTimeTextFromBlob =
                    // Strictly prefer totals on score/time blobs
                    findPreferredTimeText(scoreCurBlob?.data as JsonMap) ||
                    findPreferredTimeText(timeBothHandCur?.data as JsonMap) ||
                    findPreferredTimeText(timeEvalCur?.data as JsonMap) ||

                    findTimeTextInData(scoreCurBlob?.data as JsonMap) ||
                    findTimeTextInData(timeBothHandCur?.data as JsonMap) ||
                    findTimeTextInData(timeEvalCur?.data as JsonMap);

                let finalPrevTimeText = currTimeTextFromBlob || prevTimeTextFromBlob || "";
                let finalCurrTimeText = prevTimeTextFromBlob || currTimeTextFromBlob || "";
                if (!finalCurrTimeText && assessment) {
                    const minutesVal = num(assessment.total_time_minutes) ?? 0;
                    const secondsVal = assessment.total_time_seconds as number | string | null | undefined;
                    const secondsStr = secondsVal === undefined || secondsVal === null ? "00" : String(secondsVal).padStart(2, "0");
                    finalCurrTimeText = `${minutesVal}分${secondsStr}秒`;
                }

                setPrevTimeRaw(finalPrevTimeText);
                setCurrTimeRaw(finalCurrTimeText);

                // Store previous totals (used as 全国平均)
                setPrevTotalFromBlob(prevOverallFromBlob || 0);
                setPrevCareTotalFromBlob(prevCareFromBlob || 0);
                setPrevOneColorTotalFromBlob(prevOneFromBlob || 0);
                setPrevTimeTotalFromBlob(prevTimeFromBlob || 0);
                const prevRatingTotalFromBlob = String((scorePrevBlob?.data as any)?.["総合評価"] || "");
                const prevRatingCareFromBlob = String((scorePrevBlob?.data as any)?.["ケア評価"] || "");
                const prevRatingOneFromBlob = String((scorePrevBlob?.data as any)?.["ワンカラー評価"] || "");
                const prevRatingTimeFromBlob = String((scorePrevBlob?.data as any)?.["タイム評価"] || "");
                if (prevRatingTotalFromBlob || prevRatingCareFromBlob || prevRatingOneFromBlob || prevRatingTimeFromBlob) {
                    setPrevRatings({
                        total: prevRatingTotalFromBlob || undefined,
                        care: prevRatingCareFromBlob || undefined,
                        one_color: prevRatingOneFromBlob || undefined,
                        time: prevRatingTimeFromBlob || undefined,
                    });
                }

                // Fallback: if 'score.previous' not found by assessment_id (or all zeros), try latest by customer_id
                if ((!scorePrevBlob || (!prevOverallFromBlob && !prevCareFromBlob && !prevOneFromBlob && !prevTimeFromBlob)) && id) {
                    const { data: fallbackPrevRows, error: fErr } = await supabase
                        .from("section_blobs")
                        .select("*")
                        .eq("customer_id", id)
                        .eq("section", "score")
                        .eq("subtype", "previous")
                        .order("created_at", { ascending: false })
                        .limit(1);
                    if (!fErr && fallbackPrevRows && fallbackPrevRows.length > 0) {
                        const fb: any = fallbackPrevRows[0];
                        const fbData: any = fb?.data || {};
                        const fbTotal = firstNum(
                            findNumByKeyIncludes(fbData, ["総合", "スコア"]),
                            fbData["総合"]
                        );
                        const fbCare = firstNum(
                            findNumByKeyIncludes(fbData, ["ケア", "スコア"]),
                            fbData["ケア"]
                        );
                        const fbOne = firstNum(
                            findNumByKeyIncludes(fbData, ["ワンカラー", "スコア"]),
                            fbData["ワンカラー"]
                        );
                        const fbTime = firstNum(
                            findNumByKeyIncludes(fbData, ["タイム", "スコア"]),
                            fbData["タイム"]
                        );
                        const fbTimeText = String(fbData["総合計タイム"] || "");

                        setPrevTotalFromBlob(fbTotal || 0);
                        setPrevCareTotalFromBlob(fbCare || 0);
                        setPrevOneColorTotalFromBlob(fbOne || 0);
                        setPrevTimeTotalFromBlob(fbTime || 0);
                        if (fbTimeText) setPrevTimeRaw(fbTimeText);

                        const prTotal = String(fbData["総合評価"] || "");
                        const prCare = String(fbData["ケア評価"] || "");
                        const prOne = String(fbData["ワンカラー評価"] || "");
                        const prTime = String(fbData["タイム評価"] || "");
                        if (prTotal || prCare || prOne || prTime) {
                            setPrevRatings((r) => ({
                                total: prTotal || r.total,
                                care: prCare || r.care,
                                one_color: prOne || r.one_color,
                                time: prTime || r.time,
                            }));
                        }
                    }
                }

                const scoresByCategory: Record<string, Record<string, number>> = {};
                scoreRows?.forEach((row) => {
                    if (!scoresByCategory[row.category]) {
                        scoresByCategory[row.category] = {};
                    }
                    scoresByCategory[row.category][row.sub_item] = row.score;
                });

                const sectionKeyMap: Record<string, string> = {
                    score: "score",
                    care_score: "care",
                    one_color_score: "one_color",
                    time_score: "time",
                    time_both_hand: "time",
                };
                blobRows?.forEach((row) => {

                    const scoreSections = new Set(["score", "care_score", "one_color_score", "time_score", "time_both_hand"]);
                    if (scoreSections.has(row.section) && row.subtype !== "current") {
                        return;
                    }
                    const normKey = sectionKeyMap[row.section] ?? row.section;
                    if (!scoresByCategory[normKey]) {
                        scoresByCategory[normKey] = {};
                    }
                    if (row.data && typeof row.data === "object") {
                        Object.entries(row.data).forEach(([key, value]) => {
                            if (typeof value === "number") {
                                scoresByCategory[normKey][key] = value;
                            } else if (typeof value === "string" && !isNaN(Number(value))) {
                                scoresByCategory[normKey][key] = Number(value);
                            }
                        });
                    }
                });

                // Extract detailed section data
                const sectionData: Record<string, JsonMap> = {};
                blobRows?.forEach((row) => {
                    if (row.data && typeof row.data === 'object') {
                        sectionData[row.section] = row.data as JsonMap;
                    }
                });

                let totalScore = 0;
                if (scoresByCategory.score && scoresByCategory.score['総合 スコア']) {
                    totalScore = scoresByCategory.score['総合 スコア'];
                } else if (scoresByCategory.score && scoresByCategory.score['総合スコア']) {
                    totalScore = scoresByCategory.score['総合スコア'];
                } else if (scoresByCategory.score && scoresByCategory.score['総合']) {
                    totalScore = scoresByCategory.score['総合'];
                } else {
                    // Sum up all scores if we can't find a total
                    Object.values(scoresByCategory).forEach(category => {
                        Object.values(category).forEach(value => {
                            if (typeof value === 'number') {
                                totalScore += value;
                            }
                        });
                    });
                }

                let prevAssessment: any = null;
                let prevScoreRows: any[] = [];
                let prevBlobRows: any[] = [];
                let prevScoresByCategory: Record<string, Record<string, number>> = {};
                let prevTotalScore: number = 0;

                const { data: prevAssessments } = await supabase
                    .from("assessments")
                    .select("*")
                    .eq("customer_id", id)
                    .eq("is_current", false)
                    .order("assessment_date", { ascending: false })
                    .limit(1);

                if (prevAssessments && prevAssessments.length > 0) {
                    prevAssessment = prevAssessments[0];

                    const { data: pScoreRows, error: pSErr } = await supabase
                        .from("scores")
                        .select("*")
                        .eq("assessment_id", prevAssessment.id);
                    if (pSErr) console.error("Previous scores error:", pSErr);
                    prevScoreRows = pScoreRows || [];

                    // Fetch previous blobs
                    const { data: pBlobRows, error: pBErr } = await supabase
                        .from("section_blobs")
                        .select("*")
                        .eq("customer_id", id)
                        .in("section", ["score", "care_score", "one_color_score", "time_score", "care_evaluation_graph", "care_comparison", "care_radar_chart", "one_color_evaluation_graph", "one_color_comparison", "one_color_radar_chart", "time_evaluation_graph", "time_lapse_comparison", "time_radar_chart"])
                        .lte("created_at", prevAssessment.assessment_date);
                    if (pBErr) console.error("Previous blobs error:", pBErr);
                    prevBlobRows = pBlobRows || [];

                    // Aggregate previous scores
                    prevScoreRows.forEach((row) => {
                        if (!prevScoresByCategory[row.category]) {
                            prevScoresByCategory[row.category] = {};
                        }
                        prevScoresByCategory[row.category][row.sub_item] = row.score;
                    });

                    prevBlobRows.forEach((row) => {
                        if (!prevScoresByCategory[row.section]) {
                            prevScoresByCategory[row.section] = {};
                        }
                        if (row.data && typeof row.data === 'object') {
                            Object.entries(row.data).forEach(([key, value]) => {
                                if (typeof value === 'number') {
                                    prevScoresByCategory[row.section][key] = value;
                                } else if (typeof value === 'string' && !isNaN(Number(value))) {
                                    prevScoresByCategory[row.section][key] = Number(value);
                                }
                            });
                        }
                    });

                    // Calculate previous total
                    prevTotalScore = num(prevAssessment.total_score) || 0;
                    if (prevTotalScore === 0) {
                        // Fallback sum
                        Object.values(prevScoresByCategory).forEach(category => {
                            Object.values(category).forEach(value => {
                                if (typeof value === 'number') {
                                    prevTotalScore += value;
                                }
                            });
                        });
                    }
                }

                const prev = {
                    assessment: prevAssessment,
                    scoresByCategory: prevScoresByCategory,
                    total_score: prevTotalScore
                };

                setPrevAssessment(prev.assessment);
                setPrevScoresByCategory(prev.scoresByCategory);
                setPrevTotalScore(prev.total_score);

                setPrevRatings((r) => ({
                    total: (prev.assessment?.total_rating as string) || r.total,
                    care: (prev.assessment?.care_rating as string) || r.care,
                    one_color: (prev.assessment?.one_color_rating as string) || r.one_color,
                    time: (prev.assessment?.time_rating as string) || r.time,
                }));

                // 前回 assessment 行が存在しない場合は、score.previous（同一 assessment_id）からフォールバック
                if ((!prev.assessment || !prev.total_score) && (typeof prevOverallFromBlob === "number")) {
                    setPrevTotalScore(prevOverallFromBlob || 0);
                    setPrevScoresByCategory({
                        care: { 総合: (prevCareFromBlob || 0) as number },
                        one_color: { 総合: (prevOneFromBlob || 0) as number },
                        time: { 総合: (prevTimeFromBlob || 0) as number },
                    } as any);
                }

                const { data: compRows, error: compErr } = await supabase
                    .from("section_blobs")
                    .select("*")
                    .eq("customer_id", id)
                    .eq("section", "comparison")
                    .eq("subtype", "average");
                if (compErr) console.error("Comparison rows error:", compErr);
                const avg = compRows?.[0] as JsonbRow | undefined;

                const { data: radarRows, error: rErr } = await supabase
                    .from("section_blobs")
                    .select("*")
                    .eq("assessment_id", assessment.id)
                    .in("section", ["radar_chart", "comparison"]);

                if (rErr) console.error("Radar rows error:", rErr);

                const rCur = radarRows?.find((r) => r.section === "radar_chart" && r.subtype === "current") as JsonbRow | undefined;
                const rAvg = radarRows?.find((r) => r.section === "radar_chart" && r.subtype === "average") as JsonbRow | undefined || avg; // fallback to comparison average

                if (!alive) return;
                // Create a flat structure for scoreCurrent
                const flatScores: JsonMap = {};
                Object.values(scoresByCategory).forEach(category => {
                    Object.entries(category).forEach(([key, value]) => {
                        flatScores[key] = value;
                    });
                });

                // Create flat structure for scorePrevious
                const flatPrevScores: JsonMap = {};
                if (prev) {
                    Object.values(prev.scoresByCategory).forEach(category => {
                        Object.entries(category).forEach(([key, value]) => {
                            flatPrevScores[key] = value;
                        });
                    });
                }

                // Ensure data is properly typed
                const safeAvgData = avg?.data || {};
                const safeRadarCurrent = rCur?.data || {};
                const safeRadarAverage = (rAvg as JsonbRow | undefined)?.data || {};

                setScoreCurrent(flatScores);
                setScorePrevious(flatPrevScores);
                setAvgData(safeAvgData);
                setRadarCurrent(safeRadarCurrent);
                setRadarAverage(safeRadarAverage);

                // Set structured scores for display
                setCareScores(scoresByCategory?.care || {});
                setOneColorScores(scoresByCategory?.one_color || {});
                setTimeScores(scoresByCategory?.time || {});
                const prevCareScores = (prev?.scoresByCategory && prev.scoresByCategory["care"]) || {};
                const prevOneColorScores = (prev?.scoresByCategory && prev.scoresByCategory["one_color"]) || {};
                const prevTimeScores = (prev?.scoresByCategory && prev.scoresByCategory["time"]) || {};
                setCareComparison(sectionData?.care_comparison || {});

                // Prefer assessment-scoped comparison rows
                let careCompAvgRow = blobRows?.find((b: any) => b.section === "care_comparison" && b.subtype === "average");
                let careCompPrevRow = blobRows?.find((b: any) => b.section === "care_comparison" && (b.subtype === "final" || b.subtype === "previous"));

                const careEvalCurRowInitial = blobRows?.find((b: any) => b.section === "care_evaluation_graph" && (!b.subtype || b.subtype === "current"));
                let careEvalPrevRow = blobRows?.find((b: any) => b.section === "care_evaluation_graph" && (b.subtype === "previous" || b.subtype === "final"));
                let careEvalCurRow = careEvalCurRowInitial;
                setCareRadarChart(sectionData?.care_radar_chart || {});

                let careRadarCurBlob = blobRows?.find((b: any) => b.section === "care_radar_chart" && b.subtype === "current");
                let careRadarPrevBlob = blobRows?.find((b: any) => b.section === "care_radar_chart" && (b.subtype === "previous" || b.subtype === "final"));
                let careRadarAvgBlob = blobRows?.find((b: any) => b.section === "care_radar_chart" && b.subtype === "average");
                const isEmptyRadarBlob = (row: any) =>
                    !row || !row.data || (typeof row.data === "object" && Object.keys(row.data || {}).length === 0);
                if (isEmptyRadarBlob(careRadarCurBlob) || isEmptyRadarBlob(careRadarPrevBlob) || isEmptyRadarBlob(careRadarAvgBlob)) {
                    const { data: careRadarByCustomer } = await supabase
                        .from("section_blobs")
                        .select("*")
                        .eq("customer_id", id)
                        .eq("section", "care_radar_chart")
                        .order("created_at", { ascending: false })
                        .limit(10);
                    if (careRadarByCustomer && careRadarByCustomer.length) {
                        careRadarAvgBlob =
                            isEmptyRadarBlob(careRadarAvgBlob)
                                ? careRadarByCustomer.find((r: any) => r.section === "care_radar_chart" && r.subtype === "average") || careRadarAvgBlob
                                : careRadarAvgBlob;
                        careRadarPrevBlob =
                            isEmptyRadarBlob(careRadarPrevBlob)
                                ? careRadarByCustomer.find((r: any) => r.section === "care_radar_chart" && (r.subtype === "previous" || r.subtype === "final")) || careRadarPrevBlob
                                : careRadarPrevBlob;
                        careRadarCurBlob =
                            isEmptyRadarBlob(careRadarCurBlob)
                                ? careRadarByCustomer.find((r: any) => r.section === "care_radar_chart" && r.subtype === "current") || careRadarCurBlob
                                : careRadarCurBlob;
                    }
                }
                if (careRadarCurBlob && careRadarCurBlob.data) setCareRadarCurrentData(careRadarCurBlob.data as JsonMap);
                if (careRadarPrevBlob && careRadarPrevBlob.data) setCareRadarPreviousData(careRadarPrevBlob.data as JsonMap);
                const avgRadarMap =
                    ((careRadarAvgBlob?.data as JsonMap) ||
                        (avg?.data as JsonMap) ||
                        (careRadarPrevBlob?.data as JsonMap) ||
                        {}) as JsonMap;
                setCareRadarAverageData(avgRadarMap);
                let careScoreCurBlob = blobRows?.find((b: any) => b.section === "care_score" && b.subtype === "current");
                let careScorePrevBlob = blobRows?.find((b: any) => b.section === "care_score" && (b.subtype === "previous" || b.subtype === "final"));
                const isEmptyData = (row: any) => !row || !row.data || (typeof row.data === "object" && Object.keys(row.data || {}).length === 0);
                if (isEmptyData(careScoreCurBlob) || isEmptyData(careScorePrevBlob)) {
                    const { data: careScoreByCustomer } = await supabase
                        .from("section_blobs")
                        .select("*")
                        .eq("customer_id", id)
                        .eq("section", "care_score")
                        .order("created_at", { ascending: false })
                        .limit(10);
                    if (careScoreByCustomer && careScoreByCustomer.length) {
                        careScoreCurBlob = careScoreCurBlob && !isEmptyData(careScoreCurBlob)
                            ? careScoreCurBlob
                            : careScoreByCustomer.find((r: any) => r.subtype === "current") || careScoreByCustomer[0];
                        careScorePrevBlob = careScorePrevBlob && !isEmptyData(careScorePrevBlob)
                            ? careScorePrevBlob
                            : careScoreByCustomer.find((r: any) => r.subtype === "previous" || r.subtype === "final") || careScoreByCustomer[1] || careScoreByCustomer[0];
                    }
                }
                setCareScoreCurrentData((careScoreCurBlob?.data as JsonMap) || {});
                setCareScorePreviousData((careScorePrevBlob?.data as JsonMap) || {});
                let oneColorScoreCurBlob = blobRows?.find((b: any) => b.section === "one_color_score" && b.subtype === "current");
                let oneColorScorePrevBlob = blobRows?.find((b: any) => b.section === "one_color_score" && (b.subtype === "previous" || b.subtype === "final")) || onePrevBlob;
                const isEmptyOC = (row: any) => !row || !row.data || (typeof row.data === "object" && Object.keys(row.data || {}).length === 0);
                if (isEmptyOC(oneColorScoreCurBlob) || isEmptyOC(oneColorScorePrevBlob)) {
                    const { data: ocRowsByCustomer } = await supabase
                        .from("section_blobs")
                        .select("*")
                        .eq("customer_id", id)
                        .eq("section", "one_color_score")
                        .order("created_at", { ascending: false })
                        .limit(10);
                    if (ocRowsByCustomer && ocRowsByCustomer.length) {
                        oneColorScoreCurBlob = oneColorScoreCurBlob && !isEmptyOC(oneColorScoreCurBlob)
                            ? oneColorScoreCurBlob
                            : ocRowsByCustomer.find((r: any) => r.subtype === "current") || ocRowsByCustomer[0];
                        oneColorScorePrevBlob = oneColorScorePrevBlob && !isEmptyOC(oneColorScorePrevBlob)
                            ? oneColorScorePrevBlob
                            : ocRowsByCustomer.find((r: any) => (r.subtype === "previous" || r.subtype === "final")) || ocRowsByCustomer[1] || ocRowsByCustomer[0];
                    }
                }
                setOneColorScoreCurrentData((oneColorScoreCurBlob?.data as JsonMap) || {});
                setOneColorScorePreviousData((oneColorScorePrevBlob?.data as JsonMap) || {});

                // Fallbacks for care_comparison (average and previous/final) by customer when assessment-scoped rows are missing/empty
                if (isEmptyData(careCompAvgRow) || isEmptyData(careCompPrevRow) || isEmptyData(careEvalPrevRow) || isEmptyData(careEvalCurRow)) {
                    const { data: careRowsByCustomer } = await supabase
                        .from("section_blobs")
                        .select("*")
                        .eq("customer_id", id)
                        .in("section", ["care_comparison", "care_evaluation_graph"])
                        .order("created_at", { ascending: false })
                        .limit(20);
                    if (careRowsByCustomer && careRowsByCustomer.length) {
                        careCompAvgRow = careCompAvgRow && !isEmptyData(careCompAvgRow)
                            ? careCompAvgRow
                            : careRowsByCustomer.find((r: any) => r.section === "care_comparison" && r.subtype === "average") || careCompAvgRow;
                        careCompPrevRow = careCompPrevRow && !isEmptyData(careCompPrevRow)
                            ? careCompPrevRow
                            : careRowsByCustomer.find((r: any) => r.section === "care_comparison" && (r.subtype === "final" || r.subtype === "previous")) || careCompPrevRow;
                        careEvalPrevRow = careEvalPrevRow && !isEmptyData(careEvalPrevRow)
                            ? careEvalPrevRow
                            : careRowsByCustomer.find((r: any) => r.section === "care_evaluation_graph" && (r.subtype === "previous" || r.subtype === "final")) || careEvalPrevRow;
                        careEvalCurRow = careEvalCurRow && !isEmptyData(careEvalCurRow)
                            ? careEvalCurRow
                            : careRowsByCustomer.find((r: any) => r.section === "care_evaluation_graph" && (!r.subtype || r.subtype === "current")) || careEvalCurRow;
                    }
                }
                setCareComparisonAverageData((careCompAvgRow?.data as JsonMap) || {});
                setCareComparisonPreviousData((careCompPrevRow?.data as JsonMap) || {});
                setCareEvaluationGraph((careEvalCurRow?.data as JsonMap) || {});
                setCareEvaluationGraphPrevious((careEvalPrevRow?.data as JsonMap) || {});
                setOneColorEvaluationGraph((oneEvalCurBlob?.data as JsonMap) || (sectionData?.one_color_evaluation_graph as JsonMap) || {});
                setOneColorEvaluationGraphPrevious((oneEvalPrevBlob?.data as JsonMap) || {});
                const ocAvgRow = blobRows?.find((b: any) => b.section === "one_color_comparison" && b.subtype === "average");
                const ocPrevRow = blobRows?.find((b: any) => b.section === "final_one_color_comparison" && (b.subtype === "final" || b.subtype === "previous"));

                setOneColorComparison(sectionData?.final_one_color_comparison || sectionData?.one_color_comparison || {});

                // Fallbacks for one_color_comparison (average and previous/final) by customer when assessment-scoped rows are missing/empty
                const isEmptyCmpRow = (row: any) => !row || !row.data || (typeof row.data === "object" && Object.keys(row.data || {}).length === 0);
                let ocAvg = ocAvgRow;
                let ocPrev = ocPrevRow;
                const isEmptyEval = (row: any) => !row || !row.data || (typeof row.data === "object" && Object.keys(row.data || {}).length === 0);
                let ocEvalCurRow = oneEvalCurBlob;
                let ocEvalPrevRow = oneEvalPrevBlob;
                if (isEmptyCmpRow(ocAvg) || isEmptyCmpRow(ocPrev) || isEmptyEval(ocEvalCurRow) || isEmptyEval(ocEvalPrevRow)) {
                    const { data: ocRowsByCustomer } = await supabase
                        .from("section_blobs")
                        .select("*")
                        .eq("customer_id", id)
                        .in("section", ["one_color_comparison", "final_one_color_comparison", "one_color_evaluation_graph"])
                        .order("created_at", { ascending: false })

                    if (ocRowsByCustomer && ocRowsByCustomer.length) {
                        ocAvg = ocAvg && !isEmptyCmpRow(ocAvg)
                            ? ocAvg
                            : ocRowsByCustomer.find((r: any) => r.section === "one_color_comparison" && r.subtype === "average") || ocAvg;
                        ocPrev = ocPrev && !isEmptyCmpRow(ocPrev)
                            ? ocPrev
                            : ocRowsByCustomer.find((r: any) => r.section === "final_one_color_comparison" && (r.subtype === "final" || r.subtype === "previous")) || ocPrev;
                        ocEvalCurRow = ocEvalCurRow && !isEmptyEval(ocEvalCurRow)
                            ? ocEvalCurRow
                            : ocRowsByCustomer.find((r: any) => r.section === "one_color_evaluation_graph" && (!r.subtype || r.subtype === "current")) || ocEvalCurRow;
                        ocEvalPrevRow = ocEvalPrevRow && !isEmptyEval(ocEvalPrevRow)
                            ? ocEvalPrevRow
                            : ocRowsByCustomer.find((r: any) => r.section === "one_color_evaluation_graph" && (r.subtype === "previous" || r.subtype === "final")) || ocEvalPrevRow;
                    }
                }
                // Set with sensible fallbacks (use generic comparison average data if available)
                setOneColorComparisonAverageData(((ocAvg?.data as JsonMap) || (avg?.data as JsonMap) || {}));
                setOneColorComparisonPreviousData((ocPrev?.data as JsonMap) || {});
                setOneColorRadarChart(sectionData?.one_color_radar_chart || {});
                setTimeBothHandCurrentData((timeBothHandCur?.data as JsonMap) || {});
                setTimeBothHandPreviousData((timeBothHandPrev?.data as JsonMap) || (timePrevBlob?.data as JsonMap) || {});
                setTimeEvaluationGraph((timeEvalCur?.data as JsonMap) || (sectionData?.time_evaluation_graph as JsonMap) || {});
                setTimeEvaluationGraphPreviousData((timePrevEvalBlob?.data as JsonMap) || {});
                setTimeComparisonAverage((timeAvgLapseBlob?.data as JsonMap) || {});
                setTimeComparison((timePrevLapseBlob?.data as JsonMap) || {});
                setTimeRadarChart(sectionData?.time_radar_chart || {});

            } catch (e: any) {
                toast({
                    variant: "destructive",
                    title: "読み込みに失敗しました",
                    description: e?.message ?? "Unknown error",
                });
            } finally {
                if (alive) setLoading(false);
            }
        }
        run();
        return () => {
            alive = false;
        };
    }, [id, toast]);

    // Derived totals / ranks
    const totalCur = useMemo(() => {
        // First try to get total score from the assessment data
        if (assessment) {
            const assessmentScore = num(assessment.total_score) || 0;
            return assessmentScore;
        }

        if (scoreCurrent && typeof scoreCurrent === 'object') {
            const totalScore = num(scoreCurrent['総合 スコア']) || num(scoreCurrent['総合スコア']) || num(scoreCurrent['総合']) || 0;
            return totalScore;
        }

        const careTotal = sumKeys(careScores) || 0;
        const oneColorTotal = sumKeys(oneColorScores) || 0;
        const timeTotal = sumKeys(timeScores) || 0;
        const total = careTotal + oneColorTotal + timeTotal;
        return total;
    }, [assessment, scoreCurrent, careScores, oneColorScores, timeScores]);

    const prevCareTotal = useMemo(() => {
        // Prefer blob-derived "previous" total for 全国平均; fallback to aggregated previous scores
        if (prevCareTotalFromBlob) return prevCareTotalFromBlob;
        const scores = prevScoresByCategory.care || {};
        const direct = (num((scores as any)["総合"]) ?? num((scores as any)["総合 スコア"])) as number | null;
        if (direct !== null) return direct;
        return Object.values(scores).reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0);
    }, [prevScoresByCategory, prevCareTotalFromBlob]);

    const prevOneColorTotal = useMemo(() => {
        if (prevOneColorTotalFromBlob) return prevOneColorTotalFromBlob;
        const scores = prevScoresByCategory.one_color || {};
        const direct = (num((scores as any)["総合"]) ?? num((scores as any)["総合 スコア"])) as number | null;
        if (direct !== null) return direct;
        return Object.values(scores).reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0);
    }, [prevScoresByCategory, prevOneColorTotalFromBlob]);

    const prevTimeTotal = useMemo(() => {
        if (prevTimeTotalFromBlob) return prevTimeTotalFromBlob;
        const scores = prevScoresByCategory.time || {};
        const direct = (num((scores as any)["総合"]) ?? num((scores as any)["総合 スコア"])) as number | null;
        if (direct !== null) return direct;
        return Object.values(scores).reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0);
    }, [prevScoresByCategory, prevTimeTotalFromBlob]);
    const totalPrev = useMemo(() => {
        if (prevTotalScore) return prevTotalScore;
        if (prevTotalFromBlob) return prevTotalFromBlob;

        // Sum of category totals from blob (ケア/ワンカラー/タイム) if available
        const blobCatSum = (prevCareTotalFromBlob || 0) + (prevOneColorTotalFromBlob || 0) + (prevTimeTotalFromBlob || 0);
        if (blobCatSum > 0) return blobCatSum;

        // Last resort: sum from aggregated previous category scores
        const calcSum = (prevCareTotal || 0) + (prevOneColorTotal || 0) + (prevTimeTotal || 0);
        if (calcSum > 0) return calcSum;

        return sumKeys(scorePrevious) || 0;
    }, [
        prevTotalScore,
        prevTotalFromBlob,
        prevCareTotalFromBlob,
        prevOneColorTotalFromBlob,
        prevTimeTotalFromBlob,
        prevCareTotal,
        prevOneColorTotal,
        prevTimeTotal,
        scorePrevious
    ]);

    const totalAvg = useMemo(() => {
        // 全国平均は前回（totalPrev）と同義
        return totalPrev;
    }, [totalPrev]);
    const maxByAxis = { 総合: 1320, ケア: 410, ワンカラー: 610, タイム: 300 } as Record<AxisKey, number>; // from the screenshot
    const totalMax = 1320;

    const careRankChartData = useMemo<CareRankDatum[]>(() => {
        const currentMaps = [ensureRecord(careEvaluationGraph)].filter(
            (m): m is Record<string, any> => !!m && Object.keys(m).length > 0
        );

        const previousMaps = [ensureRecord(careEvaluationGraphPrevious)].filter(
            (m): m is Record<string, any> => !!m && Object.keys(m).length > 0
        );

        const nationalMaps = [
            ensureRecord(careComparisonAverageData),
        ].filter((m): m is Record<string, any> => !!m && Object.keys(m).length > 0);

        const readRank = (maps: Record<string, any>[], code: string, label: string) => {
            for (const map of maps) {
                const value = extractRankValue(map, code, label);
                if (value !== null && value >= 1 && value <= 4) return value;
            }
            return null;
        };

        const rows: CareRankDatum[] = [];
        CARE_EVALUATION_MASTER.forEach((category) => {
            category.items.forEach((item) => {
                item.checkpoints.forEach((cp) => {
                    const nationalRank = readRank(nationalMaps, cp.code, cp.label);
                    const prevRank = readRank(previousMaps, cp.code, cp.label);
                    const currRank = readRank(currentMaps, cp.code, cp.label);
                    rows.push({
                        label: `${cp.code} ${cp.label}`,
                        rowIndex: rows.length,
                        national: nationalRank,
                        prev: prevRank,
                        curr: currRank,
                    });
                });
            });
        });

        return rows;
    }, [careEvaluationGraph, careEvaluationGraphPrevious, careComparisonAverageData]);

    const careRankByCode = useMemo(() => {
        const map = new Map<string, CareRankDatum>();
        careRankChartData.forEach((row) => {
            const [code] = row.label.split(" ");
            if (code) {
                map.set(code, row);
            }
        });
        return map;
    }, [careRankChartData]);

    const totalRank = useMemo(() => {
        // First try to get rank from assessment data
        if (assessment && assessment.total_rating) {
            console.log("Rank from assessment rating:", assessment.total_rating);
            return assessment.total_rating;
        }

        const calculatedRank = rankFromScore(totalCur, totalMax);
        return calculatedRank;
    }, [assessment, totalCur, totalMax]);

    const prevTimeText = useMemo(() => {
        let seconds = 0;
        if (prevTimeRaw) seconds = parseFlexibleTimeToSeconds(prevTimeRaw);
        if (seconds === 0) {
            seconds = ((num(prevAssessment?.total_time_minutes) ?? 0) * 60) + (num(prevAssessment?.total_time_seconds) ?? 0);
        }
        return formatTime(seconds);
    }, [prevTimeRaw, prevAssessment]);

    const currTimeText = useMemo(() => {
        let seconds = 0;
        if (currTimeRaw) seconds = parseFlexibleTimeToSeconds(currTimeRaw);
        if (seconds === 0) {
            seconds = ((num(assessment?.total_time_minutes) ?? 0) * 60) + (num(assessment?.total_time_seconds) ?? 0);
        }
        return formatTime(seconds);
    }, [currTimeRaw, assessment]);

    const prevTimeDisplay = useMemo(() => {
        let mins = 0;
        let secs = 0;
        if (prevTimeRaw) {
            const t = normalizeTimeString(prevTimeRaw);
            const m = t.match(/(\d+)分/);
            const s = t.match(/(\d+)秒/);
            mins = m ? parseInt(m[1], 10) : 0;
            secs = s ? parseInt(s[1], 10) : 0;
        } else if (prevAssessment) {
            mins = num(prevAssessment.total_time_minutes) ?? 0;
            secs = num(prevAssessment.total_time_seconds) ?? 0;
        }

        return `${mins}分${String(secs).padStart(2, '0')}秒`;
    }, [prevTimeRaw, prevAssessment]);

    const currTimeDisplay = useMemo(() => {
        let mins = 0;
        let secs = 0;
        if (currTimeRaw) {
            const t = normalizeTimeString(currTimeRaw);
            const m = t.match(/(\d+)分/);
            const s = t.match(/(\d+)秒/);
            mins = m ? parseInt(m[1], 10) : 0;
            secs = s ? parseInt(s[1], 10) : 0;
        } else if (assessment) {
            mins = num(assessment.total_time_minutes) ?? 0;
            secs = num(assessment.total_time_seconds) ?? 0;
        }
        return `${mins}分${String(secs).padStart(2, '0')}秒`;
    }, [currTimeRaw, assessment]);

    const timeCurrentScore = useMemo(() => {
        return (
            num(assessment?.time_score) ??
            num(scoreCurrent?.["タイム スコア"]) ??
            num(scoreCurrent?.["タイム"]) ??
            0
        );
    }, [assessment, scoreCurrent]);

    const timePreviousScore = prevTimeTotal || prevTimeTotalFromBlob || 0;

    const structuredData = useMemo(() => {
        const rows: any[] = [];
        const curFrom = (assVal: unknown, ...fallbackKeys: string[]) => {
            const a = num(assVal);
            if (a !== null) return a;
            for (const k of fallbackKeys) {
                const v = num((scoreCurrent as any)?.[k]);
                if (v !== null) return v;
            }
            return 0;
        };

        const pickFromMap = (map: any, candidates: string[]): number | null => {
            if (!map || typeof map !== "object") return null;
            for (const [k, raw] of Object.entries(map)) {
                if (!candidates.some((c) => String(k).includes(c))) continue;
                const direct = num(raw);
                if (direct !== null && direct > 3) return direct;
                const s = String(raw ?? "");
                const m = s.match(/(\d+)\s*\/\s*\d+/);
                if (m) {
                    const n = Number(m[1]);
                    if (Number.isFinite(n)) return n;
                }
            }
            return null;
        };
        const avgFrom = (avgKey: "総合" | "ケア" | "ワンカラー" | "タイム", prevVal: number) => {
            const candidates: Record<"総合" | "ケア" | "ワンカラー" | "タイム", string[]> = {
                "総合": ["総合 スコア", "総合スコア", "総合"],
                "ケア": ["ケア スコア", "ケア"],
                "ワンカラー": ["ワンカラー スコア", "ワンカラー", "ワン カラー"],
                "タイム": ["タイム スコア", "タイム"],
            };
            const keys = (candidates && candidates[avgKey]) ? candidates[avgKey] : [avgKey];
            const v = pickFromMap(avgData as any, keys);
            return v !== null && v > 3 ? v : prevVal;
        };
        const totalAvg = avgFrom("総合", totalPrev);
        const totalCurScore = curFrom(assessment?.total_score);

        rows.push({
            key: "総合評価",
            denom: 1320,
            avg: { rating: prevRatings.total || rankFromScore(totalAvg, 1320), score: totalAvg },
            prev: { rating: prevRatings.total || rankFromScore(totalPrev, 1320), score: totalPrev },
            curr: { rating: (assessment?.total_rating as string) || rankFromScore(totalCurScore, 1320), score: totalCurScore }
        });

        const carePrev = prevCareTotal || prevCareTotalFromBlob;
        const careAvg = avgFrom("ケア", carePrev);
        const careCur = curFrom(assessment?.care_score);
        rows.push({
            key: "ケア",
            denom: 410,
            avg: { rating: prevRatings.care || rankFromScore(careAvg, 410), score: careAvg },
            prev: { rating: prevRatings.care || rankFromScore(carePrev, 410), score: carePrev },
            curr: { rating: (assessment?.care_rating as string) || rankFromScore(careCur, 410), score: careCur }
        });

        const onePrev = prevOneColorTotal || prevOneColorTotalFromBlob;
        const oneAvg = avgFrom("ワンカラー", onePrev);

        const oneCur = curFrom(assessment?.one_color_score);
        rows.push({
            key: "ワンカラー",
            denom: 610,
            avg: { rating: prevRatings.one_color || rankFromScore(oneAvg, 610), score: oneAvg },
            prev: { rating: prevRatings.one_color || rankFromScore(onePrev, 610), score: onePrev },
            curr: { rating: (assessment?.one_color_rating as string) || rankFromScore(oneCur, 610), score: oneCur }
        });

        const timePrev = prevTimeTotal || prevTimeTotalFromBlob;
        const timeAvg = avgFrom("タイム", timePrev);
        const timeCur = curFrom(assessment?.time_score);

        rows.push({
            key: "タイム",
            denom: 300,
            avg: { rating: prevRatings.time || rankFromScore(timeAvg, 300), score: timeAvg },
            prev: { rating: prevRatings.time || rankFromScore(timePrev, 300), score: timePrev },
            curr: { rating: (assessment?.time_rating as string) || rankFromScore(timeCur, 300), score: timeCur }
        });

        return rows;
    }, [prevRatings, assessment, totalPrev, totalCur, totalRank, careScores, oneColorScores, timeScores, prevCareTotal, prevOneColorTotal, prevTimeTotal, prevCareTotalFromBlob, prevOneColorTotalFromBlob, prevTimeTotalFromBlob]);


    const prevAggData = useMemo(() => ({
        総合: totalPrev,
        ケア: prevCareTotal || prevCareTotalFromBlob,
        ワンカラー: prevOneColorTotal || prevOneColorTotalFromBlob,
        タイム: prevTimeTotal || prevTimeTotalFromBlob
    }), [
        totalPrev,
        prevCareTotal, prevOneColorTotal, prevTimeTotal,
        prevCareTotalFromBlob, prevOneColorTotalFromBlob, prevTimeTotalFromBlob
    ]);


    const radarRows = useMemo(() => {

        const totalMax = 1320;
        const careMax = 410;
        const oneColorMax = 610;
        const timeMax = 300;

        return [
            {
                name: "総合",
                "National Average": (totalAvg / totalMax) * 100,
                Previous: (totalPrev / totalMax) * 100,
                Current: (totalCur / totalMax) * 100
            },
            {
                name: "ケア",
                "National Average": ((prevAggData.ケア || 0) / careMax) * 100,
                Previous: ((prevAggData.ケア || 0) / careMax) * 100,
                Current: (((num(assessment?.care_score) ?? 0)) / careMax) * 100
            },
            {
                name: "ワンカラー",
                "National Average": ((prevAggData.ワンカラー || 0) / oneColorMax) * 100,
                Previous: ((prevAggData.ワンカラー || 0) / oneColorMax) * 100,
                Current: (((num(assessment?.one_color_score) ?? 0)) / oneColorMax) * 100
            },
            {
                name: "タイム",
                "National Average": ((prevAggData.タイム || 0) / timeMax) * 100,
                Previous: ((prevAggData.タイム || 0) / timeMax) * 100,
                Current: (((num(assessment?.time_score) ?? 0)) / timeMax) * 100
            },
        ];
    }, [totalAvg, totalPrev, totalCur, prevAggData, scoreCurrent, assessment]);

    const careRadarData = useMemo(() => {
        return radarDataForCategory("care", careScores, prevAggData);
    }, [careScores, prevAggData]);

    const oneColorRadarData = useMemo(() => {
        return radarDataForCategory("one_color", oneColorScores, prevAggData);
    }, [oneColorScores, prevAggData]);

    const timeRadarData = useMemo(() => {
        return radarDataForCategory("time", timeScores, prevAggData);
    }, [timeScores, prevAggData]);

    const liteFlagValue = useMemo(() => {
        if (!scoreCurrent) return undefined;
        const candidateKeys = ["正規/ライト", "正規／ライト"];
        for (const key of candidateKeys) {
            if (key in scoreCurrent) {
                return scoreCurrent[key];
            }
        }
        return undefined;
    }, [scoreCurrent]);

    const shouldShowLiteNotice = liteFlagValue === null;

    return (
        <div className="flex min-h-screen bg-[#faf7f6]">
            <Sidebar />
            <main className="flex-1">

                <div className="mx-auto max-w-6xl px-3 py-4 md:px-6">
                    <div className="mb-3 flex items-center justify-between">
                        <div className="flex flex-col leading-tight">
                            <h1 className="text-[15px] font-bold text-gray-900 md:text-[25px]">
                                基礎スキルチェック
                            </h1>
                            <div className="text-[13px] tracking-wide text-gray-500 uppercase mt-2">
                                BASIC NAIL SKILLS CHECK
                            </div>
                        </div>
                    </div>
                    <LiteNoticeBanner visible={shouldShowLiteNotice} />
                    <div className="bg-[#fff6f5] p-1 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 mt-7">

                        <div>
                            <div className="text-lg font-semibold text-slate-750">
                                {customer?.name ?? "—"} 様
                            </div>
                            <div className="mt-1 text-xs text-slate-560 space-x-4">
                                <span>ID：{customer?.external_id ?? "—"}</span>
                                <span>採点日：{customer?.application_date ?? "—"}</span>
                            </div>
                            <Button
                                size="sm"
                                className="mt-3 bg-[#16929F] hover:bg-emerald-700 text-white text-xs rounded-md"
                                onClick={handleSavePdf}>
                                <Download className="w-4 h-4 mr-1" />
                                PDFで保存
                            </Button>
                        </div>

                        <div className="grid grid-cols-2 gap-3 w-full sm:w-auto">

                            <div className="bg-white rounded-lg shadow-sm border border-pink-200 overflow-hidden w-[95%]">
                                <div className="bg-[#FB9793] text-white text-center text-sm py-2 font-medium">
                                    スコア
                                </div>
                                <div className="p-4 flex items-center justify-center gap-3">
                                    <div className="bg-pink-50 rounded-full p-2">
                                        <Edit className="w-5 h-5 text-pink-400" />
                                    </div>
                                    <div className="flex items-baseline">
                                        <span className="text-3xl font-bold text-gray-800">{totalCur ?? "1051"}</span>
                                        <span className="text-gray-500 text-base ml-1">/{totalMax ?? "1320"}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-lg shadow-sm border border-pink-200 overflow-hidden w-[97%]">
                                <div className="bg-[#FB9793] text-white text-center text-sm py-2 font-medium">
                                    評価ランク
                                </div>
                                <div className="p-4 flex items-center justify-center gap-3">
                                    <div className="bg-pink-50 rounded-full p-2">
                                        <Crown className="w-5 h-5 text-pink-400" />
                                    </div>
                                    <div className="text-3xl font-bold text-gray-800">{totalRank ?? "—"}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <br />
                    <div className="mb-3">
                        <Tabs value={activeTab} onValueChange={setActiveTab}>
                            <AssessmentTabs />
                            <TabsContent value="overall">

                                <Card id="pdf-overview-card">
                                    {/* <div className="mb-3 flex items-center gap-2">
                                        <Chip tone="info">全国平均</Chip>
                                        <Chip tone="danger">今回</Chip>
                                    </div> */}

                                    <div className="w-full">

                                        <table className="w-full border-collapse text-sm text-slate-700">
                                            <thead>

                                                <tr>
                                                    <th rowSpan={2}
                                                        className="w-32 bg-[#e5e5e5] border border-[#dddddd] px-3 py-3 text-left font-semibold">
                                                        カテゴリー
                                                    </th>
                                                    <th
                                                        colSpan={2}
                                                        className="bg-[#4fb1bc] border border-[#dddddd] px-3 py-3 text-center text-white font-semibold"
                                                    >
                                                        全国平均
                                                    </th>
                                                    <th
                                                        colSpan={2}
                                                        className="bg-[#fb9793] border border-[#dddddd] px-3 py-3 text-center text-white font-semibold"
                                                    >
                                                        今回
                                                    </th>
                                                    <th
                                                        colSpan={2}
                                                        className="w-24 bg-[#fb9793] border border-[#dddddd] px-3 py-3 text-center text-white font-semibold"
                                                    >
                                                        比較
                                                    </th>
                                                </tr>


                                                <tr>
                                                    <th className="bg-[#6ebec7] border border-[#dddddd] px-3 py-2 text-center text-white text-xs">
                                                        評価ランク
                                                    </th>
                                                    <th className="bg-[#6ebec7] border border-[#dddddd] px-3 py-2 text-center text-white text-xs">
                                                        スコア
                                                    </th>
                                                    <th className="bg-[#ffb3ae] border border-[#dddddd] px-3 py-2 text-center text-white text-xs">
                                                        評価ランク
                                                    </th>
                                                    <th className="bg-[#ffb3ae] border border-[#dddddd] px-3 py-2 text-center text-white text-xs">
                                                        スコア
                                                    </th>
                                                    <th className="bg-[#ffb3ae] border border-[#dddddd] px-1 py-2 text-center text-slate-700 text-xs text-white">
                                                        平均
                                                    </th>
                                                    <th className="bg-[#ffb3ae] border border-[#dddddd] px-1 py-2 text-center text-slate-700 text-xs text-white">
                                                        前回
                                                    </th>
                                                </tr>
                                            </thead>

                                            <tbody>
                                                {structuredData.map((item) => {

                                                    const diffAvg = item.curr.score - item.avg.score;
                                                    const diffPrev = item.curr.score - item.prev.score;
                                                    const arrow = (d: number) => (d > 0 ? "↑" : d < 0 ? "↓" : "→");
                                                    const cls = (d: number) =>
                                                        d > 0
                                                            ? "text-[#0083c5] font-bold"
                                                            : d < 0
                                                                ? "text-[#e94444] font-bold"
                                                                : "text-slate-500";

                                                    const isCurrentDisabled =
                                                        item.curr?.disabled;

                                                    return (
                                                        <tr key={item.key} className="align-middle">

                                                            <td className="bg-[#f2f2f2] border border-[#dddddd] px-3 py-3 font-medium whitespace-nowrap">
                                                                {item.key}
                                                            </td>

                                                            <td className="border border-[#dddddd] px-3 py-3 text-center bg-white">
                                                                <span className="font-semibold text-[#138495]">
                                                                    {item.avg.rating}
                                                                </span>
                                                            </td>

                                                            <td className="border border-[#dddddd] px-3 py-3 text-center bg-white">
                                                                <span className="font-semibold text-[#138495]">
                                                                    {item.avg.score}
                                                                </span>{" "}
                                                                <span className="text-slate-400">/ {item.denom}</span>
                                                                {item.key === "タイム" ? (
                                                                    <div className="mt-2 pt-2 border-t border-[#dddddd] text-[#138495] font-bold">
                                                                        {prevTimeDisplay}
                                                                    </div>
                                                                ) : null}
                                                            </td>

                                                            <td
                                                                className={
                                                                    "border border-[#dddddd] px-3 py-3 text-center " +
                                                                    (isCurrentDisabled ? "bg-[#c4c4c4]" : "bg-[#fff7f7]")
                                                                }
                                                            >
                                                                {!isCurrentDisabled ? (
                                                                    <span className="font-semibold text-[#e94444]">
                                                                        {item.curr.rating}
                                                                    </span>
                                                                ) : null}
                                                            </td>

                                                            <td
                                                                className={
                                                                    "border border-[#dddddd] px-3 py-3 text-center " +
                                                                    (isCurrentDisabled ? "bg-[#c4c4c4]" : "bg-[#fff7f7]")
                                                                }
                                                            >
                                                                {!isCurrentDisabled ? (
                                                                    <>
                                                                        <span className="font-semibold text-[#e94444]">
                                                                            {item.curr.score}
                                                                        </span>{" "}
                                                                        <span className="text-slate-400">/ {item.denom}</span>
                                                                        {item.key === "タイム" ? (
                                                                            <div className="mt-2 pt-2 border-t border-[#f3cfcf] text-[#e94444] font-bold">
                                                                                {currTimeDisplay}
                                                                            </div>
                                                                        ) : null}
                                                                    </>
                                                                ) : null}
                                                            </td>
                                                            <td className="border border-[#dddddd] px-1 py-3 text-center bg-white">
                                                                <span className={cls(diffAvg)}>{arrow(diffAvg)}</span>
                                                            </td>
                                                            <td className="border border-[#dddddd] px-1 py-3 text-center bg-white">
                                                                <span className={cls(diffPrev)}>{arrow(diffPrev)}</span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                    <OverviewRadar radarRows={radarRows} structuredData={structuredData} />
                                </Card>
                                <br />
                                <div id="pdf-rank-explanation" className="w-full bg-white p-6">

                                    <h3 className="text-base font-semibold mb-3">評価ランク説明</h3>
                                    <br />
                                    <div>
                                        <table
                                            className="w-full border border-[#AFAFAF] border-separate border-spacing-0 text-sm text-slate-700"
                                        >
                                            <thead>
                                                <tr>

                                                    <th
                                                        className="w-[160px] bg-[#d5d5d5] border-r border-b border-[#AFAFAF] px-4 py-3 text-center font-semibold"
                                                    >
                                                        評価ランク
                                                    </th>
                                                    <th
                                                        className="w-[200px] bg-[#d5d5d5] border-r border-b border-[#AFAFAF] px-4 py-3 text-center font-semibold"
                                                    >
                                                        評価ランク
                                                    </th>
                                                    <th
                                                        className="bg-[#d5d5d5] border-b border-[#d4d4d4] text-center px-4 py-3 font-semibold"
                                                    >
                                                        説明
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr>
                                                    <td className="bg-[#F6F6F6] text-center border-r border-b border-[#d4d4d4] px-4 py-3 font-semibold">
                                                        AAA
                                                    </td>
                                                    <td className="bg-[#F6F6F6] text-center border-r border-b border-[#d4d4d4] px-4 py-3">
                                                        講師レベル
                                                    </td>
                                                    <td className="border-b border-[#d4d4d4] text-left px-4 py-3 leading-relaxed">
                                                        <div className="font-semibold">- 感動を生み出す極上のワンカラー</div>
                                                        <div className="mt-1">
                                                            ワンカラーを極め、すべての爪に理想の仕上がりを再現できる精度・スピード・再現性のすべてが最高水準で、他者への指導・教育が対応できる。
                                                        </div>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td className="bg-[#F6F6F6] text-center border-r border-b border-[#d4d4d4] px-4 py-3 font-semibold">
                                                        AA
                                                    </td>
                                                    <td className="bg-[#F6F6F6] text-center border-r border-b border-[#d4d4d4] px-4 py-3">
                                                        人気ネイリストレベル
                                                    </td>
                                                    <td className="border-b border-[#d4d4d4] text-left px-4 py-3 leading-relaxed">
                                                        <div className="font-semibold">- 指名を生む感動ワンカラー</div>
                                                        <div className="mt-1">
                                                            美しさと速さのバランスに優れ、顧客満足とリピートを安定して生み出しトップサロンで通用する。
                                                        </div>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td className="bg-[#F6F6F6] text-center border-r border-b border-[#d4d4d4] px-4 py-3 font-semibold">
                                                        A
                                                    </td>
                                                    <td className="bg-[#F6F6F6] text-center border-r border-b border-[#d4d4d4] px-4 py-3">
                                                        サロン実務レベル
                                                    </td>
                                                    <td className="border-b border-[#d4d4d4] text-left px-4 py-3 leading-relaxed">
                                                        <div className="font-semibold">- 安心を届けるプロのワンカラー</div>
                                                        <div className="mt-1">
                                                            サロンワークに求められるワンカラーを、安定した仕上がりで再現できるプロ基準の技術力を有する。
                                                        </div>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td className="bg-[#F6F6F6] text-center border-r border-[#d4d4d4] px-4 py-3 font-semibold">
                                                        B
                                                    </td>
                                                    <td className="bg-[#F6F6F6] text-center border-r border-[#d4d4d4] px-4 py-3">
                                                        トレーニングレベル
                                                    </td>
                                                    <td className="border-[#d4d4d4] text-left px-4 py-3 leading-relaxed">
                                                        <div className="font-semibold">- プロ基準のワンカラーへの第一歩</div>
                                                        <div className="mt-1">
                                                            塗布精度・フォルム・スピードを習得中の段階。プロ基準のワンカラー技術へ改善の余地がある。
                                                        </div>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                <div id="pdf-rank-standard-overall">
                                    <EvaluationRankStandardTable />
                                </div>
                            </TabsContent>

                            <TabsContent value="care">

                                <Card id="pdf-care-card">
                                    {(() => {
                                        const denom = 410;
                                        const avgScore = (prevCareTotal || prevCareTotalFromBlob || 0) as number;
                                        const curScore = (num(assessment?.care_score) ?? num(scoreCurrent?.["ケア スコア"]) ?? num(scoreCurrent?.["ケア"]) ?? 0) as number;
                                        const avgRank = (prevRatings.care as string) || rankFromScore(avgScore, denom);
                                        const curRank = (assessment?.care_rating as string) || rankFromScore(curScore, denom);
                                        return (
                                            <>
                                                <table className="w-full border-collapse text-sm text-slate-700">
                                                    <thead>
                                                        <tr>
                                                            <th rowSpan={2} className="w-32 bg-[#e5e5e5] border border-[#dddddd] px-3 py-3 text-left font-semibold">
                                                                カテゴリー
                                                            </th>
                                                            <th colSpan={2} className="bg-[#4fb1bc] border border-[#dddddd] px-3 py-3 text-center text-white font-semibold">
                                                                全国平均
                                                            </th>
                                                            <th colSpan={2} className="bg-[#fb9793] border border-[#dddddd] px-3 py-3 text-center text-white font-semibold">
                                                                今回
                                                            </th>
                                                        </tr>
                                                        <tr>
                                                            <th className="bg-[#6ebec7] border border-[#dddddd] px-3 py-2 text-center text-white text-xs">
                                                                評価ランク
                                                            </th>
                                                            <th className="bg-[#6ebec7] border border-[#dddddd] px-3 py-2 text-center text-white text-xs">
                                                                スコア
                                                            </th>
                                                            <th className="bg-[#ffb3ae] border border-[#dddddd] px-3 py-2 text-center text-white text-xs">
                                                                評価ランク
                                                            </th>
                                                            <th className="bg-[#ffb3ae] border border-[#dddddd] px-3 py-2 text-center text-white text-xs">
                                                                スコア
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        <tr className="align-middle">
                                                            <td className="bg-[#4fb1bc] text-white border border-[#dddddd] px-3 py-3 font-medium whitespace-nowrap">
                                                                ケア
                                                            </td>
                                                            <td className="border border-[#dddddd] px-3 py-3 text-center bg-white">
                                                                <span className="font-semibold text-[#138495]">{avgRank}</span>
                                                            </td>
                                                            <td className="border border-[#dddddd] px-3 py-3 text-center bg-white">
                                                                <span className="font-semibold text-[#138495]">{avgScore}</span>{" "}
                                                                <span className="text-slate-400">/ {denom}</span>
                                                            </td>
                                                            <td className="border border-[#dddddd] px-3 py-3 text-center bg-[#fff7f7]">
                                                                <span className="font-semibold text-[#e94444]">{curRank}</span>
                                                            </td>
                                                            <td className="border border-[#dddddd] px-3 py-3 text-center bg-[#fff7f7]">
                                                                <span className="font-semibold text-[#e94444]">{curScore}</span>{" "}
                                                                <span className="text-slate-400">/ {denom}</span>
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table><br />
                                                <div className="w-full">
                                                    <table className="w-full border-collapse text-sm text-slate-700">
                                                        <thead>
                                                            <tr>
                                                                <th rowSpan={2} className="w-24 bg-[#6ebec7] text-white border border-[#d4d4d4] px-3 py-2 text-center text-white">カテゴリー</th>
                                                                <th rowSpan={2} className="w-44 bg-[#6ebec7] border border-[#d4d4d4] px-3 py-2 text-center text-white">評価項目</th>
                                                                <th rowSpan={2} className="w-12 bg-[#6ebec7] border border-[#d4d4d4] px-3 py-2 text-center text-white">必須</th>
                                                                <th colSpan={2} className="bg-[#6ebec7] border border-[#d4d4d4] px-3 py-2 text-center text-white">チェックポイント</th>
                                                                <th rowSpan={2} className="w-12 bg-[#6ebec7] border border-[#d4d4d4] px-3 py-2 text-center text-white">配点</th>
                                                                <th colSpan={2} className="w-24 bg-[#6ebec7] text-white border border-[#d4d4d4] px-3 py-2 text-center">平均</th>
                                                                <th colSpan={1} className="w-24 bg-[#fb9793] text-white border border-[#d4d4d4] px-3 py-2 text-center">今回</th>
                                                                <th colSpan={4} className="w-40 bg-[#6ebec7] border border-[#d4d4d4] px-3 py-2 text-center text-white">評価グラフ</th>
                                                            </tr>
                                                            <tr>
                                                                <th className="bg-[#6ebec7] border border-[#d4d4d4] px-2 py-1 text-center text-xs text-white">番号</th>
                                                                <th className="bg-[#6ebec7] border border-[#d4d4d4] px-2 py-1 text-center text-xs text-white">内容</th>
                                                                <th className="bg-[#8eced4] text-white border border-[#d4d4d4] px-2 py-1 text-center text-xs">比較</th>
                                                                <th className="bg-[#8eced4] text-white border border-[#d4d4d4] px-2 py-1 text-center text-xs">スコア</th>
                                                                <th className="bg-[#ffb3ae] text-white border border-[#d4d4d4] px-2 py-1 text-center text-xs">スコア</th>
                                                                <th className="bg-[#FFE78E] border border-[#d4d4d4] px-2 py-1 text-center text-xs text-[#4FB1BC]">B</th>
                                                                <th className="bg-[#6ebec7] border border-[#d4d4d4] px-2 py-1 text-center text-xs text-white">A</th>
                                                                <th className="bg-[#6ebec7] border border-[#d4d4d4] px-2 py-1 text-center text-xs text-white ">AA</th>
                                                                <th className="bg-[#6ebec7] border border-[#d4d4d4] px-2 py-1 text-center text-xs text-white">AAA</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {(() => {

                                                                const ensureMapCare = (m: any): Record<string, any> => {
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
                                                                let currentBlob = ensureMapCare(careScoreCurrentData);
                                                                let previousBlob = ensureMapCare(careScorePreviousData);
                                                                const isEmpty = (m: Record<string, any>) => !m || Object.keys(m).length === 0;
                                                                if (isEmpty(currentBlob) && careEvaluationGraph && Object.keys(careEvaluationGraph).length) {
                                                                    currentBlob = careEvaluationGraph as Record<string, any>;
                                                                }
                                                                if (isEmpty(previousBlob)) {
                                                                    if (careEvaluationGraphPrevious && Object.keys(careEvaluationGraphPrevious).length) {
                                                                        previousBlob = careEvaluationGraphPrevious as Record<string, any>;
                                                                    } else {
                                                                        previousBlob = {} as Record<string, any>;
                                                                    }
                                                                }
                                                                const normalizeKey = (s: string) =>
                                                                    (typeof s === "string" ? s : String(s))
                                                                        .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xFEE0))
                                                                        .replace(/[‐‑–—−ーｰ－]/g, "-")
                                                                        .replace(/[［］【】\[\]\(\)\s\u3000]/g, "");

                                                                const getScore = (map: Record<string, any>, code: string, label: string) => {
                                                                    if (!map || Object.keys(map).length === 0) return 0;
                                                                    const nCode = normalizeKey(code || "");
                                                                    const nCodeA = normalizeKey(`[ケア] ${code}`);
                                                                    const nCodeB = normalizeKey(`ケア${code}`);
                                                                    const nLabel = normalizeKey(label || "");

                                                                    for (const [rawKey, rawVal] of Object.entries(map)) {
                                                                        const nk = normalizeKey(rawKey);
                                                                        if (
                                                                            (nCode && nk.includes(nCode)) ||
                                                                            (nCodeA && nk.includes(nCodeA)) ||
                                                                            (nCodeB && nk.includes(nCodeB)) ||
                                                                            (nLabel && nk.includes(nLabel))
                                                                        ) {
                                                                            const num = Number(String((rawVal as any) ?? "").replace(/[^\d.-]/g, ""));
                                                                            if (!Number.isNaN(num)) return num;
                                                                        }
                                                                    }
                                                                    return 0;
                                                                };
                                                                const ArrowGlyph = ({ dir }: { dir: "up" | "right" | "down" }) => {
                                                                    const color = dir === "up" ? "#1a73e8" : dir === "down" ? "#f44336" : "#2ea44f";
                                                                    const rotation = dir === "right" ? 90 : dir === "down" ? 180 : 0;
                                                                    return (
                                                                        <svg
                                                                            width="30"
                                                                            height="20"
                                                                            viewBox="0 0 24 24"
                                                                            style={{ transform: `rotate(${rotation}deg)` }}
                                                                            aria-hidden="true"
                                                                            focusable="false"
                                                                        >
                                                                            <path d="M10 18v-6H7l5-6 5 6h-3v6h-2z" fill={color} />
                                                                        </svg>
                                                                    );
                                                                };
                                                                const arrowFrom = (v?: number | null) => {
                                                                    if (v === 1) return <ArrowGlyph dir="up" />;
                                                                    if (v === 2) return <ArrowGlyph dir="right" />;
                                                                    if (v === 3) return <ArrowGlyph dir="down" />;
                                                                    return <span>—</span>;
                                                                };
                                                                const getComp = (map: JsonMap | undefined, code: string, label: string) => {
                                                                    if (!map) return undefined;
                                                                    const nCode = normalizeKey(code || "");
                                                                    const nLabel = normalizeKey(label || "");
                                                                    const entry =
                                                                        Object.entries(map).find(([k]) => {
                                                                            const nk = normalizeKey(k);
                                                                            return (nCode && nk.includes(nCode)) || (nLabel && nk.includes(nLabel));
                                                                        }) || null;

                                                                    if (!entry) return undefined;
                                                                    const val = entry[1];
                                                                    // Prefer numeric 1/2/3 if present
                                                                    const n = typeof val === "number" ? val : Number(String(val).replace(/[^\d.-]/g, ""));
                                                                    if (Number.isFinite(n) && n !== 0) return n;
                                                                    // Map arrow glyphs to 1/2/3
                                                                    if (typeof val === "string") {
                                                                        const s = val;
                                                                        if (/[↗↑]/.test(s)) return 1;
                                                                        if (/[→➡]/.test(s)) return 2;
                                                                        if (/[↘↓]/.test(s)) return 3;
                                                                    }
                                                                    return undefined;
                                                                };

                                                                const getEvaluationRank = (map: Record<string, any> | undefined, code: string, label: string): number | null => {
                                                                    return extractRankValue(map, code, label);
                                                                };

                                                                const renderEvaluationGraph = (prevRank: number | null, currRank: number | null) => {
                                                                    if (!prevRank && !currRank) {
                                                                        return (
                                                                            <div className="flex h-4 items-center justify-center rounded bg-[#fce2de] text-[10px] font-medium text-[#a8b0bb]">
                                                                            </div>
                                                                        );
                                                                    }

                                                                    const rankToWidth = (rank: number) => `${Math.max(0, Math.min(4, rank)) * 25}%`;
                                                                    return (
                                                                        <div className="relative h-7 rounded bg-[#f8fbfd]">
                                                                            <div className="absolute inset-0 grid grid-cols-4">
                                                                                <div className="border-r border-dashed border-[#d8e4ec]" />
                                                                                <div className="border-r border-dashed border-[#d8e4ec]" />
                                                                                <div className="border-r border-dashed border-[#d8e4ec]" />
                                                                                <div />
                                                                            </div>
                                                                            <div className="absolute inset-x-[6px] inset-y-0">
                                                                                {prevRank && (
                                                                                    <div
                                                                                        className="absolute left-0 top-[28%] h-[4px] rounded-full bg-[#3D80B8]"
                                                                                        style={{ width: rankToWidth(prevRank) }}
                                                                                    />
                                                                                )}
                                                                                {currRank && (
                                                                                    <div
                                                                                        className="absolute left-0 bottom-[28%] h-[4px] rounded-full bg-[#F24822]"
                                                                                        style={{ width: rankToWidth(currRank) }}
                                                                                    />
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                };

                                                                const buildSeqPuller = (map: Record<string, any> | undefined) => {
                                                                    const toCompNum = (v: any) => {
                                                                        if (typeof v === "number") return v;
                                                                        const s = String(v ?? "");
                                                                        if (/[↗↑]/.test(s)) return 1;
                                                                        if (/[→➡]/.test(s)) return 2;
                                                                        if (/[↘↓]/.test(s)) return 3;
                                                                        const n = Number(s.replace(/[^\d.-]/g, ""));
                                                                        return Number.isFinite(n) ? n : undefined;
                                                                    };
                                                                    // Prefer ordering by checkpoint code "NN-N" when present to align with table rows
                                                                    const entries = Object.entries(map || {});
                                                                    const parsed = entries.map(([k, v]) => {
                                                                        const nk = normalizeKey(k);
                                                                        const m = nk.match(/(\d{1,2})-(\d{1,2})/);
                                                                        const keyOrder = m ? [parseInt(m[1], 10), parseInt(m[2], 10)] : [999, 999];
                                                                        return { keyOrder, num: toCompNum(v) };
                                                                    });
                                                                    parsed.sort((a, b) => (a.keyOrder[0] - b.keyOrder[0]) || (a.keyOrder[1] - b.keyOrder[1]));
                                                                    const nums = parsed.map(p => p.num).filter((v) => v !== undefined) as number[];
                                                                    let idx = 0;
                                                                    return () => (idx < nums.length ? nums[idx++] : undefined);
                                                                };
                                                                const nextAvgComp = buildSeqPuller(careComparisonAverageData as any);

                                                                const avgCompMap = ensureMapCare(careComparisonAverageData);
                                                                const prevCompMap = ensureMapCare(careComparisonPreviousData);
                                                                const evalCurrentMap = ensureMapCare(careEvaluationGraph);
                                                                const evalPreviousMap = ensureMapCare(careEvaluationGraphPrevious);

                                                                const seriesPrev = extractCareRankSeries(evalPreviousMap);
                                                                const seriesCurr = extractCareRankSeries(evalCurrentMap);
                                                                let overallIdx = 0;

                                                                return CARE_EVALUATION_MASTER.flatMap((cat) => {

                                                                    const catRowSpan = cat.items.reduce((s, it) => s + it.checkpoints.length, 0);
                                                                    let catRendered = false;

                                                                    return cat.items.flatMap((it) => {
                                                                        const itemRowSpan = it.checkpoints.length;
                                                                        return it.checkpoints.map((cp, idx) => {
                                                                            const points = cp.points ?? 10;
                                                                            const avgComp = getComp(avgCompMap, cp.code, cp.label) ?? nextAvgComp();
                                                                            const avgScore = getScore(previousBlob, cp.code, cp.label);
                                                                            const curScore = getScore(currentBlob, cp.code, cp.label);
                                                                            const prevRank = seriesPrev[overallIdx] ?? null;
                                                                            const currRank = seriesCurr[overallIdx] ?? null;
                                                                            overallIdx++;
                                                                            const rankValues = [prevRank, currRank].filter(
                                                                                (rank): rank is number => typeof rank === "number"
                                                                            );
                                                                            const isRankB =
                                                                                rankValues.length > 0 && rankValues.every((rank) => rank === 1);
                                                                            const yellowBgClass = isRankB ? "bg-[#FFE78E]" : "";

                                                                            return (
                                                                                <tr key={`${cat.name}-${it.id}-${cp.code}`} className="border-b">
                                                                                    {!catRendered && (
                                                                                        <td className="border border-[#d4d4d4] bg-[#eef7f8] text-slate-700 px-3 py-2 text-center align-top" rowSpan={catRowSpan}>
                                                                                            {cat.name}
                                                                                        </td>
                                                                                    )}
                                                                                    {!idx && (
                                                                                        <td className="border border-[#d4d4d4] px-3 py-2 align-top" rowSpan={itemRowSpan}>
                                                                                            {`${it.id}. ${it.title}`}
                                                                                        </td>
                                                                                    )}
                                                                                    {!idx && (
                                                                                        <td
                                                                                            className="border border-[#d4d4d4] px-3 py-2 text-center align-top"
                                                                                            rowSpan={itemRowSpan}
                                                                                        >
                                                                                            {it.required ? "★" : ""}
                                                                                        </td>
                                                                                    )}
                                                                                    <td className={`border border-[#d4d4d4] px-2 py-2 text-center w-14 ${yellowBgClass}`}>{cp.code}</td>
                                                                                    <td className={`border border-[#d4d4d4] px-3 py-2 ${yellowBgClass}`}>{cp.label}</td>
                                                                                    <td className={`border border-[#d4d4d4] px-2 py-2 text-center ${yellowBgClass}`}>{points}</td>
                                                                                    <td className={`border border-[#d4d4d4] px-2 py-2 text-center ${yellowBgClass}`}>{arrowFrom(avgComp)}</td>
                                                                                    <td className={`border border-[#d4d4d4] px-2 py-2 text-center ${yellowBgClass}`}>{avgScore || 0}</td>
                                                                                    <td className={`border border-[#d4d4d4] px-2 py-2 text-center ${yellowBgClass}`}>{curScore || 0}</td>
                                                                                    <td
                                                                                        colSpan={4}
                                                                                        className="border border-[#d4d4d4] bg-white px-2 py-2 align-top"
                                                                                    >
                                                                                        {renderEvaluationGraph(prevRank, currRank)}
                                                                                    </td>

                                                                                    {(catRendered = true) && null}
                                                                                </tr>
                                                                            );
                                                                        });
                                                                    });
                                                                });
                                                            })()}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </>
                                        );
                                    })()}
                                </Card>
                                <Card id="pdf-onecolor-detail" className="mt-4">
                                    {(() => {
                                        const hasKeys = (map?: JsonMap): map is JsonMap =>
                                            !!map && typeof map === "object" && Object.keys(map).length > 0;

                                        const fallbackMap = (primary?: JsonMap, fallback?: JsonMap) =>
                                            hasKeys(primary) ? primary : hasKeys(fallback) ? (fallback as JsonMap) : undefined;

                                        const parseNumber = (value: any): number => {
                                            const direct = num(value);
                                            if (direct !== null) return direct;
                                            if (typeof value === "string") {
                                                const match = value.replace(/[,A-Za-z]+/g, "").match(/-?\d+(\.\d+)?/);
                                                if (match) return Number(match[0]);
                                            }
                                            return 0;
                                        };
                                        const pickValue = (map: JsonMap | undefined, keys: string[]): number => {
                                            if (!map) return 0;
                                            for (const [key, value] of Object.entries(map)) {
                                                if (keys.some((needle) => key.includes(needle))) {
                                                    const parsed = parseNumber(value);
                                                    if (!Number.isNaN(parsed)) return parsed;
                                                }
                                            }
                                            return 0;
                                        };

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
                                            return typeof m === "object" ? m as Record<string, any> : {};
                                        };
                                        const isEmptyObj = (m: Record<string, any>) => !m || Object.keys(m).length === 0;
                                        let curBlob = ensureCareMap(careScoreCurrentData);
                                        let prevBlob = ensureCareMap(careScorePreviousData);
                                        const evalCur = ensureCareMap(careEvaluationGraph);
                                        const evalPrev = ensureCareMap(careEvaluationGraphPrevious);

                                        // if (isEmptyObj(curBlob) && !isEmptyObj(evalCur)) curBlob = evalCur;
                                        // if (isEmptyObj(prevBlob) && !isEmptyObj(evalPrev)) prevBlob = evalPrev;

                                        const normalizeKey = (s: string) =>
                                            (typeof s === "string" ? s : String(s))
                                                .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xFEE0))
                                                .replace(/[‐‑–—−ーｰ－]/g, "-")
                                                .replace(/[［］【】\\[\\]\\(\\)\\s\u3000]/g, "");

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
                                            // Fallback by category name if code not parseable
                                            if (fallbackCategory?.includes("オフ")) return "オフ／フィル";
                                            if (fallbackCategory?.includes("ファイル")) return "ファイル";
                                            if (fallbackCategory?.includes("プレパレーション")) return "プレパレーション";
                                            return undefined;
                                        };
                                        const bucketTotals: Record<BucketKey, { max: number; prev: number; cur: number }> = {
                                            "オフ／フィル": { max: 0, prev: 0, cur: 0 },
                                            "ファイル": { max: 0, prev: 0, cur: 0 },
                                            "プレパレーション": { max: 0, prev: 0, cur: 0 },
                                        };
                                        CARE_EVALUATION_MASTER.forEach((cat) => {
                                            cat.items.forEach((it) => {
                                                it.checkpoints.forEach((cp) => {
                                                    const pts = cp.points ?? 0;
                                                    const bucket = bucketForCode(cp.code, cat.name);
                                                    if (!bucket) return;
                                                    // Denominators: always sum 配点
                                                    bucketTotals[bucket].max += pts;
                                                    const prevScore = scoreFrom(prevBlob, cp.code, cp.label);
                                                    const curScore = scoreFrom(curBlob, cp.code, cp.label);
                                                    const prevClamped = Math.max(0, Math.min(pts, prevScore));
                                                    const curClamped = Math.max(0, Math.min(pts, curScore));
                                                    bucketTotals[bucket].prev += prevClamped;
                                                    bucketTotals[bucket].cur += curClamped;
                                                });
                                            });

                                        });
                                        const overall = {
                                            max: bucketTotals["オフ／フィル"].max + bucketTotals["ファイル"].max + bucketTotals["プレパレーション"].max,
                                            prev: bucketTotals["オフ／フィル"].prev + bucketTotals["ファイル"].prev + bucketTotals["プレパレーション"].prev,
                                            cur: bucketTotals["オフ／フィル"].cur + bucketTotals["ファイル"].cur + bucketTotals["プレパレーション"].cur,
                                        };
                                        const maxOverall = overall.max;
                                        const maxOffFill = bucketTotals["オフ／フィル"].max;
                                        const maxFile = bucketTotals["ファイル"].max;
                                        const maxPrep = bucketTotals["プレパレーション"].max;

                                        const averageMap = fallbackMap(careRadarAverageData, avgData as JsonMap | undefined) || {};
                                        const previousMap = fallbackMap(careRadarPreviousData, undefined) || {};
                                        const currentMap = fallbackMap(careRadarCurrentData, undefined) || {};

                                        const nationalBuckets: Record<BucketKey, number> = {
                                            "オフ／フィル": pickValue(averageMap, ["オフ／フィル", "オフ", "フィル"]) || bucketTotals["オフ／フィル"].prev,
                                            "ファイル": pickValue(averageMap, ["ファイル"]) || bucketTotals["ファイル"].prev,
                                            "プレパレーション": pickValue(averageMap, ["プレパレーション"]) || bucketTotals["プレパレーション"].prev,
                                        };

                                        const previousBuckets: Record<BucketKey, number> = {
                                            "オフ／フィル": bucketTotals["オフ／フィル"].prev || pickValue(previousMap, ["オフ／フィル", "オフ", "フィル"]),
                                            "ファイル": bucketTotals["ファイル"].prev || pickValue(previousMap, ["ファイル"]),
                                            "プレパレーション": bucketTotals["プレパレーション"].prev || pickValue(previousMap, ["プレパレーション"]),
                                        };
                                        const currentBuckets: Record<BucketKey, number> = {
                                            "オフ／フィル": bucketTotals["オフ／フィル"].cur || pickValue(currentMap, ["オフ／フィル", "オフ", "フィル"]),
                                            "ファイル": bucketTotals["ファイル"].cur || pickValue(currentMap, ["ファイル"]),
                                            "プレパレーション": bucketTotals["プレパレーション"].cur || pickValue(currentMap, ["プレパレーション"]),
                                        };
                                        // ケア総合は常に3軸の合計で算出する（総合キーには依存しない）
                                        const nationalOverall =
                                            (nationalBuckets["オフ／フィル"] ?? 0) +
                                            (nationalBuckets["ファイル"] ?? 0) +
                                            (nationalBuckets["プレパレーション"] ?? 0);
                                        const previousOverall =
                                            (previousBuckets["オフ／フィル"] ?? 0) +
                                            (previousBuckets["ファイル"] ?? 0) +
                                            (previousBuckets["プレパレーション"] ?? 0);
                                        const currentOverall =
                                            (currentBuckets["オフ／フィル"] ?? 0) +
                                            (currentBuckets["ファイル"] ?? 0) +
                                            (currentBuckets["プレパレーション"] ?? 0);

                                        const normalize = (value: number, max: number) => {
                                            if (!max) return 0;
                                            const ratio = (value / max) * 100;
                                            return Math.max(0, Math.min(100, ratio));
                                        };
                                        const radarRows = [
                                            {
                                                axis: "ケア総合",
                                                national: normalize(nationalOverall, maxOverall),
                                                previous: normalize(previousOverall, maxOverall),
                                                current: normalize(currentOverall, maxOverall),
                                                nationalRaw: nationalOverall,
                                                previousRaw: previousOverall,
                                                currentRaw: currentOverall,
                                                max: maxOverall,
                                            },
                                            {
                                                axis: "オフ／フィル",
                                                national: normalize(nationalBuckets["オフ／フィル"], maxOffFill),
                                                previous: normalize(previousBuckets["オフ／フィル"], maxOffFill),
                                                current: normalize(currentBuckets["オフ／フィル"], maxOffFill),
                                                nationalRaw: nationalBuckets["オフ／フィル"],
                                                previousRaw: previousBuckets["オフ／フィル"],
                                                currentRaw: currentBuckets["オフ／フィル"],
                                                max: maxOffFill,
                                            },
                                            {
                                                axis: "ファイル",
                                                national: normalize(nationalBuckets["ファイル"], maxFile),
                                                previous: normalize(previousBuckets["ファイル"], maxFile),
                                                current: normalize(currentBuckets["ファイル"], maxFile),
                                                nationalRaw: nationalBuckets["ファイル"],
                                                previousRaw: previousBuckets["ファイル"],
                                                currentRaw: currentBuckets["ファイル"],
                                                max: maxFile,
                                            },
                                            {
                                                axis: "プレパレーション",
                                                national: normalize(nationalBuckets["プレパレーション"], maxPrep),
                                                previous: normalize(previousBuckets["プレパレーション"], maxPrep),
                                                current: normalize(currentBuckets["プレパレーション"], maxPrep),
                                                nationalRaw: nationalBuckets["プレパレーション"],
                                                previousRaw: previousBuckets["プレパレーション"],
                                                currentRaw: currentBuckets["プレパレーション"],
                                                max: maxPrep,
                                            },
                                        ];

                                        const legendItems = [
                                            { label: "全国平均", color: "#64CBD3" },
                                            { label: "前回", color: "#4075B5" },
                                            { label: "今回", color: "#F15C4B" },
                                        ];
                                        const fmt1 = (n: number | undefined | null) =>
                                            typeof n === "number" ? n.toLocaleString(undefined, { maximumFractionDigits: 1 }) : "";
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
                                            const raw = payload?.currentRaw;
                                            if (raw === undefined || raw === null) return (
                                                <circle cx={cx} cy={cy} r={4} fill="#F15C4B" stroke="#ffffff" strokeWidth={1.5} />
                                            );
                                            const { x, y, anchor } = labelPositionForAxis(payload?.axis, cx, cy);
                                            return (
                                                <g>
                                                    <circle cx={cx} cy={cy} r={4.5} fill="#F15C4B" stroke="#ffffff" strokeWidth={1.8} />
                                                    <text x={x} y={y} textAnchor={anchor} fontSize={12} fontWeight={600} fill="#F15C4B">
                                                        {fmt1(raw)}
                                                    </text>
                                                </g>
                                            );
                                        };
                                        const renderPreviousDot = (props: any) => {
                                            const { cx, cy, payload } = props;
                                            if (typeof cx !== "number" || typeof cy !== "number") return null;
                                            const raw = payload?.previousRaw;
                                            if (raw === undefined || raw === null) return (
                                                <circle cx={cx} cy={cy} r={4} fill="#4075B5" stroke="#ffffff" strokeWidth={1.5} />
                                            );
                                            const { x, y, anchor } = labelPositionForAxis(payload?.axis, cx, cy);
                                            return (
                                                <g>
                                                    <circle cx={cx} cy={cy} r={4.5} fill="#4075B5" stroke="#ffffff" strokeWidth={1.8} />
                                                    <text x={x} y={y} textAnchor={anchor} fontSize={12} fontWeight={600} fill="#4075B5">
                                                        {fmt1(raw)}
                                                    </text>
                                                </g>
                                            );
                                        };
                                        const renderNationalDot = (props: any) => {
                                            const { cx, cy, payload } = props;
                                            if (typeof cx !== "number" || typeof cy !== "number") return null;
                                            const raw = payload?.nationalRaw;
                                            if (raw === undefined || raw === null) return (
                                                <circle cx={cx} cy={cy} r={4} fill="#64CBD3" stroke="#ffffff" strokeWidth={1.5} />
                                            );
                                            const { x, y, anchor } = labelPositionForAxis(payload?.axis, cx, cy);
                                            return (
                                                <g>
                                                    <circle cx={cx} cy={cy} r={4.5} fill="#64CBD3" stroke="#ffffff" strokeWidth={1.8} />
                                                    <text x={x} y={y} textAnchor={anchor} fontSize={12} fontWeight={600} fill="#2a8090">
                                                        {fmt1(raw)}
                                                    </text>
                                                </g>
                                            );
                                        };

                                        return (
                                            <>
                                                <div className="relative h-[550px] overflow-hidden rounded-2xl border border-[#e8e9f4] bg-white">
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
                                                            >
                                                                <PolarGrid
                                                                    gridType="polygon"
                                                                    radialLines={true}
                                                                    polarRadius={[45, 90, 135, 180, 225]}
                                                                    stroke="#e6e9f5"
                                                                />
                                                                <PolarAngleAxis dataKey="axis" tick={false} />
                                                                <PolarRadiusAxis domain={[0, 100]} tickCount={5} axisLine={false} tick={false} />
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
                                                            <div className="absolute left-1/2 -translate-x-1/2 text-center">
                                                                <div className="text-sm font-semibold text-[#2a8090]">ケア総合</div>
                                                                <div className="mt-1 text-[11px] text-slate-500">{maxOverall}</div>
                                                            </div>
                                                            <div className="absolute left-[73%] top-1/2 -translate-y-1/2 text-right">
                                                                <div className="mt-1 text-[11px] text-slate-500 absolute top-[21%] left-[-20px]" >{maxOffFill}</div>
                                                                <div className="text-sm font-semibold text-[#2a8090]" style={{ writingMode: "vertical-rl" }}>オフ／フィル</div>
                                                            </div>
                                                            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-center">
                                                                <div className="mt-1 text-[11px] text-slate-500" >{maxFile}</div>
                                                                <div className="text-sm font-semibold text-[#2a8090]">ファイル</div>
                                                            </div>
                                                            <div className="absolute left-1/4 top-1/2 -translate-y-1/2 text-left">
                                                                <div className="mt-1 text-[11px] text-slate-500 absolute left-6 top-1/3 text-left">
                                                                    {maxPrep}
                                                                </div>
                                                                <div className="text-sm font-semibold text-[#2a8090]" style={{ writingMode: "vertical-rl" }}>
                                                                    プレパレーション
                                                                </div>
                                                            </div>
                                                            {/* <div className="absolute left-1/2 -translate-x-1/2 text-[10px] text-gray-500 top-[12%]">328</div>
                                                            <div className="absolute left-1/2 -translate-x-1/2 text-[10px] text-gray-500 top-[21%]">246</div>
                                                            <div className="absolute left-1/2 -translate-x-1/2 text-[10px] text-gray-500 top-[30%]">164</div>
                                                            <div className="absolute left-1/2 -translate-x-1/2 text-[10px] text-gray-500 top-[39%]">82</div>
                                                            <div className="absolute left-1/2 -translate-x-1/2 text-[10px] text-gray-500 top-[57%]">32</div>
                                                            <div className="absolute left-1/2 -translate-x-1/2 text-[10px] text-gray-500 top-[66%]">64</div>
                                                            <div className="absolute left-1/2 -translate-x-1/2 text-[10px] text-gray-500 top-[75%]">96</div>
                                                            <div className="absolute left-1/2 -translate-x-1/2 text-[10px] text-gray-500 top-[84%]">128</div> */}

                                                            {/* Left (time) marks along center line */}
                                                            {/* <div className="absolute top-[48.5%] -translate-y-1/2 text-[10px] text-gray-500 left-[32%]">168</div>
                                                            <div className="absolute top-[48.5%] -translate-y-1/2 text-[10px] text-gray-500 left-[36%]">126</div>
                                                            <div className="absolute top-[48.5%] -translate-y-1/2 text-[10px] text-gray-500 left-[40%]">84</div>
                                                            <div className="absolute top-[48.5%] -translate-y-1/2 text-[10px] text-gray-500 left-[45%]">42</div> */}

                                                            {/* <div className="absolute top-[48.5%] -translate-y-1/2 text-[10px] text-gray-500 left-[54%]">8</div>
                                                            <div className="absolute top-[48.5%] -translate-y-1/2 text-[10px] text-gray-500 left-[58%]">16</div>
                                                            <div className="absolute top-[48.5%] -translate-y-1/2 text-[10px] text-gray-500 left-[62%]">24</div>
                                                            <div className="absolute top-[48.5%] -translate-y-1/2 text-[10px] text-gray-500 left-[66%]">32</div> */}
                                                        </div>
                                                    </div>
                                                </div>

                                            </>
                                        );
                                    })()}
                                </Card>
                                <div id="pdf-care-rank-standard">
                                    <EvaluationRankStandardTable />
                                </div>
                            </TabsContent>


                            <TabsContent value="onecolor">
                                <Card id="pdf-onecolor-summary">
                                    {(() => {
                                        const denom = 610;
                                        const avgScore = (prevOneColorTotal || prevOneColorTotalFromBlob || 0) as number;
                                        const avgRank = (prevRatings.one_color as string) || rankFromScore(avgScore, denom);
                                        const prevOnlyScore = (prevOneColorTotal || prevOneColorTotalFromBlob || 0) as number;
                                        const prevOnlyRank = (prevRatings.one_color as string) || rankFromScore(prevOnlyScore, denom);
                                        const curScore = (num(assessment?.one_color_score) ?? num(scoreCurrent?.["ワンカラー スコア"]) ?? num(scoreCurrent?.["ワンカラー"]) ?? 0) as number;
                                        const curRank = (assessment?.one_color_rating as string) || rankFromScore(curScore, denom);

                                        return (
                                            <table className="w-full border-collapse text-sm text-slate-700">
                                                <thead>
                                                    <tr>
                                                        <th rowSpan={2} className="w-32 bg-[#e5e5e5] border border-[#dddddd] px-3 py-3 text-left font-semibold">カテゴリー</th>
                                                        <th colSpan={2} className="bg-[#4fb1bc] border border-[#dddddd] px-3 py-3 text-center text-white font-semibold"> 全国平均</th>
                                                        <th colSpan={2} className="bg-[#3d7fb6] border border-[#dddddd] px-3 py-3 text-center text-white font-semibold">前回</th>
                                                        <th colSpan={2} className="bg-[#fb9793] border border-[#dddddd] px-3 py-3 text-center text-white font-semibold">今回</th>
                                                    </tr>
                                                    <tr>
                                                        <th className="bg-[#6ebec7] border border-[#dddddd] px-3 py-2 text-center text-white text-xs">評価ランク</th>
                                                        <th className="bg-[#6ebec7] border border-[#dddddd] px-3 py-2 text-center text-white text-xs">スコア</th>
                                                        <th className="bg-[#6ea3c7] border border-[#dddddd] px-3 py-2 text-center text-white text-xs">評価ランク</th>
                                                        <th className="bg-[#6ea3c7] border border-[#dddddd] px-3 py-2 text-center text-white text-xs">スコア</th>
                                                        <th className="bg-[#ffb3ae] border border-[#dddddd] px-3 py-2 text-center text-white text-xs">評価ランク</th>
                                                        <th className="bg-[#ffb3ae] border border-[#dddddd] px-3 py-2 text-center text-white text-xs">スコア</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr className="align-middle">
                                                        <td className="bg-[#4fb1bc] text-white border border-[#dddddd] px-3 py-3 font-medium whitespace-nowrap">
                                                            ワンカラー
                                                        </td>
                                                        {/* 全国平均 */}
                                                        <td className="border border-[#dddddd] px-3 py-3 text-center bg-white">
                                                            <span className="font-semibold text-[#138495]">{avgRank}</span>
                                                        </td>
                                                        <td className="border border-[#dddddd] px-3 py-3 text-center bg-white">
                                                            <span className="font-semibold text-[#138495]">{avgScore}</span>{" "}
                                                            <span className="text-slate-400">/ {denom}</span>
                                                        </td>
                                                        {/* 前回 */}
                                                        <td className="border border-[#dddddd] px-3 py-3 text-center bg-[#eef3f8]">
                                                            <span className="font-semibold text-[#3d7fb6]">{prevOnlyRank}</span>
                                                        </td>
                                                        <td className="border border-[#dddddd] px-3 py-3 text-center bg-[#eef3f8]">
                                                            <span className="font-semibold text-[#3d7fb6]">{prevOnlyScore}</span>{" "}
                                                            <span className="text-slate-400">/ {denom}</span>
                                                        </td>
                                                        {/* 今回 */}
                                                        <td className="border border-[#dddddd] px-3 py-3 text-center bg-[#fff7f7]">
                                                            <span className="font-semibold text-[#e94444]">{curRank}</span>
                                                        </td>
                                                        <td className="border border-[#dddddd] px-3 py-3 text-center bg-[#fff7f7]">
                                                            <span className="font-semibold text-[#e94444]">{curScore}</span>{" "}
                                                            <span className="text-slate-400">/ {denom}</span>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        );
                                    })()}
                                </Card>
                                <Card id="pdf-onecolor-detail" className="mt-4">
                                    {(() => {
                                        const MASTER = ONE_COLOR_MASTER;
                                        const ONE_COLOR_AVG_FALLBACK_SEQ: number[] = [
                                            1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 14-1〜18-2 まで
                                            2,                             // 19-1
                                            1, 1, 3,                       // 19-2〜19-4
                                            1, 1, 3,                       // 19-5〜20-1
                                            1, 1, 1, 3,                    // 20-2〜21-2
                                            1, 1, 1, 1, 1, 1, 1, 1, 1,     // 22-1〜24-2〜25-1 近辺
                                            1, 1, 1, 1, 1, 1, 1, 1         // 残り 26-1〜28-2 付近（全てフラット）
                                        ];

                                        const ensureMapOC = (m: any): Record<string, any> => {
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
                                        const currentBlob = ensureMapOC(oneColorScoreCurrentData);
                                        const previousBlob = ensureMapOC(oneColorScorePreviousData);
                                        const avgComp = ensureMapOC(oneColorComparisonAverageData);
                                        const prevComp = ensureMapOC(oneColorComparisonPreviousData);
                                        const evalCurrentMap = ensureMapOC(oneColorEvaluationGraph);
                                        const evalPreviousMap = ensureMapOC(oneColorEvaluationGraphPrevious);

                                        const normalizeKey = (s: string) =>
                                            (typeof s === "string" ? s : String(s))
                                                .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xFEE0))
                                                .replace(/[‐‑–—−ーｰ－]/g, "-")
                                                .replace(/[［］【】\[\]\(\)\s\u3000]/g, "");

                                        const toNumber = (v: any) => {
                                            const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
                                            return Number.isFinite(n) ? n : 0;
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
                                        const getComp = (map: Record<string, any> | undefined, code: string, label: string) => {

                                            if (!map) return undefined;
                                            const nCode = normalizeKey(code || "");
                                            const nLabel = normalizeKey(label || "");
                                            const keyHit = Object.entries(map).find(([k]) => {
                                                const nk = normalizeKey(k);
                                                return (nCode && nk.includes(nCode)) || (nLabel && nk.includes(nLabel));
                                            });
                                            if (!keyHit) return undefined;
                                            const val = keyHit[1];
                                            const n = typeof val === "number" ? val : Number(String(val).replace(/[^\d.-]/g, ""));
                                            if (Number.isFinite(n) && n !== 0) return n;
                                            if (typeof val === "string") {
                                                if (/[↗↑]/.test(val)) return 1;
                                                if (/[→➡]/.test(val)) return 2;
                                                if (/[↘↓]/.test(val)) return 3;
                                            }
                                            return undefined;
                                        };
                                        const compToArrow = (n?: number) => {
                                            const dir = n === 1 ? "up" : n === 2 ? "right" : n === 3 ? "down" : null;
                                            if (!dir) return <span>—</span>;
                                            const color = dir === "up" ? "#1a73e8" : dir === "down" ? "#f44336" : "#2ea44f";
                                            const rotation = dir === "right" ? 90 : dir === "down" ? 180 : 0;
                                            return (
                                                <svg
                                                    width="30"
                                                    height="20"
                                                    viewBox="0 0 24 24"
                                                    style={{ transform: `rotate(${rotation}deg)` }}
                                                    aria-hidden="true"
                                                    focusable="false"
                                                >
                                                    <path d="M10 18v-6H7l5-6 5 6h-3v6h-2z" fill={color} />
                                                </svg>
                                            );

                                        };
                                        const getEvaluationRank = (map: Record<string, any> | undefined, code: string, label: string): number | null => {
                                            return extractRankValue(map, code, label);
                                        };
                                        const renderEvaluationGraph = (prevRank: number | null, currRank: number | null) => {
                                            if (!prevRank && !currRank) {
                                                return (
                                                    <div className="flex h-4 items-center justify-center rounded bg-[#fce2de] text-[10px] font-medium text-[#a8b0bb]">
                                                    </div>
                                                );
                                            }
                                            const rankToWidth = (rank: number) => `${Math.max(0, Math.min(4, rank)) * 25}%`;
                                            return (
                                                <div className="relative h-7 rounded bg-[#f8fbfd]">
                                                    <div className="absolute inset-0 grid grid-cols-4">
                                                        <div className="border-r border-dashed border-[#d8e4ec]" />
                                                        <div className="border-r border-dashed border-[#d8e4ec]" />
                                                        <div className="border-r border-dashed border-[#d8e4ec]" />
                                                        <div />
                                                    </div>
                                                    <div className="absolute inset-x-[6px] inset-y-0">
                                                        {prevRank && (
                                                            <div
                                                                className="absolute left-0 top-[28%] h-[4px] rounded-full bg-[#3D80B8]"
                                                                style={{ width: rankToWidth(prevRank) }}
                                                            >
                                                            </div>
                                                        )}
                                                        {currRank && (
                                                            <div
                                                                className="absolute left-0 bottom-[28%] h-[4px] rounded-full bg-[#F24822]"
                                                                style={{ width: rankToWidth(currRank) }}>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        };

                                        return (
                                            <table className="w-full border-collapse text-sm text-slate-700">
                                                <thead>
                                                    <tr>
                                                        <th rowSpan={2} className="w-24 bg-[#6ebec7] text-white border border-[#d4d4d4] px-3 py-2 text-center">カテゴリー</th>
                                                        <th rowSpan={2} className="w-44 bg-[#6ebec7] text-white border border-[#d4d4d4] px-3 py-2 text-center">評価項目</th>
                                                        <th rowSpan={2} className="w-10 bg-[#6ebec7] text-white border border-[#d4d4d4] px-3 py-2 text-center">必須</th>
                                                        <th colSpan={2} className="bg-[#6ebec7] text-white border border-[#d4d4d4] px-3 py-2 text-center">チェックポイント</th>
                                                        <th rowSpan={2} className="w-12 bg-[#6ebec7] text-white border border-[#d4d4d4] px-3 py-2 text-center">配点</th>
                                                        <th colSpan={2} className="bg-[#6ebec7] text-white border border-[#d4d4d4] px-3 py-2 text-center">平均</th>
                                                        <th colSpan={2} className="bg-[#6ea3c7] text-white border border-[#d4d4d4] px-3 py-2 text-center">前回</th>
                                                        <th colSpan={1} className="bg-[#fb9793] text-white border border-[#d4d4d4] px-3 py-2 text-center">今回</th>
                                                        <th colSpan={4} className="bg-[#6ebec7] text-white border border-[#d4d4d4] px-3 py-2 text-center">評価グラフ</th>
                                                    </tr>
                                                    <tr>
                                                        <th className="bg-[#6ebec7] text-white border border-[#d4d4d4] px-2 py-1 text-center text-xs">番号</th>
                                                        <th className="bg-[#6ebec7] text-white border border-[#d4d4d4] px-2 py-1 text-center text-xs">内容</th>
                                                        <th className="bg-[#8eced4] text-white border border-[#d4d4d4] px-2 py-1 text-center text-xs">比較</th>
                                                        <th className="bg-[#8eced4] text-white border border-[#d4d4d4] px-2 py-1 text-center text-xs">スコア</th>
                                                        <th className="bg-[#a9c4da] text-white border border-[#d4d4d4] px-2 py-1 text-center text-xs">比較</th>
                                                        <th className="bg-[#a9c4da] text-white border border-[#d4d4d4] px-2 py-1 text-center text-xs">スコア</th>
                                                        <th className="bg-[#ffb3ae] text-white border border-[#d4d4d4] px-2 py-1 text-center text-xs">スコア</th>
                                                        <th className="bg-[#FFE78E] text-[#4FB1BC] border border-[#d4d4d4] px-2 py-1 text-center text-xs">B</th>
                                                        <th className="bg-[#6ebec7] text-white border border-[#d4d4d4] px-2 py-1 text-center text-xs">A</th>
                                                        <th className="bg-[#6ebec7] text-white border border-[#d4d4d4] px-2 py-1 text-center text-xs">AA</th>
                                                        <th className="bg-[#6ebec7] text-white border border-[#d4d4d4] px-2 py-1 text-center text-xs">AAA</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(() => {
                                                        const buildSeqPuller = (map: Record<string, any> | undefined) => {
                                                            const toCompNum = (v: any) => {
                                                                if (typeof v === "number") return v;
                                                                const s = String(v ?? "");
                                                                if (/[↗↑]/.test(s)) return 1;
                                                                if (/[→➡]/.test(s)) return 2;
                                                                if (/[↘↓]/.test(s)) return 3;
                                                                const n = Number(s.replace(/[^\d.-]/g, ""));
                                                                return Number.isFinite(n) ? n : undefined;
                                                            };
                                                            const nums = Object.values(map || {}).map(toCompNum).filter((v) => v !== undefined) as number[];
                                                            let idx = 0;
                                                            return () => (idx < nums.length ? nums[idx++] : undefined);
                                                        };
                                                        const nextAvg = buildSeqPuller(avgComp);
                                                        const nextPrev = buildSeqPuller(prevComp);
                                                        let fallbackIdx = 0;

                                                        return MASTER.flatMap((cat) => {
                                                            const catRowSpan = cat.items.reduce((s, it) => s + it.checkpoints.length, 0);
                                                            let catRendered = false;
                                                            return cat.items.flatMap((it) => {
                                                                const itemRowSpan = it.checkpoints.length;
                                                                return it.checkpoints.map((cp, idx) => {
                                                                    const points = cp.points;
                                                                    const fallbackVal = ONE_COLOR_AVG_FALLBACK_SEQ[fallbackIdx++] ?? 2;
                                                                    const avgComparison = getComp(avgComp, cp.code, cp.label)
                                                                        ?? nextAvg()
                                                                        ?? fallbackVal;
                                                                    const prevComparison = getComp(prevComp, cp.code, cp.label) ?? nextPrev();
                                                                    const prevScore = getScore(previousBlob, cp.code, cp.label);
                                                                    const curScore = getScore(currentBlob, cp.code, cp.label);
                                                                    const prevRank = getEvaluationRank(evalPreviousMap, cp.code, cp.label);
                                                                    const currRank = getEvaluationRank(evalCurrentMap, cp.code, cp.label);
                                                                    const rankValues = [prevRank, currRank].filter(
                                                                        (rank): rank is number => typeof rank === "number"
                                                                    );
                                                                    const isRankB =
                                                                        rankValues.length > 0 && rankValues.every((rank) => rank === 1);
                                                                    const yellowBgClass = isRankB ? "bg-[#FFE78E]" : "";

                                                                    return (
                                                                        <tr key={`${cat.name}-${it.id}-${cp.code}`}>
                                                                            {!catRendered && (
                                                                                <td className="border border-[#d4d4d4] bg-[#eef7f8] text-slate-700 px-3 py-2 text-center align-top" rowSpan={catRowSpan}>
                                                                                    {cat.name}
                                                                                </td>
                                                                            )}
                                                                            {!idx && (
                                                                                <td className="border border-[#d4d4d4] px-3 py-2 align-top" rowSpan={itemRowSpan}>
                                                                                    {`${it.id}. ${it.title}`}
                                                                                </td>
                                                                            )}
                                                                            {!idx && (
                                                                                <td
                                                                                    className="border border-[#d4d4d4] px-3 py-2 text-center align-top"
                                                                                    rowSpan={itemRowSpan}
                                                                                >
                                                                                    {it.required ? "★" : ""}
                                                                                </td>
                                                                            )}
                                                                            <td className={`border border-[#d4d4d4] px-2 py-2 text-center ${yellowBgClass}`}>{cp.code}</td>
                                                                            <td className={`border border-[#d4d4d4] px-3 py-2 ${cp.highlight ? "bg-[#ffefc2]" : yellowBgClass}`}>{cp.label}</td>
                                                                            <td className={`border border-[#d4d4d4] px-2 py-2 text-center font-semibold ${cp.highlight ? "bg-[#ffefc2]" : yellowBgClass}`}>{points}</td>
                                                                            {/* 平均：比較は JO〜LA、スコアは空欄 */}
                                                                            <td className={`border border-[#d4d4d4] px-2 py-2 text-center ${yellowBgClass}`}>{compToArrow(avgComparison)}</td>
                                                                            <td className={`border border-[#d4d4d4] px-2 py-2 text-center text-slate-400 ${yellowBgClass}`}> </td>
                                                                            {/* 前回：比較 OB〜PN、スコア LC〜MN */}
                                                                            <td className={`border border-[#d4d4d4] px-2 py-2 text-center ${yellowBgClass}`}>{compToArrow(prevComparison)}</td>
                                                                            <td className={`border border-[#d4d4d4] px-2 py-2 text-center ${yellowBgClass}`}>{prevScore || 0}</td>
                                                                            {/* 今回：スコア GO〜IA */}
                                                                            <td className={`border border-[#d4d4d4] px-2 py-2 text-center text-[#e94444] font-semibold ${yellowBgClass}`}>{curScore || 0}</td>
                                                                            <td colSpan={4} className="border border-[#d4d4d4] px-1 py-1 align-middle">
                                                                                {renderEvaluationGraph(prevRank, currRank)}
                                                                            </td>
                                                                            {(catRendered = true) && null}
                                                                        </tr>
                                                                    );
                                                                });
                                                            });
                                                        });
                                                    })()}
                                                </tbody>
                                            </table>
                                        );
                                    })()}
                                </Card>
                                <Card className="mt-4">
                                    {(() => {

                                        type BucketTotals = { max: number; prev: number; cur: number };
                                        const ensureMap = (m: any): Record<string, any> => {
                                            if (!m) return {};
                                            if (typeof m === "string") {
                                                try { const p = JSON.parse(m); return p && typeof p === "object" ? p : {}; } catch { return {}; }
                                            }
                                            return typeof m === "object" ? (m as Record<string, any>) : {};
                                        };
                                        const normalizeKey = (s: string) =>
                                            (typeof s === "string" ? s : String(s))
                                                .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xFEE0))
                                                .replace(/[‐‑–—−ーｰ－]/g, "-")
                                                .replace(/[［］【】\[\]\(\)\s\u3000]/g, "");
                                        const toNumber = (v: any) => {
                                            const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
                                            return Number.isFinite(n) ? n : 0;
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
                                        const currentMap = ensureMap(oneColorScoreCurrentData);
                                        const previousMap = ensureMap(oneColorScorePreviousData);
                                        const avgMap = ensureMap(avgData); // national average if provided
                                        const buckets: Record<AxisKeyOC, BucketTotals> = {
                                            "ベース": { max: 0, prev: 0, cur: 0 },
                                            "カラー": { max: 0, prev: 0, cur: 0 },
                                            "トップ": { max: 0, prev: 0, cur: 0 },
                                        };
                                        const OC_MASTER = ONE_COLOR_MASTER;
                                        (OC_MASTER || []).forEach((cat: any) => {
                                            const axis: AxisKeyOC = (cat?.name as AxisKeyOC) || "ベース";
                                            if (!buckets[axis]) return;
                                            (cat.items || []).forEach((it: any) => {
                                                (it.checkpoints || []).forEach((cp: any) => {
                                                    const pts = cp.points ?? 0;
                                                    buckets[axis].max += pts;
                                                    const prev = getScore(previousMap, cp.code, cp.label);
                                                    const cur = getScore(currentMap, cp.code, cp.label);
                                                    buckets[axis].prev += Math.max(0, Math.min(pts, prev));
                                                    buckets[axis].cur += Math.max(0, Math.min(pts, cur));
                                                });
                                            });
                                        });
                                        // Axis-specific caps
                                        const maxBase = buckets["ベース"].max;
                                        const maxColor = buckets["カラー"].max;
                                        const maxTop = buckets["トップ"].max;
                                        const maxOverall = maxBase + maxColor + maxTop; // 610 expected
                                        // Build national totals: prefer avgMap axis values; fallback to previous axis totals
                                        const pick = (map: Record<string, any>, keys: string[]) => {
                                            for (const [k, v] of Object.entries(map || {})) {
                                                if (keys.some((s) => String(k).includes(s))) return toNumber(v);
                                            }
                                            return 0;
                                        };
                                        const nationalBuckets = {
                                            "ベース": pick(avgMap, ["ベース", "base"]) || buckets["ベース"].prev,
                                            "カラー": pick(avgMap, ["カラー", "color"]) || buckets["カラー"].prev,
                                            "トップ": pick(avgMap, ["トップ", "top"]) || buckets["トップ"].prev,
                                        } as Record<AxisKeyOC, number>;
                                        const nationalOverall = nationalBuckets["ベース"] + nationalBuckets["カラー"] + nationalBuckets["トップ"];
                                        const previousOverall = buckets["ベース"].prev + buckets["カラー"].prev + buckets["トップ"].prev;
                                        const currentOverall = buckets["ベース"].cur + buckets["カラー"].cur + buckets["トップ"].cur;
                                        const normalize = (v: number, max: number) => (max ? Math.max(0, Math.min(100, (v / max) * 100)) : 0);
                                        const rows = [
                                            { axis: "ワンカラー総合", national: normalize(nationalOverall, maxOverall), previous: normalize(previousOverall, maxOverall), current: normalize(currentOverall, maxOverall), nationalRaw: nationalOverall, previousRaw: previousOverall, currentRaw: currentOverall, max: maxOverall },
                                            { axis: "ベース", national: normalize(nationalBuckets["ベース"], maxBase), previous: normalize(buckets["ベース"].prev, maxBase), current: normalize(buckets["ベース"].cur, maxBase), nationalRaw: nationalBuckets["ベース"], previousRaw: buckets["ベース"].prev, currentRaw: buckets["ベース"].cur, max: maxBase },
                                            { axis: "カラー", national: normalize(nationalBuckets["カラー"], maxColor), previous: normalize(buckets["カラー"].prev, maxColor), current: normalize(buckets["カラー"].cur, maxColor), nationalRaw: nationalBuckets["カラー"], previousRaw: buckets["カラー"].prev, currentRaw: buckets["カラー"].cur, max: maxColor },
                                            { axis: "トップ", national: normalize(nationalBuckets["トップ"], maxTop), previous: normalize(buckets["トップ"].prev, maxTop), current: normalize(buckets["トップ"].cur, maxTop), nationalRaw: nationalBuckets["トップ"], previousRaw: buckets["トップ"].prev, currentRaw: buckets["トップ"].cur, max: maxTop },
                                        ];
                                        const legendItems = [
                                            { label: "全国平均", color: "#64CBD3" },
                                            { label: "前回", color: "#4075B5" },
                                            { label: "今回", color: "#F15C4B" },
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
                                                        <text x={x} y={y} textAnchor={anchor} fontSize={12} fontWeight={600} fill={color === "#64CBD3" ? "#2a8090" : color}>
                                                            {fmt1(raw)}
                                                        </text>
                                                    </g>
                                                );
                                            };
                                        const NationalDot = Dot("#64CBD3", "nationalRaw");
                                        const PreviousDot = Dot("#4075B5", "previousRaw");
                                        const CurrentDot = Dot("#F15C4B", "currentRaw");
                                        return (
                                            <div className="relative h-[600px] overflow-hidden rounded-2xl border border-[#e8e9f4] bg-white">
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
                                                        <div className="absolute top-[-3%] left-1/2 -translate-x-1/2 text-center">
                                                            <div className="text-sm font-semibold text-[#2a8090]">ワンカラー総合</div>
                                                            {/* <div className="text-sm font-semibold text-[#2a8090]">610</div> */}
                                                        </div>
                                                        <div className="absolute left-[72%] top-[43%] -translate-y-1/2 text-right">
                                                            <div className="text-sm font-semibold text-[#2a8090]" style={{ writingMode: "vertical-rl" }}>ベース</div>
                                                        </div>
                                                        <div className="absolute bottom-[6%] left-1/2 -translate-x-1/2 text-center">
                                                            {/* <div className="text-sm font-semibold text-[#2a8090]">210</div> */}
                                                            <div className="text-sm font-semibold text-[#2a8090]">カラー</div>
                                                        </div>
                                                        <div className="absolute left-[26%] top-[43%] -translate-y-1/2 text-left">
                                                            {/* <div className="text-sm left-[2%]font-semibold text-[#2a8090]">140</div> */}
                                                            <div className="text-sm font-semibold text-[#2a8090]" style={{ writingMode: "vertical-rl" }}>トップ</div>
                                                        </div>
                                                        {/* <div className="absolute left-1/2 -translate-x-1/2 text-[10px] text-gray-500 top-[4%]">610</div>
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
                                                        <div className="absolute top-[48.5%] -translate-y-1/2 text-[10px] text-gray-500 left-[70%]">260</div> */}
                                                    </div>
                                                </div>
                                            </div>
                                        );

                                    })()}
                                </Card>
                                <div id="pdf-onecolor-rank-standard">
                                    <EvaluationRankStandardTable />
                                </div>
                            </TabsContent>

                            <TabsContent value="time">

                                <Card id="pdf-time-card">
                                    {(() => {
                                        const denom = 300;
                                        const avgScore = (prevTimeTotal || prevTimeTotalFromBlob || 0) as number;
                                        const avgRank = (prevRatings.time as string) || rankFromScore(avgScore, denom);
                                        const prevOnlyScore = (prevTimeTotal || prevTimeTotalFromBlob || 0) as number;
                                        const prevOnlyRank = (prevRatings.time as string) || rankFromScore(prevOnlyScore, denom);
                                        const curScore = (num(assessment?.time_score) ?? num(scoreCurrent?.["タイム スコア"]) ?? num(scoreCurrent?.["タイム"]) ?? 0) as number;
                                        const curRank = (assessment?.time_rating as string) || rankFromScore(curScore, denom);

                                        return (
                                            <>
                                                <table className="w-full border-collapse text-sm text-slate-700">
                                                    <thead>
                                                        <tr>
                                                            <th rowSpan={2} className="w-32 bg-[#e5e5e5] border border-[#dddddd] px-3 py-3 text-left font-semibold">
                                                                カテゴリー
                                                            </th>
                                                            <th colSpan={2} className="bg-[#4fb1bc] border border-[#dddddd] px-3 py-3 text-center text-white font-semibold">
                                                                全国平均
                                                            </th>
                                                            <th colSpan={2} className="bg-[#3d7fb6] border border-[#dddddd] px-3 py-3 text-center text-white font-semibold">
                                                                前回
                                                            </th>
                                                            <th colSpan={2} className="bg-[#fb9793] border border-[#dddddd] px-3 py-3 text-center text-white font-semibold">
                                                                今回
                                                            </th>
                                                        </tr>
                                                        <tr>
                                                            <th className="bg-[#6ebec7] border border-[#dddddd] px-3 py-2 text-center text-white text-xs">評価ランク</th>
                                                            <th className="bg-[#6ebec7] border border-[#dddddd] px-3 py-2 text-center text-white text-xs">スコア</th>
                                                            <th className="bg-[#6ea3c7] border border-[#dddddd] px-3 py-2 text-center text-white text-xs">評価ランク</th>
                                                            <th className="bg-[#6ea3c7] border border-[#dddddd] px-3 py-2 text-center text-white text-xs">スコア</th>
                                                            <th className="bg-[#ffb3ae] border border-[#dddddd] px-3 py-2 text-center text-white text-xs">評価ランク</th>
                                                            <th className="bg-[#ffb3ae] border border-[#dddddd] px-3 py-2 text-center text-white text-xs">スコア</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        <tr className="align-middle">
                                                            <td className="bg-[#4fb1bc] text-white border border-[#dddddd] px-3 py-3 font-medium whitespace-nowrap">
                                                                タイム
                                                            </td>
                                                            {/* 全国平均 */}
                                                            <td className="border border-[#dddddd] px-3 py-3 text-center bg-white">
                                                                <span className="font-semibold text-[#138495]">{avgRank}</span>
                                                            </td>
                                                            <td className="border border-[#dddddd] px-3 py-3 text-center bg-white">
                                                                <span className="font-semibold text-[#138495]">{avgScore}</span>{" "}
                                                                <span className="text-slate-400">/ {denom}</span>
                                                                <div className="mt-2 pt-2 border-t border-[#dddddd] text-[#138495] font-bold">
                                                                    {prevTimeDisplay}
                                                                </div>
                                                            </td>

                                                            <td className="border border-[#dddddd] px-3 py-3 text-center bg-[#eef3f8]">
                                                                <span className="font-semibold text-[#3d7fb6]">{prevOnlyRank}</span>
                                                            </td>
                                                            <td className="border border-[#dddddd] px-3 py-3 text-center bg-[#eef3f8]">
                                                                <span className="font-semibold text-[#138495]">{avgScore}</span>{" "}
                                                                <span className="text-slate-400">/ {denom}</span>
                                                                <div className="mt-2 pt-2 border-t border-[#dddddd] text-[#138495] font-bold">
                                                                    {prevTimeDisplay}
                                                                </div>

                                                                {/* <span className="font-semibold text-[#3d7fb6]">{prevOnlyScore}</span>{" "}
                                                                <span className="text-slate-400">/ {denom}</span> */}
                                                            </td>
                                                            <td className="border border-[#dddddd] px-3 py-3 text-center bg-[#fff7f7]">
                                                                <span className="font-semibold text-[#e94444]">{curRank}</span>
                                                            </td>
                                                            <td className="border border-[#dddddd] px-3 py-3 text-center bg-[#fff7f7]">
                                                                <span className="font-semibold text-[#e94444]">{curScore}</span>{" "}
                                                                <span className="text-slate-400">/ {denom}</span>
                                                                <div className="mt-2 pt-2 border-t border-[#f3cfcf] text-[#e94444] font-bold">
                                                                    {currTimeDisplay}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table><br /><br />
                                                <TimeDetailCategoryTable
                                                    averageData={avgData}
                                                    averageComparison={timeComparisonAverage}
                                                    previousData={timeBothHandPreviousData}
                                                    previousComparison={timeComparison}
                                                    currentData={timeBothHandCurrentData}
                                                    evaluationCurrent={timeEvaluationGraph}
                                                    evaluationPrevious={timeEvaluationGraphPreviousData}
                                                />
                                            </>
                                        );


                                    })()}
                                </Card>
                                <Card id="pdf-time-radar-card" className="mt-4">
                                    <TimeRadar
                                        avgData={avgData as Record<string, any> | undefined}
                                        nationalFallback={timePreviousScore}
                                        previousTotal={timePreviousScore}
                                        currentTotal={timeCurrentScore}
                                        averageDetailData={timeComparisonAverage as Record<string, any> | undefined}
                                        previousDetailData={timeBothHandPreviousData as Record<string, any> | undefined}
                                        currentDetailData={timeBothHandCurrentData as Record<string, any> | undefined}
                                    />
                                    <EvaluationRankStandardTable />
                                    <ReferenceTimeTable />
                                </Card>
                            </TabsContent>

                        </Tabs>
                    </div>
                    <div className="my-8 text-center text-[11px] text-slate-400">© Nail Skill Agency</div>
                </div>
            </main >
        </div >
    );
}
