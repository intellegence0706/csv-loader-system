import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Sidebar from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Upload, ArrowLeft, FileUp, CheckCircle2, Loader2 } from "lucide-react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import Papa from "papaparse";
import { motion } from "framer-motion";

type RangeBlock = { type: string; data: Record<string, string> };

const ImportCSV: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<{ key: string; value: string }[]>([]);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [completed, setCompleted] = useState(false);
    const navigate = useNavigate();
    const { toast } = useToast();

    const normalize = (s: string) =>
        (s || "")
            .replace(/\r/g, "")
            .replace(/^"+|"+$/g, "")
            .replace(/\s+/g, " ")
            .trim();

    const toHalfWidthDigits = (s: string) =>
        String(s ?? "").replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0));

    const excelToIndex = (letters: string): number => {
        let num = 0;
        for (let i = 0; i < letters.length; i++) {
            num = num * 26 + (letters.charCodeAt(i) - 64);
        }
        return num - 1; // 0-based
    };

    const toInt = (v: any) => {
        const normalized = toHalfWidthDigits(String(v ?? ""));
        const n = parseInt(normalized.replace(/[^\d-]/g, ""), 10);
        return Number.isFinite(n) ? n : 0;
    };

    const toISODate = (s?: string | null) => {
        if (!s) return null;
        const raw = String(s).trim();
        const normalized = raw
            .replace(/年|\.|月/g, "/")
            .replace(/日/g, "")
            .replace(/-/g, "/")
            .replace(/\s+/g, " ")
            .trim();

        const yFirst = normalized.match(/(\d{4})[\/](\d{1,2})[\/](\d{1,2})/);
        if (yFirst) {
            const [, y, m, d] = yFirst;
            const iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
            console.log(`📅 Date parsed (Y-first): "${raw}" -> "${iso}"`);
            return iso;
        }

        const mdy = normalized.match(/(\d{1,2})[\/](\d{1,2})[\/](\d{4})/);
        if (mdy) {
            const [, m, d, y] = mdy;
            const iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
            console.log(`📅 Date parsed (M-first): "${raw}" -> "${iso}"`);
            return iso;
        }

        const digitsOnly = normalized.replace(/\D/g, "");
        if (digitsOnly.length === 8) {
            const y = digitsOnly.slice(0, 4);
            const m = digitsOnly.slice(4, 6);
            const d = digitsOnly.slice(6, 8);
            const iso = `${y}-${m}-${d}`;
            console.log(`📅 Date parsed (digits): "${raw}" -> "${iso}"`);
            return iso;
        }

        console.warn(`⚠️ Date parse failed: "${raw}"`);
        return null;
    };
    // Guarantee NOT NULL assessment_date by defaulting to today when parsing fails
    const todayISO = () => new Date().toISOString().slice(0, 10);
    const ensureISODate = (s?: string | null) => toISODate(s) ?? todayISO();

    // Normalize time strings like "66分 20秒" or "７３分５０秒" -> support full-width digits and spaces
    const normalizeTime = (t?: string) => toHalfWidthDigits(String(t ?? "")).replace(/[\s\u3000]+/g, "");
    const extractMinutes = (t?: string) => {
        const s = normalizeTime(t);
        const m = s.match(/(\d+)分/);
        return m?.[1] ?? "0";
    };
    const extractSeconds = (t?: string) => {
        const s = normalizeTime(t);
        const m = s.match(/(\d+)秒/);
        return m?.[1] ?? "0";
    };
    // Derive minutes/seconds from arbitrary key-value maps that may have separate fields for 分/秒
    const digitsOnly = (v: any) => {
        const s = String(v ?? "");
        const m = s.match(/(\d+)/);
        return m ? parseInt(m[1], 10) : 0;
    };

    const normalizeTrendValue = (value: any): 1 | 2 | 3 | null => {
        if (value === null || value === undefined) return null;
        const normalized = toHalfWidthDigits(String(value).trim());
        if (!normalized || normalized === "0") return null;

        if (/^(?:1|↑|↗|⇑|▲)$/u.test(normalized)) return 1;
        if (/^(?:2|→|➡|⇨|⇒)$/u.test(normalized)) return 2;
        if (/^(?:3|↓|↘|⇓|▼)$/u.test(normalized)) return 3;
        return null;
    };

    const sanitizeTrendBlock = (block?: Record<string, any>) => {
        const cleaned: Record<string, string | null> = {};
        if (!block) return cleaned;
        Object.entries(block).forEach(([key, value]) => {
            const trend = normalizeTrendValue(value);
            const normalizedKey = toHalfWidthDigits(key)
                .replace(/[［］【】\[\]\(\)\s\u3000]/g, "")
                .replace(/[‐‑–—−ーｰ－]/g, "-");
            const codeMatch = normalizedKey.match(/(\d{1,2}-\d{1,2})/);

            if (trend !== null) {
                const asString = String(trend);
                cleaned[key] = asString;
                if (codeMatch) {
                    cleaned[codeMatch[1]] = asString;
                }
            } else {
                if (!(key in cleaned)) {
                    cleaned[key] = null;
                }
                if (codeMatch) {
                    cleaned[codeMatch[1]] = null;
                }
            }
        });
        return cleaned;
    };
    const deriveTimeFromMap = (obj?: Record<string, any>) => {
        let mm = 0, ss = 0;
        if (!obj) return { mm, ss };
        for (const [k, v] of Object.entries(obj)) {
            if (k.includes("分") && !k.includes("秒")) {
                const n = digitsOnly(v);
                if (n > 0) mm = n;
            } else if (k.includes("秒")) {
                const n = digitsOnly(v);
                if (n > 0) ss = n;
            }
        }
        return { mm, ss };
    };

    const looksLikeTimeToken = (s: string) => /[分秒]/.test(normalizeTime(s));
    const combineTimeTokens = (a?: string, b?: string) => {
        const mm = toInt(extractMinutes(a)) || toInt(extractMinutes(b));
        const ss = toInt(extractSeconds(a)) || toInt(extractSeconds(b));
        if (mm || ss) return `${mm}分${String(ss).padStart(2, "0")}秒`;
        return "";
    };
    const setSmart = (obj: Record<string, string>, key: string, val: string) => {
        const existing = obj[key];
        if (existing) {
            if (key.includes("総合計タイム") || looksLikeTimeToken(key)) {
                const merged = combineTimeTokens(existing, val);
                if (merged) {
                    obj["総合計タイム"] = merged;
                    obj[key] = merged;
                    return;
                }
            }
        }

        const isPlaceholder = /^col_\d+$/i.test(key);
        if (isPlaceholder && obj["総合計タイム"]) {
            // Check if this looks like a time value (has 分/秒 OR is a plain number that could be seconds)
            const isTimeValue = looksLikeTimeToken(val) || /^\d{1,2}$/.test(val);
            if (isTimeValue) {
                console.log(`🔥 MERGE: key="${key}", val="${val}", existing="${obj["総合計タイム"]}"`);
                // If both are plain numbers, treat first as minutes and second as seconds
                const existingVal = obj["総合計タイム"];
                let merged = "";
                if (/^\d+$/.test(existingVal) && /^\d+$/.test(val)) {
                    merged = `${existingVal}分${String(val).padStart(2, "0")}秒`;
                } else {
                    // At least one has 分/秒, use combineTimeTokens
                    merged = combineTimeTokens(existingVal, val);
                }
                if (merged) {
                    obj["総合計タイム"] = merged;
                    console.log(`🔥 STORED: obj["総合計タイム"] = "${obj["総合計タイム"]}"`);
                    return;
                }
            }
        }

        obj[key] = val;
        if (key === "総合計タイム") {
            console.log(`✅ SET 総合計タイム: "${val}"`);
        }
    };

    const mapStatus = (jp?: string) => {
        const s = String(jp ?? "").trim();
        if (!s) return "new";
        if (s.includes("回目")) return "in_progress";
        if (s === "新規") return "new";
        return "new";
    };

    const parseStructuredCSV_OptionB = (text: string) => {

        const parsed = Papa.parse<string[]>(text, {
            delimiter: "",
            newline: "",
            quoteChar: '"',
            escapeChar: '"',
            header: false,
            skipEmptyLines: false,
            dynamicTyping: false,
            fastMode: false,
        });
        if (parsed.errors?.length) {
            const first = parsed.errors[0];
            throw new Error(`CSV parse error at row ${first.row}: ${first.message}`);
        }

        const rows = (parsed.data || []).map((r) => (Array.isArray(r) ? r : []));
        if (rows.length < 2) {
            throw new Error("CSV must contain at least 1 header row and 1 data row.");
        }

        const guessDataStart = (() => {
            for (let i = 0; i < rows.length; i++) {
                const a = String(rows[i]?.[0] ?? "").trim();
                if (/^\d{3,}$/.test(a)) return i;
            }
            return -1;
        })();
        const headerDepth = guessDataStart > 0 ? guessDataStart : Math.min(14, rows.length - 1);
        const headerLayers = rows.slice(0, headerDepth);
        const dataRows = rows.slice(headerDepth);
        if (dataRows.length === 0) {
            throw new Error("CSV has no data rows after header rows.");
        }

        const data = dataRows[0] || [];
        const cols = Math.max(...rows.map((r) => r.length), 0);

        // 3) Build final header per column = concatenate all non-empty header cells
        const finalHeader: string[] = Array.from({ length: cols }, (_, c) => {
            const pieces: string[] = [];
            for (let h = 0; h < headerDepth; h++) {
                const cell = normalize((headerLayers[h] && headerLayers[h][c]) || "");
                if (cell) pieces.push(cell);
            }
            return pieces.join(" ");
        });

        // 4) Group detection: choose the header row that most looks like group labels (e.g., "今回スコア.評価")
        const groupKeywords = ["今回", "前回", "全国平均", "スコア", "評価", "レーダー", "比較", "タイム", "ケア", "ワンカラー"];
        const bestHeaderIdx = (() => {
            let best = headerDepth - 1;
            let bestScore = -1;
            for (let h = 0; h < headerDepth; h++) {
                const joined = (headerLayers[h] || []).join(" ");
                const score = groupKeywords.reduce((acc, k) => acc + (joined.includes(k) ? 1 : 0), 0);
                if (score > bestScore) {
                    bestScore = score;
                    best = h;
                }
            }
            return best;
        })();
        const groupRow: string[] = Array.from({ length: cols }, (_, c) =>
            normalize((headerLayers[bestHeaderIdx] && headerLayers[bestHeaderIdx][c]) || "")
        );

        type GroupSpan = { key: string; start: number; end: number };
        const spans: GroupSpan[] = [];
        for (let c = 0; c < cols; c++) {
            if (groupRow[c]) {
                const key = groupRow[c];
                let end = cols - 1;
                for (let k = c + 1; k < cols; k++) {
                    if (groupRow[k]) {
                        end = k - 1;
                        break;
                    }
                }
                spans.push({ key, start: c, end });
            }
        }
        // Fallback: if no group cells at all, use a single span
        if (spans.length === 0) {
            spans.push({ key: "データ", start: 0, end: cols - 1 });
        }

        // 5) Lowest non-empty header per column (use dynamic headerDepth)
        const lowestHeaderAt = (col: number) => {
            for (let h = headerDepth - 1; h >= 0; h--) {
                const v = normalize((headerLayers[h] && headerLayers[h][col]) || "");
                if (v) return v;
            }
            return finalHeader[col] || `col_${col + 1}`;
        };

        // 6) Structured groups
        const structured: Record<string, Record<string, string>> = {};
        spans.forEach((span) => {
            const block: Record<string, string> = {};
            for (let c = span.start; c <= span.end; c++) {
                const subKey = lowestHeaderAt(c);
                const val = normalize(data[c] || "");
                if (subKey && val !== "") setSmart(block, subKey, val);
            }
            if (Object.keys(block).length) structured[span.key] = block;
        });

        // 7) A1-range helper
        const range = (start: string, end: string, includeEmpty = false) => {
            const s = excelToIndex(start);
            const e = excelToIndex(end);
            const obj: Record<string, string> = {};
            for (let c = s; c <= e; c++) {
                const k = lowestHeaderAt(c);
                const v = normalize(data[c] || "");
                if (k && (includeEmpty || v !== "")) setSmart(obj, k, v);
            }
            return obj;
        };

        // 8) Customer information (A4 to D4 and TE4 to TP4)
        const customerInfoBasic = range("A", "D");
        const customerInfoDemo = range("TE", "TP");
        const mergedCustomerInfo = { ...customerInfoBasic, ...customerInfoDemo };

        // 9) Extract data for specific tables according to the requirements
        const extractTableData = () => {
            // Score table: E4 to X4 (current) and O4 to V4 (previous, V has seconds)
            const scoreCurrent = range("E", "X");
            const scorePrevious = range("O", "V");

            // Radar chart table: Y4 to AB4 (current) and AC4 to AF4 (previous)
            const radarChartCurrent = range("Y", "AB");
            const radarChartPrevious = range("AC", "AF");

            // Care score table: AG4 to BF4 (current) and DG4 to EF4 (previous)
            const careScoreCurrent = range("AG", "BF");
            const careScorePrevious = range("DG", "EF");

            // Care evaluation graph table: BG4 to CF4 (current) and EG4 to FF4 (previous)
            const careEvalGraphCurrent = range("BG", "CF");
            const careEvalGraphPrevious = range("EG", "FF");

            // Care comparison table: CG4 to DF4 (average) and FG4 to GF4 (final)
            const rawCareComparisonAverage = range("CG", "DF", true);
            const rawCareComparisonFinal = range("FG", "GF", true);
            const careComparisonAverage = sanitizeTrendBlock(rawCareComparisonAverage);
            const careComparisonFinal = sanitizeTrendBlock(rawCareComparisonFinal);

            // Care radar chart table: GG4 to GJ4 (current) and GK4 to GN4 (previous)
            const careRadarChartCurrent = range("GG", "GJ");
            const careRadarChartPrevious = range("GK", "GN");

            // One color score table: GO4 to IA4 (current) and LB4 to MN4 (final)
            const oneColorScoreCurrent = range("GO", "IA");
            const oneColorScoreFinal = range("LB", "MN");

            // One color evaluation graph table: IB4 to JN4 (current) and MO4 to OA4 (final)
            const oneColorEvalGraphCurrent = range("IB", "JN");
            const oneColorEvalGraphFinal = range("MO", "OA");

            // One color comparison tables: JO-LA (平均) / OB-PN (前回)
            const rawOneColorComparisonAverage = range("JO", "LA", true);
            const rawOneColorComparisonPrevious = range("OB", "PN", true);
            const oneColorComparisonAverage = sanitizeTrendBlock(rawOneColorComparisonAverage);
            const oneColorComparisonPrevious = sanitizeTrendBlock(rawOneColorComparisonPrevious);

            // One color radar chart table: PO4 to PR4 (current) and PS4 to PV4 (previous)
            const oneColorRadarChartCurrent = range("PO", "PR");
            const oneColorRadarChartPrevious = range("PS", "PV");

            // Time both hand table: PW4 to QN4 (current) and RE4 to RT4 (final)
            const timeBothHandCurrent = range("PW", "QN");
            const timeBothHandFinal = range("RE", "RT");

            // Time evaluation graph table: QO4 to QV4 (current) and RU4 to SB4 (final)
            const timeEvalGraphCurrent = range("QO", "QV");
            const timeEvalGraphFinal = range("RU", "SB");

            // Time comparison tables: QW4 to RD4 (平均) and SC4 to SJ4 (前回)
            const rawTimeComparisonAverage = range("QW", "RD", true);
            const rawTimeComparisonPrevious = range("SC", "SJ", true);
            const timeComparisonAverage = sanitizeTrendBlock(rawTimeComparisonAverage);
            const timeComparisonPrevious = sanitizeTrendBlock(rawTimeComparisonPrevious);

            // Time radar chart table: SK4 to SP4 (current) and SQ4 to SV4 (final)
            const timeRadarChartCurrent = range("SK", "SP");
            const timeRadarChartFinal = range("SQ", "SV");

            // Comparison table: SW4 to SZ4 (final) and TA4 to TE4 (average)
            const comparisonFinal = range("SW", "SZ");
            const comparisonAverage = range("TA", "TE");

            return {
                score: {
                    current: scoreCurrent,
                    previous: scorePrevious,
                },
                radar_chart: {
                    current: radarChartCurrent,
                    previous: radarChartPrevious,
                },
                care_score: {
                    current: careScoreCurrent,
                    previous: careScorePrevious,
                },
                care_evaluation_graph: {
                    current: careEvalGraphCurrent,
                    previous: careEvalGraphPrevious,
                },
                care_comparison: {
                    average: careComparisonAverage,
                    final: careComparisonFinal,
                },
                care_radar_chart: {
                    current: careRadarChartCurrent,
                    previous: careRadarChartPrevious,
                },
                one_color_score: {
                    current: oneColorScoreCurrent,
                    final: oneColorScoreFinal,
                },
                one_color_evaluation_graph: {
                    current: oneColorEvalGraphCurrent,
                    final: oneColorEvalGraphFinal,
                },
                one_color_comparison: {
                    average: oneColorComparisonAverage,
                    previous: oneColorComparisonPrevious,
                },
                one_color_radar_chart: {
                    current: oneColorRadarChartCurrent,
                    previous: oneColorRadarChartPrevious,
                },
                time_both_hand: {
                    current: timeBothHandCurrent,
                    final: timeBothHandFinal,
                },
                time_evaluation_graph: {
                    current: timeEvalGraphCurrent,
                    final: timeEvalGraphFinal,
                },
                time_lapse_comparison: {
                    average: timeComparisonAverage,
                    previous: timeComparisonPrevious,
                },
                time_radar_chart: {
                    current: timeRadarChartCurrent,
                    final: timeRadarChartFinal,
                },
                comparison: {
                    final: comparisonFinal,
                    average: comparisonAverage,
                },
            };
        };

        const tableData = extractTableData();

        const findByIncludes = (obj: Record<string, string>, needle: string) => {
            const k = Object.keys(obj).find((k) => k.includes(needle));
            return k ? obj[k] : "";
        };
        const customerData = {
            external_id:
                findByIncludes(mergedCustomerInfo, "ID") ||
                findByIncludes(mergedCustomerInfo, "Id"),
            name: findByIncludes(mergedCustomerInfo, "名前"),
            issuer: findByIncludes(mergedCustomerInfo, "発行元"),
            assessment_date: findByIncludes(mergedCustomerInfo, "採点日"),
            email: findByIncludes(mergedCustomerInfo, "メール"),
            prefecture: findByIncludes(mergedCustomerInfo, "都道府県"),
            age: findByIncludes(mergedCustomerInfo, "年齢"),
            nailist_experience: findByIncludes(mergedCustomerInfo, "ネイリスト歴"),
            occupation_type: findByIncludes(mergedCustomerInfo, "職業"),
            current_monthly_customers: findByIncludes(mergedCustomerInfo, "月平均施術人数"),
            salon_work_experience: findByIncludes(mergedCustomerInfo, "サロン勤務歴"),
            salon_monthly_customers: findByIncludes(mergedCustomerInfo, "サロン勤務時の月平均"),
            blank_period: findByIncludes(mergedCustomerInfo, "ブランク"),
            status: findByIncludes(mergedCustomerInfo, "ステータス（新規/２回目以降)"),
            application_date: findByIncludes(mergedCustomerInfo, "申し込み日"),
        };

        // 10) dbReady dumps
        const dbReady: Record<string, { data: Record<string, string>; group_key: string }> = {};
        spans.forEach((span) => {
            const key = span.key;
            let tableKey = key
                .toLowerCase()
                .replace(/\./g, "_")
                .replace(/\s+/g, "_")
                .replace(/[()\-]/g, "");
            if (key.includes("今回スコア") && key.includes("評価")) tableKey = "nowscore_review";
            else if (key.includes("前回スコア") && key.includes("評価")) tableKey = "formerscore_review";
            else if (key.includes("ケア")) tableKey = "imjireda_chat";
            else if (key.includes("ワンカラー")) tableKey = "new_points_now_color_scores";
            else if (key.includes("タイム")) tableKey = "now_time_both_hands";

            dbReady[tableKey] = { data: structured[key], group_key: key };
        });

        return {
            headerLayers,
            groupRow,
            spans,
            finalHeader,
            data,
            structured,
            mergedCustomerInfo,
            customerData,
            dbReady,
            tableData,
        };
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0]) return;
        const f = e.target.files[0];
        setFile(f);
        setCompleted(false);

        try {
            const text = await f.text();
            const { structured, tableData } = parseStructuredCSV_OptionB(text);
            const items: { key: string; value: string }[] = [];

            // Add structured groups
            Object.entries(structured).forEach(([g, block]) => {
                Object.entries(block)
                    .slice(0, 2)
                    .forEach(([k, v]) => items.push({ key: `${g} > ${k}`, value: String(v) }));
            });

            // Add table data
            Object.entries(tableData).forEach(([table, data]) => {
                Object.entries(data).forEach(([subtype, data]) => {
                    Object.entries(data)
                        .slice(0, 1)
                        .forEach(([k, v]) => items.push({ key: `${table} > ${subtype} > ${k}`, value: String(v) }));
                });
            });

            setPreview(items.slice(0, 5));
        } catch (err: any) {
            console.error(err);
            toast({
                title: "エラー",
                description: err.message || "CSVの解析に失敗しました。",
                variant: "destructive",
            });
        }
    };

    const handleUpload = async () => {
        if (!file) {
            toast({
                title: "エラー",
                description: "ファイルを選択してください。",
                variant: "destructive",
            });
            return;
        }

        setUploading(true);
        setProgress(10);

        try {
            const text = await file.text();
            const {
                structured,
                customerData: raw,
                mergedCustomerInfo,
                dbReady,
                tableData,
            } = parseStructuredCSV_OptionB(text);

            // Synthesize "score.previous" (全国平均＝前回) from structured groups when fixed range misses it
            const synthesizePrevFromStructured = (groups: Record<string, Record<string, string>>) => {
                // Prefer a group whose name includes "前回" and "スコア", otherwise try "全国平均"
                const gKey =
                    Object.keys(groups).find((k) => k.includes("前回") && k.includes("スコア")) ||
                    Object.keys(groups).find((k) => k.includes("全国平均") && k.includes("スコア")) ||
                    Object.keys(groups).find((k) => k.includes("前回")) ||
                    Object.keys(groups).find((k) => k.includes("全国平均"));

                const g = gKey ? groups[gKey] : undefined;
                const pick = (...candidates: string[]) => {
                    if (!g) return "";
                    for (const c of candidates) {
                        const v = (g as any)[c];
                        if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
                    }
                    return "";
                };

                const out: Record<string, string> = {};
                out["総合 スコア"] = pick("総合 スコア", "総合スコア", "総合", "総合点", "合計");
                out["ケア スコア"] = pick("ケア スコア", "ケア");
                out["ワンカラー スコア"] = pick("ワンカラー スコア", "ワンカラー", "ワン カラー");
                out["タイム スコア"] = pick("タイム スコア", "タイム");

                out["総合評価"] = pick("総合評価", "総合 ランク", "総合 評価");
                out["ケア評価"] = pick("ケア評価", "ケア 評価");
                out["ワンカラー評価"] = pick("ワンカラー評価", "ワンカラー 評価");
                out["タイム評価"] = pick("タイム評価", "タイム 評価");
                // Time string, shown under the table as 全国平均＝前回
                out["総合計タイム"] = pick("総合計タイム", "両手総合計", "両手総合計タイム", "タイム合計");
                // Drop empty keys
                Object.keys(out).forEach((k) => {
                    if (!out[k]) delete out[k];
                });
                return out;
            };

            const prevSynth = synthesizePrevFromStructured(structured);

            const parsedAssessmentDate = ensureISODate(mergedCustomerInfo["採点日"] || raw.assessment_date);

            // 1) Upsert customer
            const custPayload = {
                external_id: raw.external_id,
                name: raw.name,
                issuer: raw.issuer,
                email: raw.email,
                prefecture: raw.prefecture,
                age: toInt(raw.age),
                nailist_experience: raw.nailist_experience,
                occupation_type: raw.occupation_type,
                current_monthly_customers: toInt(raw.current_monthly_customers),
                salon_work_experience: raw.salon_work_experience,
                salon_monthly_customers: toInt(raw.salon_monthly_customers),
                blank_period: raw.blank_period,
                status: mapStatus(raw.status),
                // UI currently treats application_date as 採点日, so keep them in sync
                application_date: parsedAssessmentDate,
            };

            const { data: customer, error: customerError } = await supabase
                .from("customers")
                .upsert(custPayload, { onConflict: "external_id" })
                .select("id")
                .single();
            if (customerError) throw customerError;
            if (!customer?.id) throw new Error("Customer upsert failed.");
            const customerId = customer.id;

            setProgress(25);

            let currentGroup: Record<string, string> | undefined =
                Object.entries(structured).find(([k]) => k.includes("今回") && k.includes("スコア"))?.[1];
            if (!currentGroup) {
                currentGroup = Object.entries(structured).find(([k]) => k.includes("スコア"))?.[1];
            }
            currentGroup = currentGroup || {};

            const rawTotalTime = currentGroup["総合計タイム"];
            let resolvedMinutes = toInt(extractMinutes(rawTotalTime));
            let resolvedSeconds = toInt(extractSeconds(rawTotalTime));
            if (resolvedSeconds === 0) {
                const tbh = (tableData?.time_both_hand?.current ?? {}) as Record<string, any>;
                const tev = (tableData?.time_evaluation_graph?.current ?? {}) as Record<string, any>;
                const derive1 = deriveTimeFromMap(tbh);
                const derive2 = deriveTimeFromMap(tev);
                const derivedSeconds = derive1.ss || derive2.ss || 0;
                const derivedMinutes = derive1.mm || derive2.mm || 0;
                if (resolvedSeconds === 0 && derivedSeconds > 0) resolvedSeconds = derivedSeconds;
                if (resolvedMinutes === 0 && derivedMinutes > 0) resolvedMinutes = derivedMinutes;
            }

            const careDetails = Object.entries(structured).find(([k]) => k.includes("ケア"))?.[1] || {};
            const oneColorDetails = Object.entries(structured).find(([k]) => k.includes("ワンカラー"))?.[1] || {};
            const timeDetails = Object.entries(structured).find(([k]) => k.includes("タイム"))?.[1] || {};

            console.log("🔍 Debug assessment_date:", {
                "mergedCustomerInfo['採点日']": mergedCustomerInfo["採点日"],
                "raw.assessment_date": raw.assessment_date,
                parsedAssessmentDate,
            });
            const assessmentData = {
                customer_id: customerId,
                assessment_date: parsedAssessmentDate,
                care_score: toInt(currentGroup["ケア スコア"] || currentGroup["ケアスコア"] || currentGroup["ケア"]),
                care_rating: currentGroup["ケア評価"] || currentGroup["ケア 評価"] || currentGroup["ケアランク"] || "",
                one_color_score: toInt(currentGroup["ワンカラー スコア"] || currentGroup["ワンカラースコア"] || currentGroup["ワンカラー"]),
                one_color_rating: currentGroup["ワンカラー評価"] || currentGroup["ワンカラー 評価"] || currentGroup["ワンカラーランク"] || "",
                time_score: toInt(currentGroup["タイム スコア"] || currentGroup["タイムスコア"] || currentGroup["タイム"]),
                time_rating: currentGroup["タイム評価"] || currentGroup["タイム 評価"] || currentGroup["タイムランク"] || "",
                total_score: toInt(currentGroup["総合 スコア"] || currentGroup["総合スコア"] || currentGroup["総合"]),
                total_rating: currentGroup["総合評価"] || currentGroup["総合 評価"] || currentGroup["総合ランク"] || "",
                total_time_minutes: resolvedMinutes,
                total_time_seconds: resolvedSeconds,
                care_details: careDetails,
                one_color_details: oneColorDetails,
                time_details: timeDetails,
                is_current: true,
                source: "csv_import",
            };

            const scoreCur = (tableData?.score?.current ?? {}) as Record<string, any>;
            const pick = (...keys: string[]) => {
                for (const k of keys) {
                    const v = scoreCur[k];
                    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
                }
                return "";
            };
            const toNum = (s: string) => toInt(s);
            const vTotal = pick("総合 スコア", "総合スコア", "総合");
            const vCare = pick("ケア スコア", "ケア");
            const vOne = pick("ワンカラー スコア", "ワンカラー", "ワン カラー");
            const vTime = pick("タイム スコア", "タイム");
            const rTotal = pick("総合評価", "総合 評価");
            const rCare = pick("ケア評価", "ケア 評価");
            const rOne = pick("ワンカラー評価", "ワンカラー 評価");
            const rTime = pick("タイム評価", "タイム 評価");
            if (vTotal) assessmentData.total_score = toNum(vTotal);
            if (vCare) assessmentData.care_score = toNum(vCare);
            if (vOne) assessmentData.one_color_score = toNum(vOne);
            if (vTime) assessmentData.time_score = toNum(vTime);
            if (rTotal) assessmentData.total_rating = rTotal;
            if (rCare) assessmentData.care_rating = rCare;
            if (rOne) assessmentData.one_color_rating = rOne;
            if (rTime) assessmentData.time_rating = rTime;

            const { data: a, error: assessError } = await supabase
                .from("assessments")
                .insert(assessmentData)
                .select("id")
                .single();
            if (assessError) throw assessError;
            const assessmentId = a.id;

            setProgress(45);

            const sanitizeLeaf = (sub: string, val: any) => {
                const sub_item = String(sub || "").trim().slice(0, 120);
                let score = 0;
                let rating: string | null = null;
                let comment: string | null = null;
                if (val && typeof val === "object") {
                    score = toInt((val as any).score);
                    rating = (val as any).rating != null ? String((val as any).rating).slice(0, 30) : null;
                    comment = (val as any).comment != null ? String((val as any).comment).slice(0, 200) : null;
                } else {
                    score = toInt(val);
                }
                return { sub_item, score, rating, comment };
            };
            const insertScoresWithFallback = async (
                rawRows: Array<{ assessment_id: string; category: string; sub_item: string; score: number; rating: string | null; comment: string | null; }>
            ) => {

                const candidates = ["sub_item", "item", "subitem", "label", "name"];
                let lastError: any = null;
                for (const col of candidates) {
                    const payload = rawRows.map(({ assessment_id, category, sub_item, score, rating, comment }) => ({
                        assessment_id, category, [col]: sub_item, score, rating, comment,
                    }));
                    const { error } = await supabase.from("scores").insert(payload as any);
                    if (!error) return; // success
                    lastError = error;
                    const code = (error as any)?.code || (error as any)?.details || "";
                    if (typeof code === "string" && !code.includes("PGRST") && !code.includes("column")) break;
                }
                if (lastError) console.warn("scores insert failed (all fallbacks):", lastError);
            };
            const insertLeaves = async (
                details: Record<string, any>,
                category: "care" | "one_color" | "time"
            ) => {
                const entries = Object.entries(details);
                if (!entries.length) return;
                const payload = entries.map(([sub, val]) => {
                    const leaf = sanitizeLeaf(sub, val);
                    return {
                        assessment_id: assessmentId,
                        category,
                        sub_item: leaf.sub_item,
                        score: leaf.score,
                        rating: leaf.rating,
                        comment: leaf.comment,
                    };
                });
                if (payload.length) await insertScoresWithFallback(payload as any);
            };
            await insertLeaves(assessmentData.care_details, "care");
            await insertLeaves(assessmentData.one_color_details, "one_color");
            await insertLeaves(assessmentData.time_details, "time");

            setProgress(60);

            // 4) Persist customer_information merged snapshot
            const { error: ciErr } = await supabase.from("section_blobs").insert({
                customer_id: customerId, assessment_id: assessmentId, section: "customer_information",
                subtype: "merged",
                data: mergedCustomerInfo,
                source: "csv_import",
            });
            if (ciErr) console.warn("section_blobs insert warn:", ciErr);

            // 5) Persist data to specific tables according to the requirements
            const persistTableData = async () => {

                const buildTimeText = (mm: number, ss: number) => `${mm}分${String(ss).padStart(2, "0")}秒`;
                const scoreCurrentWithTime: Record<string, any> = { ...(tableData.score.current || {}) };
                console.log("DEBUG: scoreCurrentWithTime after range parsing:", JSON.stringify(scoreCurrentWithTime, null, 2));
                try {
                    // Find potential time key in score.current (flexible matching)
                    const timeKeyCurr = Object.keys(scoreCurrentWithTime).find(k =>
                        k.includes("タイム") && (k.includes("総合") || k.includes("合計") || k.includes("両手"))
                    ) || "総合計タイム";
                    let rawTimeCurr = scoreCurrentWithTime[timeKeyCurr] || "";
                    let blobCurMM = toInt(extractMinutes(rawTimeCurr));
                    let blobCurSS = toInt(extractSeconds(rawTimeCurr));

                    // Always derive from score.current keys that include 分/秒
                    const dScore = deriveTimeFromMap(scoreCurrentWithTime);
                    blobCurMM = blobCurMM || dScore.mm || 0;
                    blobCurSS = blobCurSS || dScore.ss || 0;

                    if (blobCurMM === 0 && blobCurSS === 0) {
                        // Derive from time-related current blocks if the range didn't have it
                        const d1 = deriveTimeFromMap((tableData as any)?.time_both_hand?.current);
                        const d2 = deriveTimeFromMap((tableData as any)?.time_evaluation_graph?.current);
                        blobCurMM = blobCurMM || d1.mm || d2.mm || 0;
                        blobCurSS = blobCurSS || d1.ss || d2.ss || 0;
                    }
                    // Final fallback to already-resolved minutes/seconds used in assessmentData
                    if (blobCurMM === 0 && blobCurSS === 0) {
                        blobCurMM = resolvedMinutes;
                        blobCurSS = resolvedSeconds;
                    }
                    // If still missing, compose from currentGroup and derived maps again as a last resort
                    if (blobCurMM === 0 && blobCurSS === 0) {
                        blobCurMM = toInt(extractMinutes(currentGroup["総合計タイム"]));
                        blobCurSS = toInt(extractSeconds(currentGroup["総合計タイム"]));
                        if (blobCurSS === 0) {
                            const d1 = deriveTimeFromMap((tableData as any)?.time_both_hand?.current);
                            const d2 = deriveTimeFromMap((tableData as any)?.time_evaluation_graph?.current);
                            blobCurMM = blobCurMM || d1.mm || d2.mm || 0;
                            blobCurSS = blobCurSS || d1.ss || d2.ss || 0;
                        }
                    }
                    scoreCurrentWithTime["総合計タイム"] = buildTimeText(blobCurMM, blobCurSS);
                    console.log("DEBUG: Final scoreCurrentWithTime[総合計タイム]:", scoreCurrentWithTime["総合計タイム"]);
                    console.log("DEBUG: blobCurMM:", blobCurMM, "blobCurSS:", blobCurSS);
                } catch (e) {
                    // Best effort; if anything goes wrong we skip enriching
                    console.error("DEBUG: Error in scoreCurrentWithTime enrichment:", e);
                }

                if (Object.keys(scoreCurrentWithTime).length > 0) {
                    const { error } = await supabase.from("section_blobs").insert({
                        customer_id: customerId, assessment_id: assessmentId, section: "score",
                        subtype: "current",
                        data: scoreCurrentWithTime,
                        source: "csv_import",
                    });
                    if (error) console.warn("score current insert warn:", error);
                }

                // Merge synthesized previous block to ensure 全国平均＝前回 is always available and unify time text
                const scorePrevMerged: Record<string, any> = {
                    ...(tableData.score.previous || {}),
                    ...(prevSynth || {}),
                };

                try {
                    // Find potential time key in score.previous (flexible matching)
                    const timeKeyPrev = Object.keys(scorePrevMerged).find(k =>
                        k.includes("タイム") && (k.includes("総合") || k.includes("合計") || k.includes("両手"))
                    ) || "総合計タイム";
                    let rawTimePrev = scorePrevMerged[timeKeyPrev] || "";
                    let blobPrevMM = toInt(extractMinutes(rawTimePrev));
                    let blobPrevSS = toInt(extractSeconds(rawTimePrev));

                    const dScorePrev = deriveTimeFromMap(scorePrevMerged);
                    blobPrevMM = blobPrevMM || dScorePrev.mm || 0;
                    blobPrevSS = blobPrevSS || dScorePrev.ss || 0;

                    if (blobPrevMM === 0 && blobPrevSS === 0) {
                        // Derive from time-related previous/final blocks
                        const d1 = deriveTimeFromMap((tableData as any)?.time_lapse_comparison?.average);
                        const d2 = deriveTimeFromMap((tableData as any)?.time_both_hand?.final);
                        const d3 = deriveTimeFromMap((tableData as any)?.time_evaluation_graph?.final);
                        blobPrevMM = blobPrevMM || d1.mm || d2.mm || d3.mm || 0;
                        blobPrevSS = blobPrevSS || d1.ss || d2.ss || d3.ss || 0;
                    }
                    scorePrevMerged["総合計タイム"] = buildTimeText(blobPrevMM, blobPrevSS);
                } catch (e) {
                    // Best effort; if anything goes wrong we skip enriching
                }

                if (Object.keys(scorePrevMerged).length > 0) {
                    const { error } = await supabase.from("section_blobs").insert({
                        customer_id: customerId, assessment_id: assessmentId, section: "score",
                        subtype: "previous",
                        data: scorePrevMerged,
                        source: "csv_import",
                    });
                    if (error) console.warn("score previous insert warn:", error);
                }

                // Radar chart table
                if (Object.keys(tableData.radar_chart.current).length > 0) {
                    const { error } = await supabase.from("section_blobs").insert({
                        customer_id: customerId, assessment_id: assessmentId, section: "radar_chart",
                        subtype: "current",
                        data: tableData.radar_chart.current,
                        source: "csv_import",
                    });
                    if (error) console.warn("radar_chart current insert warn:", error);
                }
                if (Object.keys(tableData.radar_chart.previous).length > 0) {
                    const { error } = await supabase.from("section_blobs").insert({
                        customer_id: customerId, assessment_id: assessmentId, section: "radar_chart",
                        subtype: "previous",
                        data: tableData.radar_chart.previous,
                        source: "csv_import",
                    });
                    if (error) console.warn("radar_chart previous insert warn:", error);
                }

                // Care score table
                if (Object.keys(tableData.care_score.current).length > 0) {
                    const { error } = await supabase.from("section_blobs").insert({
                        customer_id: customerId, assessment_id: assessmentId, section: "care_score",
                        subtype: "current",
                        data: tableData.care_score.current,
                        source: "csv_import",
                    });
                    if (error) console.warn("care_score current insert warn:", error);
                }
                if (Object.keys(tableData.care_score.previous).length > 0) {
                    const { error } = await supabase.from("section_blobs").insert({
                        customer_id: customerId, assessment_id: assessmentId, section: "care_score",
                        subtype: "previous",
                        data: tableData.care_score.previous,
                        source: "csv_import",
                    });
                    if (error) console.warn("care_score previous insert warn:", error);
                }

                // Care evaluation graph table
                if (Object.keys(tableData.care_evaluation_graph.current).length > 0) {
                    const { error } = await supabase.from("section_blobs").insert({
                        customer_id: customerId, assessment_id: assessmentId, section: "care_evaluation_graph",
                        subtype: "current",
                        data: tableData.care_evaluation_graph.current,
                        source: "csv_import",
                    });
                    if (error) console.warn("care_evaluation_graph current insert warn:", error);
                }
                if (Object.keys(tableData.care_evaluation_graph.previous).length > 0) {
                    const { error } = await supabase.from("section_blobs").insert({
                        customer_id: customerId, assessment_id: assessmentId, section: "care_evaluation_graph",
                        subtype: "previous",
                        data: tableData.care_evaluation_graph.previous,
                        source: "csv_import",
                    });
                    if (error) console.warn("care_evaluation_graph previous insert warn:", error);
                }

                // Care comparison table
                if (Object.keys(tableData.care_comparison.average).length > 0) {
                    const { error } = await supabase.from("section_blobs").insert({
                        customer_id: customerId, assessment_id: assessmentId, section: "care_comparison",
                        subtype: "average",
                        data: tableData.care_comparison.average,
                        source: "csv_import",
                    });
                    if (error) console.warn("care_comparison average insert warn:", error);
                }
                if (Object.keys(tableData.care_comparison.final).length > 0) {
                    const { error } = await supabase.from("section_blobs").insert({
                        customer_id: customerId, assessment_id: assessmentId, section: "care_comparison",
                        subtype: "final",
                        data: tableData.care_comparison.final,
                        source: "csv_import",
                    });
                    if (error) console.warn("care_comparison final insert warn:", error);
                }

                // Care radar chart table
                if (Object.keys(tableData.care_radar_chart.current).length > 0) {
                    const { error } = await supabase.from("section_blobs").insert({
                        customer_id: customerId, assessment_id: assessmentId, section: "care_radar_chart",
                        subtype: "current",
                        data: tableData.care_radar_chart.current,
                        source: "csv_import",
                    });
                    if (error) console.warn("care_radar_chart current insert warn:", error);
                }
                if (Object.keys(tableData.care_radar_chart.previous).length > 0) {
                    const { error } = await supabase.from("section_blobs").insert({
                        customer_id: customerId, assessment_id: assessmentId, section: "care_radar_chart",
                        subtype: "previous",
                        data: tableData.care_radar_chart.previous,
                        source: "csv_import",
                    });
                    if (error) console.warn("care_radar_chart previous insert warn:", error);
                }

                // One color score table
                if (Object.keys(tableData.one_color_score.current).length > 0) {
                    const { error } = await supabase.from("section_blobs").insert({
                        customer_id: customerId, assessment_id: assessmentId, section: "one_color_score",
                        subtype: "current",
                        data: tableData.one_color_score.current,
                        source: "csv_import",
                    });
                    if (error) console.warn("one_color_score current insert warn:", error);
                }
                if (Object.keys(tableData.one_color_score.final).length > 0) {
                    const { error } = await supabase.from("section_blobs").insert({
                        customer_id: customerId, assessment_id: assessmentId, section: "one_color_score",
                        subtype: "final",
                        data: tableData.one_color_score.final,
                        source: "csv_import",
                    });
                    if (error) console.warn("one_color_score final insert warn:", error);
                }

                // One color evaluation graph table
                if (Object.keys(tableData.one_color_evaluation_graph.current).length > 0) {
                    const { error } = await supabase.from("section_blobs").insert({
                        customer_id: customerId, assessment_id: assessmentId, section: "one_color_evaluation_graph",
                        subtype: "current",
                        data: tableData.one_color_evaluation_graph.current,
                        source: "csv_import",
                    });
                    if (error) console.warn("one_color_evaluation_graph current insert warn:", error);
                }
                if (Object.keys(tableData.one_color_evaluation_graph.final).length > 0) {
                    const { error } = await supabase.from("section_blobs").insert({
                        customer_id: customerId, assessment_id: assessmentId, section: "one_color_evaluation_graph",
                        subtype: "final",
                        data: tableData.one_color_evaluation_graph.final,
                        source: "csv_import",
                    });
                    if (error) console.warn("one_color_evaluation_graph final insert warn:", error);
                }

                // One color comparison tables
                if (Object.keys(tableData.one_color_comparison.average).length > 0) {
                    const { error } = await supabase.from("section_blobs").insert({
                        customer_id: customerId, assessment_id: assessmentId, section: "one_color_comparison",
                        subtype: "average",
                        data: tableData.one_color_comparison.average,
                        source: "csv_import",
                    });
                    if (error) console.warn("one_color_comparison average insert warn:", error);
                }
                if (Object.keys(tableData.one_color_comparison.previous).length > 0) {
                    const { error } = await supabase.from("section_blobs").insert({
                        customer_id: customerId, assessment_id: assessmentId, section: "one_color_comparison",
                        subtype: "previous",
                        data: tableData.one_color_comparison.previous,
                        source: "csv_import",
                    });
                    if (error) console.warn("one_color_comparison previous insert warn:", error);
                }

                // One color radar chart table
                if (Object.keys(tableData.one_color_radar_chart.current).length > 0) {
                    const { error } = await supabase.from("section_blobs").insert({
                        customer_id: customerId, assessment_id: assessmentId, section: "one_color_radar_chart",
                        subtype: "current",
                        data: tableData.one_color_radar_chart.current,
                        source: "csv_import",
                    });
                    if (error) console.warn("one_color_radar_chart current insert warn:", error);
                }
                if (Object.keys(tableData.one_color_radar_chart.previous).length > 0) {
                    const { error } = await supabase.from("section_blobs").insert({
                        customer_id: customerId, assessment_id: assessmentId, section: "one_color_radar_chart",
                        subtype: "previous",
                        data: tableData.one_color_radar_chart.previous,
                        source: "csv_import",
                    });
                    if (error) console.warn("one_color_radar_chart previous insert warn:", error);
                }

                // Time both hand table
                if (Object.keys(tableData.time_both_hand.current).length > 0) {
                    const { error } = await supabase.from("section_blobs").insert({
                        customer_id: customerId, assessment_id: assessmentId, section: "time_both_hand",
                        subtype: "current",
                        data: tableData.time_both_hand.current,
                        source: "csv_import",
                    });
                    if (error) console.warn("time_both_hand current insert warn:", error);
                }
                if (Object.keys(tableData.time_both_hand.final).length > 0) {
                    const { error } = await supabase.from("section_blobs").insert({
                        customer_id: customerId, assessment_id: assessmentId, section: "time_both_hand",
                        subtype: "final",
                        data: tableData.time_both_hand.final,
                        source: "csv_import",
                    });
                    if (error) console.warn("time_both_hand final insert warn:", error);
                }

                // Time evaluation graph table
                if (Object.keys(tableData.time_evaluation_graph.current).length > 0) {
                    const { error } = await supabase.from("section_blobs").insert({
                        customer_id: customerId, assessment_id: assessmentId, section: "time_evaluation_graph",
                        subtype: "current",
                        data: tableData.time_evaluation_graph.current,
                        source: "csv_import",
                    });
                    if (error) console.warn("time_evaluation_graph current insert warn:", error);
                }
                if (Object.keys(tableData.time_evaluation_graph.final).length > 0) {
                    const { error } = await supabase.from("section_blobs").insert({
                        customer_id: customerId, assessment_id: assessmentId, section: "time_evaluation_graph",
                        subtype: "final",
                        data: tableData.time_evaluation_graph.final,
                        source: "csv_import",
                    });
                    if (error) console.warn("time_evaluation_graph final insert warn:", error);
                }

                // Time comparison table
                if (Object.keys(tableData.time_lapse_comparison.average).length > 0) {
                    const { error } = await supabase.from("section_blobs").insert({
                        customer_id: customerId, assessment_id: assessmentId, section: "time_lapse_comparison",
                        subtype: "average",
                        data: tableData.time_lapse_comparison.average,
                        source: "csv_import",
                    });
                    if (error) console.warn("time_lapse_comparison average insert warn:", error);
                }
                if (Object.keys(tableData.time_lapse_comparison.previous).length > 0) {
                    const { error } = await supabase.from("section_blobs").insert({
                        customer_id: customerId, assessment_id: assessmentId, section: "time_lapse_comparison",
                        subtype: "previous",
                        data: tableData.time_lapse_comparison.previous,
                        source: "csv_import",
                    });
                    if (error) console.warn("time_lapse_comparison previous insert warn:", error);
                }

                // Time radar chart table
                if (Object.keys(tableData.time_radar_chart.current).length > 0) {
                    const { error } = await supabase.from("section_blobs").insert({
                        customer_id: customerId, assessment_id: assessmentId, section: "time_radar_chart",
                        subtype: "current",
                        data: tableData.time_radar_chart.current,
                        source: "csv_import",
                    });
                    if (error) console.warn("time_radar_chart current insert warn:", error);
                }
                if (Object.keys(tableData.time_radar_chart.final).length > 0) {
                    const { error } = await supabase.from("section_blobs").insert({
                        customer_id: customerId, assessment_id: assessmentId, section: "time_radar_chart",
                        subtype: "final",
                        data: tableData.time_radar_chart.final,
                        source: "csv_import",
                    });
                    if (error) console.warn("time_radar_chart final insert warn:", error);
                }

                // Comparison table
                if (Object.keys(tableData.comparison.final).length > 0) {
                    const { error } = await supabase.from("section_blobs").insert({
                        customer_id: customerId, assessment_id: assessmentId, section: "comparison",
                        subtype: "final",
                        data: tableData.comparison.final,
                        source: "csv_import",
                    });
                    if (error) console.warn("comparison final insert warn:", error);
                }
                if (Object.keys(tableData.comparison.average).length > 0) {
                    const { error } = await supabase.from("section_blobs").insert({
                        customer_id: customerId, assessment_id: assessmentId, section: "comparison",
                        subtype: "average",
                        data: tableData.comparison.average,
                        source: "csv_import",
                    });
                    if (error) console.warn("comparison average insert warn:", error);
                }
            };

            await persistTableData();

            setProgress(80);

            // 6) Optional: dump whole groups into their mapped tables
            const skipTables = new Set([
                "customer_information",
                "score",
                "radar_chart",
                "care_score",
                "care_evaluation_graph",
                "care_comparison",
                "care_radar_chart",
                "one_color_score",
                "one_color_evaluation_graph",
                "one_color_comparison",
                "one_color_radar_chart",
                "time_both_hand",
                "time_evaluation_graph",
                "time_lapse_comparison",
                "time_radar_chart",
                "comparison",
                "nowscore_review",
                "formerscore_review",
                "imjireda_chat",
                "new_points_now_color_scores",
                "now_time_both_hands",
            ]);
            for (const [tableName, payload] of Object.entries(dbReady)) {
                if (skipTables.has(tableName)) continue;
                if (!payload?.data || !Object.keys(payload.data).length) continue;
                const { error } = await supabase.from("section_blobs").insert({
                    customer_id: customerId, assessment_id: assessmentId, section: tableName,
                    subtype: "raw",
                    data: payload.data,
                    source: "csv_import",
                });
                if (error) console.warn(`section_blobs insert warn: ${tableName}`, error);
            }

            setProgress(100);
            setCompleted(true);
            toast({
                title: "インポート完了",
                description: "CSVのデータを登録しました。",
            });

            setTimeout(() => navigate("/customers"), 900);
        } catch (err: any) {
            console.error(err);
            toast({
                title: "エラー",
                description: err.message || "ファイルの解析または登録中に問題が発生しました。",
                variant: "destructive",
            });
        } finally {
            setUploading(false);
        }
    };

    const handleUploadMulti = async () => {
        if (!file) {
            toast({
                title: "エラー",
                description: "ファイルを選択してください。",
                variant: "destructive",
            });
            return;
        }

        setUploading(true);
        setProgress(5);

        try {
            const text = await file.text();

            const parsed = Papa.parse<string[]>(text, {
                delimiter: "",
                newline: "",
                quoteChar: '"',
                escapeChar: '"',
                header: false,
                skipEmptyLines: false,
                dynamicTyping: false,
                fastMode: false,
            });
            if (parsed.errors?.length) {
                const first = parsed.errors[0];
                throw new Error(`CSV parse error at row ${first.row}: ${first.message}`);
            }

            const rows = (parsed.data || []).map((r) => (Array.isArray(r) ? r : []));
            if (rows.length < 2) throw new Error("CSV must contain at least 1 header row and 1 data row.");
            const guessDataStart = (() => {
                for (let i = 0; i < rows.length; i++) {
                    const a = String(rows[i]?.[0] ?? "").trim();
                    if (/^\d{3,}$/.test(a)) return i;
                }
                return -1;
            })();
            const headerDepth = guessDataStart > 0 ? guessDataStart : Math.min(14, rows.length - 1);
            const headerLayers = rows.slice(0, headerDepth);
            const dataRows = rows.slice(headerDepth);
            if (dataRows.length === 0) throw new Error("CSV has no data rows after header rows.");

            const cols = Math.max(...rows.map((r) => r.length), 0);

            const normalize = (s: string) =>
                (s || "")
                    .replace(/\r/g, "")
                    .replace(/^"+|"+$/g, "")
                    .replace(/\s+/g, " ")
                    .trim();

            const finalHeader: string[] = Array.from({ length: cols }, (_, c) => {
                const pieces: string[] = [];
                for (let h = 0; h < headerDepth; h++) {
                    const cell = normalize((headerLayers[h] && headerLayers[h][c]) || "");
                    if (cell) pieces.push(cell);
                }
                return pieces.join(" ");
            });

            const groupKeywords = ["今回", "前回", "全国平均", "スコア", "評価", "レーダー", "比較", "タイム", "ケア", "ワンカラー"];
            const bestHeaderIdx = (() => {
                let best = headerDepth - 1;
                let bestScore = -1;
                for (let h = 0; h < headerDepth; h++) {
                    const joined = (headerLayers[h] || []).join(" ");
                    const score = groupKeywords.reduce((acc, k) => acc + (joined.includes(k) ? 1 : 0), 0);
                    if (score > bestScore) {
                        bestScore = score;
                        best = h;
                    }
                }
                return best;
            })();
            const groupRow: string[] = Array.from({ length: cols }, (_, c) =>
                normalize((headerLayers[bestHeaderIdx] && headerLayers[bestHeaderIdx][c]) || "")
            );

            type GroupSpan = { key: string; start: number; end: number };
            const spans: GroupSpan[] = [];
            for (let c = 0; c < cols; c++) {
                if (groupRow[c]) {
                    const key = groupRow[c];
                    let end = cols - 1;
                    for (let k = c + 1; k < cols; k++) {
                        if (groupRow[k]) {
                            end = k - 1;
                            break;
                        }
                    }
                    spans.push({ key, start: c, end });
                }
            }
            if (spans.length === 0) {
                spans.push({ key: "データ", start: 0, end: cols - 1 });
            }

            const lowestHeaderAt = (col: number) => {
                for (let h = headerDepth - 1; h >= 0; h--) {
                    const v = normalize((headerLayers[h] && headerLayers[h][col]) || "");
                    if (v) return v;
                }
                return finalHeader[col] || `col_${col + 1}`;
            };

            const rangeForRow =
                (data: string[]) =>
                    (start: string, end: string, includeEmpty = false) => {
                        const s = excelToIndex(start);
                        const e = excelToIndex(end);
                        const obj: Record<string, string> = {};
                        for (let c = s; c <= e; c++) {
                            const k = lowestHeaderAt(c);
                            const v = normalize(data[c] || "");
                            // Debug columns 20-21 (U-V)
                            if (c === 20 || c === 21) {
                                console.log(`📍 Col ${c}: raw="${data[c]}", normalized="${v}", header="${k}"`);
                            }
                            if (k && (includeEmpty || v !== "")) setSmart(obj, k, v);
                        }
                        return obj;
                    };

            const buildStructuredForRow = (data: string[]) => {
                const structured: Record<string, Record<string, string>> = {};
                for (const span of spans) {
                    const block: Record<string, string> = {};
                    for (let c = span.start; c <= span.end; c++) {
                        const subKey = lowestHeaderAt(c);
                        const val = normalize(data[c] || "");
                        if (subKey && val !== "") setSmart(block, subKey, val);
                    }
                    if (Object.keys(block).length) structured[span.key] = block;
                }
                return structured;
            };

            const extractTableDataForRow = (data: string[]) => {
                const range = rangeForRow(data);

                const scoreCurrent = range("E", "X");
                const scorePrevious = range("O", "V");
                console.log("[MULTI-ROW DEBUG] scorePrevious:", JSON.stringify(scorePrevious, null, 2));
                console.log("[MULTI-ROW DEBUG] scorecurrent:", JSON.stringify(scoreCurrent, null, 2));

                const radarChartCurrent = range("Y", "AB");
                const radarChartPrevious = range("AC", "AF");

                const careScoreCurrent = range("AG", "BF");
                const careScorePrevious = range("DG", "EF");

                const careEvalGraphCurrent = range("BG", "CF");
                const careEvalGraphPrevious = range("EG", "FF");

                const rawCareComparisonAverage = range("CG", "DF", true);
                const rawCareComparisonFinal = range("FG", "GF", true);
                const careComparisonAverage = sanitizeTrendBlock(rawCareComparisonAverage);
                const careComparisonFinal = sanitizeTrendBlock(rawCareComparisonFinal);

                const careRadarChartCurrent = range("GG", "GJ");
                const careRadarChartPrevious = range("GK", "GN");

                const oneColorScoreCurrent = range("GO", "IA");
                const oneColorScoreFinal = range("LB", "MN");

                const oneColorEvalGraphCurrent = range("IB", "JN");
                const oneColorEvalGraphFinal = range("MO", "OA");

                const oneColorComparisonAverage = range("JO", "LA");
                const oneColorComparisonPrevious = range("OB", "PN");

                const oneColorRadarChartCurrent = range("PO", "PR");
                const oneColorRadarChartPrevious = range("PS", "PV");

                const timeBothHandCurrent = range("PW", "QN");
                const timeBothHandFinal = range("RE", "RT");

                const timeEvalGraphCurrent = range("QO", "QV");
                const timeEvalGraphFinal = range("RU", "SB");

                const rawTimeComparisonAverage = range("QW", "RD", true);
                const rawTimeComparisonPrevious = range("SC", "SJ", true);
                const timeComparisonAverage = sanitizeTrendBlock(rawTimeComparisonAverage);
                const timeComparisonPrevious = sanitizeTrendBlock(rawTimeComparisonPrevious);

                const timeRadarChartCurrent = range("SK", "SP");
                const timeRadarChartFinal = range("SQ", "SV");

                const comparisonFinal = range("SW", "SZ");
                const comparisonAverage = range("TA", "TE");

                return {
                    score: { current: scoreCurrent, previous: scorePrevious },
                    radar_chart: { current: radarChartCurrent, previous: radarChartPrevious },
                    care_score: { current: careScoreCurrent, previous: careScorePrevious },
                    care_evaluation_graph: { current: careEvalGraphCurrent, previous: careEvalGraphPrevious },
                    care_comparison: { average: careComparisonAverage, final: careComparisonFinal },
                    care_radar_chart: { current: careRadarChartCurrent, previous: careRadarChartPrevious },
                    one_color_score: { current: oneColorScoreCurrent, final: oneColorScoreFinal },
                    one_color_evaluation_graph: { current: oneColorEvalGraphCurrent, final: oneColorEvalGraphFinal },
                    one_color_comparison: { average: oneColorComparisonAverage, previous: oneColorComparisonPrevious },
                    one_color_radar_chart: { current: oneColorRadarChartCurrent, previous: oneColorRadarChartPrevious },
                    time_both_hand: { current: timeBothHandCurrent, final: timeBothHandFinal },
                    time_evaluation_graph: { current: timeEvalGraphCurrent, final: timeEvalGraphFinal },
                    time_lapse_comparison: { average: timeComparisonAverage, previous: timeComparisonPrevious },
                    time_radar_chart: { current: timeRadarChartCurrent, final: timeRadarChartFinal },
                    comparison: { final: comparisonFinal, average: comparisonAverage },
                };
            };

            const buildCustomerMergedForRow = (data: string[]) => {
                const range = rangeForRow(data);
                const customerInfoBasic = range("A", "D");
                const customerInfoDemo = range("TE", "TP");
                return { ...customerInfoBasic, ...customerInfoDemo };
            };

            const findByIncludes = (obj: Record<string, string>, needle: string) => {
                const k = Object.keys(obj).find((k) => k.includes(needle));
                return k ? obj[k] : "";
            };

            const synthesizePrevFromStructured = (groups: Record<string, Record<string, string>>) => {
                const gKey =
                    Object.keys(groups).find((k) => k.includes("前回") && k.includes("スコア")) ||
                    Object.keys(groups).find((k) => k.includes("全国平均") && k.includes("スコア")) ||
                    Object.keys(groups).find((k) => k.includes("前回")) ||
                    Object.keys(groups).find((k) => k.includes("全国平均"));

                const g = gKey ? groups[gKey] : undefined;
                const pick = (...candidates: string[]) => {
                    if (!g) return "";
                    for (const c of candidates) {
                        const v = (g as any)[c];
                        if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
                    }
                    return "";
                };

                const out: Record<string, string> = {};
                out["総合 スコア"] = pick("総合 スコア", "総合スコア", "総合", "総合点", "合計");
                out["ケア スコア"] = pick("ケア スコア", "ケア");
                out["ワンカラー スコア"] = pick("ワンカラー スコア", "ワンカラー", "ワン カラー");
                out["タイム スコア"] = pick("タイム スコア", "タイム");
                out["総合評価"] = pick("総合評価", "総合 ランク", "総合 評価");
                out["ケア評価"] = pick("ケア評価", "ケア 評価");
                out["ワンカラー評価"] = pick("ワンカラー評価", "ワンカラー 評価");
                out["タイム評価"] = pick("タイム評価", "タイム 評価");
                out["総合計タイム"] = pick("総合計タイム", "両手総合計", "両手総合計タイム", "タイム合計");

                Object.keys(out).forEach((k) => {
                    if (!out[k]) delete out[k];
                });
                return out;
            };

            const buildTimeText = (mm: number, ss: number) => `${mm}分${String(ss).padStart(2, "0")}秒`;

            const rowsToProcess = dataRows.slice(0, 500);
            let processed = 0;

            for (const data of rowsToProcess) {
                console.log("🚀 Processing row, data length:", data.length);
                const structured = buildStructuredForRow(data);
                const tableData = extractTableDataForRow(data);
                console.log("🚀 tableData.score.current:", tableData.score.current);
                const mergedCustomerInfo = buildCustomerMergedForRow(data);

                const rawCustomer = {
                    external_id: findByIncludes(mergedCustomerInfo, "ID") || findByIncludes(mergedCustomerInfo, "Id"),
                    name: findByIncludes(mergedCustomerInfo, "名前"),
                    issuer: findByIncludes(mergedCustomerInfo, "発行元"),
                    assessment_date: findByIncludes(mergedCustomerInfo, "採点日"),
                    email: findByIncludes(mergedCustomerInfo, "メール"),
                    prefecture: findByIncludes(mergedCustomerInfo, "都道府県"),
                    age: findByIncludes(mergedCustomerInfo, "年齢"),
                    nailist_experience: findByIncludes(mergedCustomerInfo, "ネイリスト歴"),
                    occupation_type: findByIncludes(mergedCustomerInfo, "職業"),
                    current_monthly_customers: findByIncludes(mergedCustomerInfo, "月平均施術人数"),
                    salon_work_experience: findByIncludes(mergedCustomerInfo, "サロン勤務歴"),
                    salon_monthly_customers: findByIncludes(mergedCustomerInfo, "サロン勤務時の月平均"),
                    blank_period: findByIncludes(mergedCustomerInfo, "ブランク"),
                    status: findByIncludes(mergedCustomerInfo, "ステータス"),
                    application_date: findByIncludes(mergedCustomerInfo, "申し込み日"),
                };
                if (!rawCustomer.external_id || !/^\d{3,}$/.test(String(rawCustomer.external_id).trim())) {
                    console.warn("Skipping non-data row (invalid external_id):", mergedCustomerInfo);
                    continue;
                }

                const parsedAssessmentDate = ensureISODate(rawCustomer.assessment_date);

                const custPayload = {
                    external_id: rawCustomer.external_id,
                    name: rawCustomer.name,
                    issuer: rawCustomer.issuer,
                    email: rawCustomer.email,
                    prefecture: rawCustomer.prefecture,
                    age: toInt(rawCustomer.age),
                    nailist_experience: rawCustomer.nailist_experience,
                    occupation_type: rawCustomer.occupation_type,
                    current_monthly_customers: toInt(rawCustomer.current_monthly_customers),
                    salon_work_experience: rawCustomer.salon_work_experience,
                    salon_monthly_customers: toInt(rawCustomer.salon_monthly_customers),
                    blank_period: rawCustomer.blank_period,
                    status: mapStatus(rawCustomer.status),
                    application_date: parsedAssessmentDate,
                };

                const { data: customer, error: customerError } = await supabase
                    .from("customers")
                    .upsert(custPayload, { onConflict: "external_id" })
                    .select("id")
                    .single();
                if (customerError) throw customerError;
                if (!customer?.id) throw new Error("Customer upsert failed.");
                const customerId = customer.id;

                // Choose currentGroup
                let currentGroup: Record<string, string> | undefined =
                    Object.entries(structured).find(([k]) => k.includes("今回") && k.includes("スコア"))?.[1];
                if (!currentGroup) {
                    currentGroup = Object.entries(structured).find(([k]) => k.includes("スコア"))?.[1];
                }
                currentGroup = currentGroup || {};

                // Resolve time - prefer tableData.score.current which has merged time values
                const scoreCurrentTime = tableData.score.current?.["総合計タイム"] || currentGroup["総合計タイム"];
                let curMM = toInt(extractMinutes(scoreCurrentTime));
                let curSS = toInt(extractSeconds(scoreCurrentTime));
                if (curSS === 0) {
                    const d1 = (tableData?.time_both_hand?.current ?? {}) as Record<string, any>;
                    const d2 = (tableData?.time_evaluation_graph?.current ?? {}) as Record<string, any>;
                    const r1 = (() => {
                        let mm = 0, ss = 0;
                        for (const [k, v] of Object.entries(d1)) {
                            if (k.includes("分") && !k.includes("秒")) mm = mm || toInt(v);
                            else if (k.includes("秒")) ss = ss || toInt(v);
                        }
                        return { mm, ss };
                    })();
                    const r2 = (() => {
                        let mm = 0, ss = 0;
                        for (const [k, v] of Object.entries(d2)) {
                            if (k.includes("分") && !k.includes("秒")) mm = mm || toInt(v);
                            else if (k.includes("秒")) ss = ss || toInt(v);
                        }
                        return { mm, ss };
                    })();
                    if (curMM === 0) curMM = r1.mm || r2.mm || 0;
                    if (curSS === 0) curSS = r1.ss || r2.ss || 0;
                }
                const careDetails = Object.entries(structured).find(([k]) => k.includes("ケア"))?.[1] || {};
                const oneColorDetails = Object.entries(structured).find(([k]) => k.includes("ワンカラー"))?.[1] || {};
                const timeDetails = Object.entries(structured).find(([k]) => k.includes("タイム"))?.[1] || {};

                const assessmentData = {
                    customer_id: customerId,
                    assessment_date: parsedAssessmentDate,
                    care_score: toInt(currentGroup["ケア スコア"] || currentGroup["ケアスコア"] || currentGroup["ケア"]),
                    care_rating: currentGroup["ケア評価"] || currentGroup["ケア 評価"] || currentGroup["ケアランク"] || "",
                    one_color_score: toInt(currentGroup["ワンカラー スコア"] || currentGroup["ワンカラースコア"] || currentGroup["ワンカラー"]),
                    one_color_rating: currentGroup["ワンカラー評価"] || currentGroup["ワンカラー 評価"] || currentGroup["ワンカラーランク"] || "",
                    time_score: toInt(currentGroup["タイム スコア"] || currentGroup["タイムスコア"] || currentGroup["タイム"]),
                    time_rating: currentGroup["タイム評価"] || currentGroup["タイム 評価"] || currentGroup["タイムランク"] || "",
                    total_score: toInt(currentGroup["総合 スコア"] || currentGroup["総合スコア"] || currentGroup["総合"]),
                    total_rating: currentGroup["総合評価"] || currentGroup["総合 評価"] || currentGroup["総合ランク"] || "",
                    total_time_minutes: curMM,
                    total_time_seconds: curSS,
                    care_details: careDetails,
                    one_color_details: oneColorDetails,
                    time_details: timeDetails,
                    is_current: true,
                    source: "csv_import",
                };


                const { data: a, error: assessError } = await supabase
                    .from("assessments")
                    .insert(assessmentData)
                    .select("id")
                    .single();
                if (assessError) throw assessError;
                const assessmentId = a.id;
                {
                    const scoreCurRow = (tableData?.score?.current ?? {}) as Record<string, any>;
                    const pickRow = (...keys: string[]) => {
                        for (const k of keys) {
                            const v = scoreCurRow[k];
                            if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
                        }
                        return "";
                    };
                    const toNumRow = (s: string) => toInt(s);
                    const rTot = pickRow("総合 スコア", "総合スコア", "総合");
                    const rCare = pickRow("ケア スコア", "ケア");
                    const rOne = pickRow("ワンカラー スコア", "ワンカラー", "ワン カラー");
                    const rTime = pickRow("タイム スコア", "タイム");
                    const rrTot = pickRow("総合評価", "総合 評価");
                    const rrCare = pickRow("ケア評価", "ケア 評価");
                    const rrOne = pickRow("ワンカラー評価", "ワンカラー 評価");
                    const rrTime = pickRow("タイム評価", "タイム 評価");
                    if (rTot) assessmentData.total_score = toNumRow(rTot);
                    if (rCare) assessmentData.care_score = toNumRow(rCare);
                    if (rOne) assessmentData.one_color_score = toNumRow(rOne);
                    if (rTime) assessmentData.time_score = toNumRow(rTime);
                    if (rrTot) assessmentData.total_rating = rrTot;
                    if (rrCare) assessmentData.care_rating = rrCare;
                    if (rrOne) assessmentData.one_color_rating = rrOne;
                    if (rrTime) assessmentData.time_rating = rrTime;
                }

                const insertLeaves = async (
                    details: Record<string, any>,
                    category: "care" | "one_color" | "time"
                ) => {
                    const entries = Object.entries(details);
                    if (!entries.length) return;
                    const sanitizeLeafRow = (sub: string, val: any) => {
                        const sub_item = String(sub || "").trim().slice(0, 120);
                        let score = 0;
                        let rating: string | null = null;
                        let comment: string | null = null;
                        if (val && typeof val === "object") {
                            score = toInt((val as any).score);
                            rating = (val as any).rating != null ? String((val as any).rating).slice(0, 30) : null;
                            comment = (val as any).comment != null ? String((val as any).comment).slice(0, 200) : null;
                        } else {
                            score = toInt(val);
                        }
                        return { sub_item, score, rating, comment };
                    };
                    const payload = entries.map(([sub, val]) => {
                        const leaf = sanitizeLeafRow(sub, val);
                        return {
                            assessment_id: assessmentId,
                            category,
                            sub_item: leaf.sub_item,
                            score: leaf.score,
                            rating: leaf.rating,
                            comment: leaf.comment,
                        };
                    });
                    if (payload.length) {
                        const candidates = ["sub_item", "item", "subitem", "label", "name"];
                        let lastError: any = null;
                        for (const col of candidates) {
                            const shaped = payload.map(row => ({
                                assessment_id: row.assessment_id,
                                category: row.category,
                                [col]: row.sub_item,
                                score: row.score,
                                rating: row.rating,
                                comment: row.comment,
                            })) as any;
                            const { error } = await supabase.from("scores").insert(shaped);
                            if (!error) { lastError = null; break; }
                            lastError = error;
                        }
                        if (lastError) console.warn("scores insert warn (fallbacks exhausted):", lastError, payload.slice(0, 3));
                    }
                };
                await insertLeaves(assessmentData.care_details, "care");
                await insertLeaves(assessmentData.one_color_details, "one_color");
                await insertLeaves(assessmentData.time_details, "time");

                const { error: ciErr } = await supabase.from("section_blobs").insert({
                    customer_id: customerId, assessment_id: assessmentId, section: "customer_information",
                    subtype: "merged",
                    data: mergedCustomerInfo,
                    source: "csv_import",
                });
                if (ciErr) console.warn("section_blobs insert warn:", ciErr);

                const scoreCurrentWithTime: Record<string, any> = { ...(tableData.score.current || {}) };
                const timeKeyCurr = Object.keys(scoreCurrentWithTime).find(k =>
                    k.includes("タイム") && (k.includes("総合") || k.includes("合計") || k.includes("両手"))
                ) || "総合計タイム";

                let rawTimeCurr = scoreCurrentWithTime[timeKeyCurr] || "";
                let blobCurMM = toInt(extractMinutes(rawTimeCurr));
                let blobCurSS = toInt(extractSeconds(rawTimeCurr));
                const dScore = deriveTimeFromMap(scoreCurrentWithTime);
                blobCurMM = blobCurMM || dScore.mm || 0;
                blobCurSS = blobCurSS || dScore.ss || 0;

                if (blobCurMM === 0 && blobCurSS === 0) {
                    const d1 = (tableData?.time_both_hand?.current ?? {}) as Record<string, any>;
                    const d2 = (tableData?.time_evaluation_graph?.current ?? {}) as Record<string, any>;
                    const r1 = (() => {
                        let mm = 0, ss = 0;
                        for (const [k, v] of Object.entries(d1)) {
                            if (k.includes("分") && !k.includes("秒")) mm = mm || toInt(v);
                            else if (k.includes("秒")) ss = ss || toInt(v);
                        }
                        return { mm, ss };
                    })();
                    const r2 = (() => {
                        let mm = 0, ss = 0;
                        for (const [k, v] of Object.entries(d2)) {
                            if (k.includes("分") && !k.includes("秒")) mm = mm || toInt(v);
                            else if (k.includes("秒")) ss = ss || toInt(v);
                        }
                        return { mm, ss };
                    })();
                    if (blobCurMM === 0) blobCurMM = r1.mm || r2.mm || 0;
                    if (blobCurSS === 0) blobCurSS = r1.ss || r2.ss || 0;
                }

                const finalCurMM = curMM || blobCurMM;
                const finalCurSS = curSS || blobCurSS;
                scoreCurrentWithTime["総合計タイム"] = buildTimeText(finalCurMM, finalCurSS);
                if (Object.keys(scoreCurrentWithTime).length > 0) {
                    const { error } = await supabase.from("section_blobs").insert({
                        customer_id: customerId, assessment_id: assessmentId, section: "score",
                        subtype: "current",
                        data: scoreCurrentWithTime,
                        source: "csv_import",
                    });
                    if (error) console.warn("score current insert warn:", error);
                }

                const prevSynth = synthesizePrevFromStructured(structured);
                const scorePrevMerged: Record<string, any> = {
                    ...(tableData.score.previous || {}),
                    ...(prevSynth || {}),
                };
                const timeKeyPrev = Object.keys(scorePrevMerged).find(k =>
                    k.includes("タイム") && (k.includes("総合") || k.includes("合計") || k.includes("両手"))
                ) || "総合計タイム";
                let rawTimePrev = scorePrevMerged[timeKeyPrev] || "";
                let blobPrevMM = toInt(extractMinutes(rawTimePrev));
                let blobPrevSS = toInt(extractSeconds(rawTimePrev));

                // Always derive from score.previous keys that include 分/秒
                const dScorePrev = deriveTimeFromMap(scorePrevMerged);
                blobPrevMM = blobPrevMM || dScorePrev.mm || 0;
                blobPrevSS = blobPrevSS || dScorePrev.ss || 0;

                if (blobPrevMM === 0 && blobPrevSS === 0) {
                    const d1 = (tableData as any)?.time_lapse_comparison?.average ?? {};
                    const d2 = (tableData as any)?.time_both_hand?.final ?? {};
                    const d3 = (tableData as any)?.time_evaluation_graph?.final ?? {};
                    const pick = (obj: Record<string, any>) => {
                        let mm = 0, ss = 0;
                        for (const [k, v] of Object.entries(obj)) {
                            if (k.includes("分") && !k.includes("秒")) mm = mm || toInt(v);
                            else if (k.includes("秒")) ss = ss || toInt(v);
                        }
                        return { mm, ss };
                    };
                    const r1 = pick(d1), r2 = pick(d2), r3 = pick(d3);
                    blobPrevMM = r1.mm || r2.mm || r3.mm || 0;
                    blobPrevSS = r1.ss || r2.ss || r3.ss || 0;
                }

                scorePrevMerged["総合計タイム"] = buildTimeText(blobPrevMM, blobPrevSS);
                if (Object.keys(scorePrevMerged).length > 0) {
                    const { error } = await supabase.from("section_blobs").insert({
                        customer_id: customerId, assessment_id: assessmentId, section: "score",
                        subtype: "previous",
                        data: scorePrevMerged,
                        source: "csv_import",
                    });
                    if (error) console.warn("score previous insert warn:", error);
                }


                const persist = async (section: string, subtype: string, data: Record<string, string>) => {
                    if (data && Object.keys(data).length > 0) {
                        const { error } = await supabase.from("section_blobs").insert({
                            customer_id: customerId, assessment_id: assessmentId, section,
                            subtype, data, source: "csv_import",
                        });
                        if (error) console.warn(`${section} ${subtype} insert warn:`, error);
                    }
                };

                await persist("radar_chart", "current", tableData.radar_chart.current);
                await persist("radar_chart", "previous", tableData.radar_chart.previous);

                await persist("care_score", "current", tableData.care_score.current);
                await persist("care_score", "previous", tableData.care_score.previous);

                await persist("care_evaluation_graph", "current", tableData.care_evaluation_graph.current);
                await persist("care_evaluation_graph", "previous", tableData.care_evaluation_graph.previous);

                await persist("care_comparison", "average", tableData.care_comparison.average);
                await persist("care_comparison", "final", tableData.care_comparison.final);

                await persist("care_radar_chart", "current", tableData.care_radar_chart.current);
                await persist("care_radar_chart", "previous", tableData.care_radar_chart.previous);

                await persist("one_color_score", "current", tableData.one_color_score.current);
                await persist("one_color_score", "final", tableData.one_color_score.final);

                await persist("one_color_evaluation_graph", "current", tableData.one_color_evaluation_graph.current);
                await persist("one_color_evaluation_graph", "final", tableData.one_color_evaluation_graph.final);

                await persist("one_color_comparison", "average", tableData.one_color_comparison.average);
                await persist("one_color_comparison", "previous", tableData.one_color_comparison.previous);

                await persist("one_color_radar_chart", "current", tableData.one_color_radar_chart.current);
                await persist("one_color_radar_chart", "previous", tableData.one_color_radar_chart.previous);

                await persist("time_both_hand", "current", tableData.time_both_hand.current);
                await persist("time_both_hand", "final", tableData.time_both_hand.final);

                await persist("time_evaluation_graph", "current", tableData.time_evaluation_graph.current);
                await persist("time_evaluation_graph", "final", tableData.time_evaluation_graph.final);

                await persist("time_lapse_comparison", "average", tableData.time_lapse_comparison.average);
                await persist("time_lapse_comparison", "previous", tableData.time_lapse_comparison.previous);

                await persist("time_radar_chart", "current", tableData.time_radar_chart.current);
                await persist("time_radar_chart", "final", tableData.time_radar_chart.final);

                await persist("comparison", "final", tableData.comparison.final);
                await persist("comparison", "average", tableData.comparison.average);
                processed += 1;
                setProgress(Math.min(95, Math.round((processed / rowsToProcess.length) * 90) + 5));
            }
            setProgress(100);
            setCompleted(true);
            toast({
                title: "インポート完了",
                description: `${processed} 件のデータを登録しました。`,
            });
            setTimeout(() => navigate("/customers"), 900);
        } catch (err: any) {
            console.error(err);
            toast({
                title: "エラー",
                description: err.message || "ファイルの解析または登録中に問題が発生しました。",
                variant: "destructive",
            });
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="flex min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
            <Sidebar />
            <div className="flex-1 p-4 sm:p-8 lg:p-10">
                <Button
                    variant="ghost"
                    onClick={() => navigate("/customers")}
                    className="mb-4 sm:mb-6"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    戻る
                </Button>

                <Card className="shadow-xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl font-semibold">
                            <FileUp className="w-5 h-5 sm:w-6 sm:h-6 text-secondary" />
                            CSVファイルのインポート
                        </CardTitle>
                        <CardDescription>
                            顧客データと評価データを含むCSVファイルを選択してください。
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-6">
                        {/* File Input */}
                        <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 sm:p-10 bg-white hover:border-secondary transition">
                            <Input
                                type="file"
                                accept=".csv"
                                onChange={handleFileChange}
                                disabled={uploading}
                                className="cursor-pointer w-full sm:w-auto"
                            />
                            {file && (
                                <p className="mt-3 text-sm text-muted-foreground text-center break-all">
                                    選択ファイル: <strong>{file.name}</strong>
                                </p>
                            )}
                        </div>

                        {/* Preview Section */}
                        {preview.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="bg-gray-50 p-4 rounded-lg border"
                            >
                                <p className="font-semibold mb-2 text-sm">プレビュー (上位5件)</p>
                                <div className="overflow-auto">
                                    <table className="w-full border text-xs">
                                        <thead className="bg-gray-100">
                                            <tr>
                                                <th className="p-1 border text-left">キー</th>
                                                <th className="p-1 border text-left">値</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {preview.map((r, i) => (
                                                <tr key={i} className="align-top">
                                                    <td className="border p-1 whitespace-pre-wrap break-words">
                                                        {r.key}
                                                    </td>
                                                    <td className="border p-1 whitespace-pre-wrap break-words">
                                                        {r.value}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </motion.div>
                        )}

                        {/* Upload Progress */}
                        {uploading && (
                            <div>
                                <Progress value={progress} className="w-full" />
                                <p className="text-sm mt-2 text-center text-muted-foreground">
                                    {progress < 100 ? "アップロード中..." : "完了！"}
                                </p>
                            </div>
                        )}

                        {completed ? (
                            <div className="flex flex-col items-center justify-center space-y-2 text-green-600">
                                <CheckCircle2 className="w-7 h-7 sm:w-8 sm:h-8" />
                                <p>CSVのインポートが完了しました！</p>
                            </div>
                        ) : (
                            <Button
                                onClick={handleUploadMulti}
                                disabled={!file || uploading}
                                className="w-full bg-secondary hover:bg-secondary/90"
                            >
                                {uploading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        アップロード中...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-4 h-4 mr-2" />
                                        アップロード
                                    </>
                                )}
                            </Button>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default ImportCSV;