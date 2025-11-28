export type NationalAvgOverviewOverrides = Record<
    string,
    {
        rating: string;
        score: number;
        timeText?: string;
    }
>;

export const NATIONAL_AVG_OVERVIEW_OVERRIDES: NationalAvgOverviewOverrides = {
    "総合評価": { rating: "AA", score: 690 },
    "ケア": { rating: "AA", score: 320 },
    "ワンカラー": { rating: "AA", score: 390 },
    "タイム": { rating: "AA", score: 150, timeText: "68分20秒" },
};


