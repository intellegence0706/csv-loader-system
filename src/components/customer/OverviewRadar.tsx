import {
    Legend,
    PolarAngleAxis,
    PolarGrid,
    PolarRadiusAxis,
    Radar,
    RadarChart,
    ResponsiveContainer,
} from "recharts";

type StructuredRow = {
    key: string;
    denom: number;
    avg: { score?: number | null };
    prev: { score?: number | null };
    curr: { score?: number | null };
};

type RadarDatum = {
    name: string;
    "National Average": number;
    "This Time": number;
};

type OverviewRadarProps = {
    radarRows: RadarDatum[];
    structuredData: StructuredRow[];
};

const formatScore = (score?: number | null) => (typeof score === "number" ? score.toLocaleString() : "—");

export default function OverviewRadar({ radarRows, structuredData }: OverviewRadarProps) {
    return (
        <div className="mt-6 rounded-md border border-slate-200 overflow-hidden bg-white">
            <div className="h-2 w-full bg-gradient-to-r from-[#e87674] via-white to-[#54b4bd]" />
            <div className="px-4 pt-3 pb-2 text-sm font-medium text-gray-700">グラフの名前</div>

            <div className="relative h-[600px] w-full pb-16">
                <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarRows} startAngle={90} endAngle={-270} margin={{ top: 80, right: 80, bottom: 80, left: 80 }}>
                        <PolarGrid gridType="polygon" radialLines polarRadius={[40, 80, 120, 160, 200]} stroke="#d0d0d0" strokeOpacity={1} />
                        <PolarAngleAxis dataKey="name" tick={false} />
                        <PolarRadiusAxis angle={90} domain={[0, 100]} tickCount={5} tick={false} axisLine={false} />

                        <Radar
                            name="全国平均"
                            dataKey="National Average"
                            stroke="#00bcd4"
                            strokeWidth={2}
                            fill="#00bcd4"
                            fillOpacity={0}
                            dot={{ r: 2, fill: "#00bcd4", stroke: "#00bcd4", strokeWidth: 2 }}
                        />

                        <Radar
                            name="今回"
                            dataKey="This Time"
                            stroke="#ff5252"
                            strokeWidth={2}
                            fill="#ff5252"
                            fillOpacity={0.15}
                            dot={{ r: 2, fill: "#ff5252", stroke: "#ff5252", strokeWidth: 2 }}
                        />

                        <Legend
                            verticalAlign="top"
                            align="right"
                            wrapperStyle={{ right: 24, top: 12 }}
                            iconType="line"
                            formatter={(value) => {
                                const mapping: Record<string, string> = {
                                    "National Average": "全国平均",
                                    "This Time": "今回",
                                };
                                return mapping[value] || value;
                            }}
                        />
                    </RadarChart>
                </ResponsiveContainer>

                <div className="pointer-events-none absolute inset-0">
                    <div className="absolute top-[5%] left-1/2 -translate-x-1/2 text-center">
                        <div className="text-[#00bcd4] text-sm font-medium">総合</div>
                        <div className="mt-0.5 text-[11px] text-[#00bcd4]">1320</div>
                    </div>
                    <div className="absolute left-[69%] top-[45%] -translate-y-1/2 text-center">
                        <div className="text-[#00bcd4] text-sm font-medium">ケア</div>
                        <div className="mt-0.5 text-[11px] text-[#00bcd4]">410</div>
                    </div>
                    <div className="absolute top-[78%] left-1/2 -translate-x-1/2 text-center">
                        <div className="mt-0.5 text-[11px] text-[#00bcd4]">610</div>
                        <div className=" text-[#00bcd4] text-sm font-medium">ワンカラー</div>
                    </div>
                    <div className="absolute left-[27%] top-[45%] -translate-y-1/2 text-center">
                        <div className="text-[#00bcd4] text-sm font-medium">タイム</div>
                        <div className="mt-0.5 text-[11px]  text-[#00bcd4]">300</div>
                    </div>
                    {/* <div className="absolute left-1/2 -translate-x-1/2 text-[10px] text-gray-500 top-[14%]">1320</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[10px] text-gray-500 top-[24%]">1056</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[10px] text-gray-500 top-[30%]">792</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[10px] text-gray-500 top-[37%]">528</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[10px] text-gray-500 top-[44%]">264</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[10px] text-gray-500 top-[49%]">0</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[10px] text-gray-500 top-[56%]">122</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[10px] text-gray-500 top-[62%]">244</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[10px] text-gray-500 top-[68%]">366</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[10px] text-gray-500 top-[76%]">488</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[10px] text-gray-500 top-[84%]">610</div>
                    <div className="absolute top-[50.5%] -translate-y-1/2 text-[10px] text-gray-500 left-[35%]">93分</div>
                    <div className="absolute top-[50.5%] -translate-y-1/2 text-[10px] text-gray-500 left-[38%]">105分</div>
                    <div className="absolute top-[50.5%] -translate-y-1/2 text-[10px] text-gray-500 left-[42%]">117分</div>
                    <div className="absolute top-[50.5%] -translate-y-1/2 text-[10px] text-gray-500 left-[46%]">130分</div>
                    <div className="absolute top-[50.5%] -translate-y-1/2 text-[10px] text-gray-500 left-[52.5%]">82</div>
                    <div className="absolute top-[50.5%] -translate-y-1/2 text-[10px] text-gray-500 left-[56%]">164</div>
                    <div className="absolute top-[50.5%] -translate-y-1/2 text-[10px] text-gray-500 left-[61%]">246</div>
                    <div className="absolute top-[50.5%] -translate-y-1/2 text-[10px] text-gray-500 left-[65%]">328</div> */}
                </div>

                <div className="pointer-events-none absolute inset-x-6 bottom-2">
                    <div className="rounded-lg border border-slate-200 bg-white/85 px-3 py-2 text-[11px] text-slate-600 backdrop-blur">
                        {structuredData.map((row) => (
                            <div key={row.key} className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-xs font-semibold text-slate-700">{row.key}</span>
                                <div className="flex flex-wrap items-center gap-3">
                                    <span className="text-[#00bcd4] font-medium">
                                        全国平均: {formatScore(row.avg?.score)} / {row.denom}
                                    </span>
                                    <span className="text-[#4075B5] font-medium">
                                        前回: {formatScore(row.prev?.score)} / {row.denom}
                                    </span>
                                    <span className="text-[#ff5252] font-medium">
                                        今回: {formatScore(row.curr?.score)} / {row.denom}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

