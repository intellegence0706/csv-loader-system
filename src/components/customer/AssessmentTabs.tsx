import { TabsList, TabsTrigger } from "@/components/ui/tabs";

const DEFAULT_TABS = [
    { value: "overall", label: "総合" },
    { value: "care", label: "ケア" },
    { value: "onecolor", label: "ワンカラー" },
    { value: "time", label: "タイム" },
] as const;

type AssessmentTabsProps = {
    tabs?: typeof DEFAULT_TABS;
};

const triggerClass =
    "relative px-7 py-3 text-sm font-medium text-slate-500 rounded-t-xl " +
    "data-[state=active]:text-[#008c95] data-[state=active]:bg-white " +
    "data-[state=active]:shadow-sm " +
    "data-[state=active]:before:content-[''] data-[state=active]:before:absolute " +
    "data-[state=active]:before:left-0 data-[state=active]:before:right-0 " +
    "data-[state=active]:before:top-0 data-[state=active]:before:h-[4px] " +
    "data-[state=active]:before:rounded-t-xl data-[state=active]:before:bg-gradient-to-r " +
    "data-[state=active]:before:from-[#ff9a9e] data-[state=active]:before:to-[#a1ffce]";

const AssessmentTabs = ({ tabs = DEFAULT_TABS }: AssessmentTabsProps) => (
    <TabsList className="w-full justify-start bg-transparent">
        {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className={triggerClass}>
                {tab.label}
            </TabsTrigger>
        ))}
    </TabsList>
);

export default AssessmentTabs;


