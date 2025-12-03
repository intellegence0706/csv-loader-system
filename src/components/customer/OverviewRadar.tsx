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
    Previous: number;
    Current: number;
};

type OverviewRadarProps = {
    radarRows: RadarDatum[];
    structuredData: StructuredRow[];
};

const formatScore = (score?: number | null) => (typeof score === "number" ? score.toLocaleString() : "—");

export default function OverviewRadar({ radarRows, structuredData }: OverviewRadarProps) {
    return (
        <div id="overview-radar-chart" className="mt-6 rounded-md border border-slate-200 overflow-hidden bg-white">
            <div className="h-2 w-full bg-gradient-to-r from-[#e87674] via-white to-[#54b4bd]" />
            <div className="px-4 pt-3 pb-2 text-sm font-medium text-gray-700">グラフの名前</div>

            <div className="mb-3 flex justify-end gap-4 px-4 text-[11px] text-slate-600">
                <span className="flex items-center gap-2">
                    <span className="h-2.5 w-8 rounded-full shadow-sm" style={{ backgroundColor: "#64CBD3" }} />
                    全国平均
                </span>
                <span className="flex items-center gap-2">
                    <span className="h-2.5 w-8 rounded-full shadow-sm" style={{ backgroundColor: "#4075B5" }} />
                    前回
                </span>
                <span className="flex items-center gap-2">
                    <span className="h-2.5 w-8 rounded-full shadow-sm" style={{ backgroundColor: "#FF6B6B" }} />
                    今回
                </span>
            </div>

            <div className="relative h-[600px] w-full pb-16">
                <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarRows} startAngle={90} endAngle={-270} margin={{ top: 24, right: 24, bottom: 24, left: 24 }}>
                        <PolarGrid gridType="polygon" radialLines polarRadius={[20, 40, 60, 80, 100, 120, 140, 160, 180, 200]} stroke="#d0d0d0" strokeOpacity={1} />
                        <PolarAngleAxis dataKey="name" tick={false} />
                        <PolarRadiusAxis angle={90} domain={[0, 100]} tickCount={10} tick={false} axisLine={false} />

                        {/* <Radar
                            name="全国平均"
                            dataKey="National Average"
                            stroke="#64CBD3"
                            strokeWidth={2}
                            fill="#64CBD3"
                            fillOpacity={0}
                            dot={{ r: 2, fill: "#64CBD3", stroke: "#64CBD3", strokeWidth: 2 }}
                        /> */}

                        <Radar
                            name="前回"
                            dataKey="Previous"
                            stroke="#4075B5"
                            strokeWidth={2}
                            fill="#4075B5"
                            fillOpacity={0.15}
                            dot={{ r: 2, fill: "#4075B5", stroke: "#4075B5", strokeWidth: 2 }}
                        />

                        <Radar
                            name="今回"
                            dataKey="Current"
                            stroke="#FF6B6B"
                            strokeWidth={2}
                            fill="#FF6B6B"
                            fillOpacity={0.15}
                            dot={{ r: 2, fill: "#FF6B6B", stroke: "#FF6B6B", strokeWidth: 2 }}
                        />
                    </RadarChart>
                </ResponsiveContainer>

                <div className="pointer-events-none absolute inset-0">
                    <div className="absolute top-[5%] left-1/2 -translate-x-1/2 text-center">
                        <div className="text-[#00bcd4] text-sm font-medium">総合</div>
                        {/* <div className="mt-0.5 text-[11px] text-[#00bcd4]">1320</div> */}
                    </div>
                    <div className="absolute left-[70%] top-[45%] -translate-y-1/2 text-center">
                        <div className="text-[#00bcd4] text-sm font-medium">ケア</div>
                        {/* <div className="mt-0.5 text-[11px] text-[#00bcd4]">410</div> */}
                    </div>
                    <div className="absolute top-[79%] left-1/2 -translate-x-1/2 text-center">
                        {/* <div className="mt-0.5 text-[11px] text-[#00bcd4]">610</div> */}
                        <div className=" text-[#00bcd4] text-sm font-medium">ワンカラー</div>
                    </div>
                    <div className="absolute left-[26%] top-[45%] -translate-y-1/2 text-center">
                        <div className="text-[#00bcd4] text-sm font-medium">タイム</div>
                        {/* <div className="mt-0.5 text-[11px]  text-[#00bcd4]">300</div> */}
                    </div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[10%]">100</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[13.5%]">90</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[17.5%]">80</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[21.5%]">70</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[25%]">60</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[28.5%]">50</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[32%]">40</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[35%]">30</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[38.5%]">20</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[41.5%]">10</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">0</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[47.5%]">10</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[50.5%]">20</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[53.5%]">30</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[57.5%]">40</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[60.5%]">50</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[63.5%]">60</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[67.5%]">70</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[70.5%]">80</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[74%]">90</div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[7px] text-gray-500 top-[77.5%]">100</div>
                    <div className="absolute left-[31%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">100</div>
                    <div className="absolute left-[33%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">90</div>
                    <div className="absolute left-[35%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">80</div>
                    <div className="absolute left-[37%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">70</div>
                    <div className="absolute left-[38.5%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">60</div>
                    <div className="absolute left-[40.5%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">50</div>
                    <div className="absolute left-[42.5%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">40</div>
                    <div className="absolute left-[44.5%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">30</div>
                    <div className="absolute left-[46%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">20</div>
                    <div className="absolute left-[48%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">10</div>
                    <div className="absolute left-[52%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">10</div>
                    <div className="absolute left-[54%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">20</div>
                    <div className="absolute left-[55.5%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">30</div>
                    <div className="absolute left-[57.5%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">40</div>
                    <div className="absolute left-[59.5%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">50</div>
                    <div className="absolute left-[61.5%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">60</div>
                    <div className="absolute left-[63.5%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">70</div>
                    <div className="absolute left-[65.5%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">80</div>
                    <div className="absolute left-[67%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">90</div>
                    <div className="absolute left-[69%] -translate-x-1/2 text-[7px] text-gray-500 top-[44.5%]">100</div>
                </div>
            </div>
        </div>
    );
}

