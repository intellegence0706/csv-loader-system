import React from "react";

type EvaluationRankStandardTableProps = {
    containerClassName?: string;
};

const EvaluationRankStandardTable: React.FC<EvaluationRankStandardTableProps> = ({
    containerClassName = "w-full bg-white p-6",
}) => {
    return (
        <div className={containerClassName}>
            <h3 className="text-base font-semibold mb-3 mt-4">評価ランク基準表</h3>
            <div>
                <div>
                    <table className="w-full border border-[#d4d4d4] border-separate border-spacing-0 text-sm text-slate-700">
                        <thead>
                            <tr>
                                <th
                                    rowSpan={2}
                                    className="w-28 bg-[#d8d8d8] border-r border-b border-[#AFAFAF] px-4 py-2 text-bottom font-semibold"
                                >
                                    評価ランク
                                </th>
                                <th className="bg-[#d8d8d8] border-r border-b border-[#AFAFAF] px-4 py-2 text-center font-semibold">
                                    総合
                                </th>
                                <th className="bg-[#d8d8d8] border-r border-b border-[#AFAFAF] px-4 py-2 text-center font-semibold">
                                    ケア
                                </th>
                                <th className="bg-[#d8d8d8] border-r border-b border-[#AFAFAF] px-4 py-2 text-center font-semibold">
                                    ワンカラー
                                </th>
                                <th
                                    colSpan={3}
                                    className="bg-[#d8d8d8] border-r border-b border-[#AFAFAF] px-4 py-2 text-center font-semibold"
                                >
                                    タイム
                                </th>
                            </tr>
                            <tr>
                                <th className="bg-[#F6F6F6] border-r border-b border-[#d4d4d4] px-4 py-1 text-center text-xs">
                                    スコア
                                </th>
                                <th className="bg-[#F6F6F6] border-r border-b border-[#d4d4d4] px-4 py-1 text-center text-xs">
                                    スコア
                                </th>
                                <th className="bg-[#F6F6F6] border-r border-b border-[#d4d4d4] px-4 py-1 text-center text-xs">
                                    スコア
                                </th>
                                <th className="bg-[#F6F6F6] border-r border-b border-[#d4d4d4] px-4 py-1 text-center text-xs">
                                    スコア
                                </th>
                                <th className="bg-[#F6F6F6] border-b border-[#d4d4d4] px-4 py-1 text-center text-xs">
                                    時間
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="border-r bg-[#F6F6F6] border-b text-center border-[#d4d4d4] px-4 py-3 font-semibold">
                                    AAA
                                </td>
                                <td className="border-r border-b border-[#d4d4d4] px-4 py-3 text-center">
                                    1123〜1320
                                </td>
                                <td className="border-r border-b border-[#d4d4d4] px-4 py-3 text-center">
                                    349〜410
                                </td>
                                <td className="border-r border-b border-[#d4d4d4] px-4 py-3 text-center">
                                    519〜610
                                </td>
                                <td className="border-r border-b border-[#d4d4d4] px-4 py-3 text-center">300</td>
                                <td className="border-b border-[#d4d4d4] px-4 py-3 text-right whitespace-nowrap">
                                    〜80分00秒まで
                                </td>
                            </tr>
                            <tr>
                                <td className="border-r bg-[#F6F6F6] border-b text-center border-[#d4d4d4] px-4 py-3 font-semibold">
                                    AA
                                </td>
                                <td className="border-r border-b text-center border-[#d4d4d4] px-4 py-3 text-center">
                                    958〜1122
                                </td>
                                <td className="border-r border-b border-[#d4d4d4] px-4 py-3 text-center">
                                    298〜348
                                </td>
                                <td className="border-r border-b border-[#d4d4d4] px-4 py-3 text-center">
                                    443〜518
                                </td>
                                <td className="border-r border-b border-[#d4d4d4] px-4 py-3 text-center">225</td>
                                <td className="border-b border-[#d4d4d4] px-4 py-3 text-right leading-tight">
                                    80分01秒
                                    <br />
                                    〜85分00秒まで
                                </td>
                            </tr>
                            <tr>
                                <td className="border-r bg-[#F6F6F6] border-b text-center border-[#d4d4d4] px-4 py-3 font-semibold">
                                    A
                                </td>
                                <td className="border-r border-b border-[#d4d4d4] px-4 py-3 text-center">
                                    793〜957
                                </td>
                                <td className="border-r border-b border-[#d4d4d4] px-4 py-3 text-center">
                                    246〜297
                                </td>
                                <td className="border-r border-b border-[#d4d4d4] px-4 py-3 text-center">
                                    367〜442
                                </td>
                                <td className="border-r border-b border-[#d4d4d4] px-4 py-3 text-center">150</td>
                                <td className="border-b border-[#d4d4d4] px-4 py-3 text-right leading-tight">
                                    85分01秒〜
                                    <br />
                                    90分00秒まで
                                </td>
                            </tr>
                            <tr>
                                <td className="border-r bg-[#F6F6F6] text-center border-[#d4d4d4] px-4 py-3 font-semibold">B</td>
                                <td className="border-r border-[#d4d4d4] px-4 py-3 text-center">〜792</td>
                                <td className="border-r border-[#d4d4d4] px-4 py-3 text-center">〜245</td>
                                <td className="border-r border-[#d4d4d4] px-4 py-3 text-center">〜366</td>
                                <td className="border-r border-[#d4d4d4] px-4 py-3 text-center">75</td>
                                <td className="border-[#d4d4d4] px-4 py-3 text-right whitespace-nowrap">90分01秒〜</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default EvaluationRankStandardTable;


