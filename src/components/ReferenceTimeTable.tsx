import React from "react";

const ReferenceTimeTable: React.FC = () => {
    return (
        <div className="mt-2 rounded-2xl bg-[#ffffff] p-4">
            <div className="mb-3 ml-2 text-sm font-semibold text-slate-800">参考タイム表</div>
            <div className="overflow-hidden bg-white shadow-sm border border-[#e3d6d4]">
                <table className="w-[100%] border-collapse text-sm text-slate-700">
                    <thead>
                        <tr>
                            <th colSpan={2} className="w-[30%] bg-[#D4D4D4] border-b border-r border-[#AFAFAF] px-4 py-3 text-center text-xs font-semibold">
                                項目
                            </th>
                            <th className="w-24 bg-[#D4D4D4] border-b border-r border-[#AFAFAF] px-4 py-4 text-center text-xs font-semibold">
                                AAA
                            </th>
                            <th className="w-24 bg-[#D4D4D4] border-b border-r border-[#AFAFAF] px-4 py-3 text-center text-xs font-semibold">
                                AA
                            </th>
                            <th className="w-24 bg-[#D4D4D4] border-b border-r border-[#AFAFAF] px-4 py-3 text-center text-xs font-semibold">
                                A
                            </th>
                            <th className="w-24 bg-[#D4D4D4] border-b border-[#bfbfbf] px-4 py-3 text-center text-xs font-semibold">
                                B
                            </th>
                        </tr>
                    </thead>
                    <tbody className="text-sm text-slate-700">

                        <tr>
                            <td className="border-r bg-[#F6F6F6] border-b border-[#e0e0e0] px-4 py-3 align-middle text-sm font-semibold">オフ/フィルイン</td>
                            <td rowSpan={2} className="border-r border-b bg-[#F6F6F6] border-[#e0e0e0] px-4 py-3 text-center text-xs font-semibold">タイム</td>
                            <td className="border-r border-b border-[#e0e0e0] px-4 py-3 text-center text-xs">〜17分</td>
                            <td className="border-r border-b border-[#e0e0e0] px-4 py-3 text-center text-xs">18分30秒</td>
                            <td className="border-r border-b border-[#e0e0e0] px-4 py-3 text-center text-xs">20分</td>
                            <td className="border-b border-[#e0e0e0] px-4 py-3 text-center text-xs">20分〜</td>
                        </tr>

                        <tr>
                            <td className="border-r bg-[#F6F6F6] border-b border-[#e0e0e0] px-4 py-3 align-middle text-sm font-semibold">
                                プレパレーション
                            </td>
                            <td className="border-r border-b border-[#e0e0e0] px-4 py-3 text-center text-xs">〜22分</td>
                            <td className="border-r border-b border-[#e0e0e0] px-4 py-3 text-center text-xs">23分</td>
                            <td className="border-r border-b border-[#e0e0e0] px-4 py-3 text-center text-xs">24分</td>
                            <td className="border-b border-[#e0e0e0] px-4 py-3 text-center text-xs">24分〜</td>
                        </tr>

                        <tr>
                            <td className="border-r border-b bg-[#F6F6F6] border-[#e0e0e0] px-4 py-3 align-top text-sm" rowSpan={4}>
                                <div className="flex flex-col h-full justify-center">
                                    <span className="font-semibold">ワンカラー</span>
                                </div>
                            </td>
                            <td className="border-r border-b bg-[#F6F6F6] border-[#e0e0e0] px-4 py-3 text-left text-xs font-semibold">
                                ベース
                            </td>
                            <td className="border-r border-b border-[#e0e0e0] px-4 py-3 text-center text-xs">〜13分</td>
                            <td className="border-r border-b border-[#e0e0e0] px-4 py-3 text-center text-xs">13分30秒</td>
                            <td className="border-r border-b border-[#e0e0e0] px-4 py-3 text-center text-xs">14分</td>
                            <td className="border-b border-[#e0e0e0] px-4 py-3 text-center text-xs">14分~</td>
                        </tr>
                        <tr>
                            <td className="border-r bg-[#F6F6F6] border-b border-[#e0e0e0] px-4 py-3 text-left text-xs font-semibold">
                                カラー
                            </td>
                            <td className="border-r border-b border-[#e0e0e0] px-4 py-3 text-center text-xs">〜19分</td>
                            <td className="border-r border-b border-[#e0e0e0] px-4 py-3 text-center text-xs">20分30秒</td>
                            <td className="border-r border-b border-[#e0e0e0] px-4 py-3 text-center text-xs">22分</td>
                            <td className="border-b border-[#e0e0e0] px-4 py-3 text-center text-xs">22分~</td>
                        </tr>
                        <tr>
                            <td className="border-r bg-[#F6F6F6] border-b border-[#e0e0e0] px-4 py-3 text-left text-xs font-semibold">
                                トップ
                            </td>
                            <td className="border-r border-b border-[#e0e0e0] px-4 py-3 text-center text-xs">〜9分</td>
                            <td className="border-r border-b border-[#e0e0e0] px-4 py-3 text-center text-xs">9分30秒</td>
                            <td className="border-r border-b border-[#e0e0e0] px-4 py-3 text-center text-xs">10分</td>
                            <td className="border-b border-[#e0e0e0] px-4 py-3 text-center text-xs">10分~</td>
                        </tr>
                        <tr>
                            <td className="border-r bg-[#F6F6F6] border-b border-[#e0e0e0] px-4 py-3 text-left text-xs font-semibold">
                                合計
                            </td>
                            <td className="border-r border-b border-[#e0e0e0] px-4 py-3 text-center text-xs">〜41分</td>
                            <td className="border-r border-b border-[#e0e0e0] px-4 py-3 text-center text-xs">43分30秒</td>
                            <td className="border-r border-b border-[#e0e0e0] px-4 py-3 text-center text-xs">46分</td>
                            <td className="border-b border-[#e0e0e0] px-4 py-3 text-center text-xs">46分~</td>
                        </tr>

                        <tr>
                            <td colSpan={2} className="border-r border-t bg-[#ffe2de] border-[#e0b8b0] px-4 py-3 text-sm font-semibold">
                                総合計タイム
                            </td>
                            <td className="border-r border-t border-[#e0b8b0] px-4 py-3 text-center text-xs">〜79分</td>
                            <td className="border-r border-b border-[#e0e0e0] px-4 py-3 text-center text-xs">80分</td>
                            <td className="border-r border-b border-[#e0e0e0] px-4 py-3 text-center text-xs">90分</td>
                            <td className="border-r border-b border-[#e0e0e0] px-4 py-3 text-center text-xs">90分</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div className="mt-2 text-[11px] text-slate-800 font-semibold">
                ※オフの巻き、放置タイムとして片手6分を引いて計算する
            </div>
        </div>
    );
};

export default ReferenceTimeTable;


