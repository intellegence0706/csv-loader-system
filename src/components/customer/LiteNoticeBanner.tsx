type LiteNoticeBannerProps = {
    visible: boolean;
};

export function LiteNoticeBanner({ visible }: LiteNoticeBannerProps) {
    if (!visible) {
        return null;
    }

    return (
        <div className="my-10 border border-[#e34b4b] bg-[#ffffff] px-6 py-6 text-center text-sm text-[#b12424] leading-relaxed">
            <p className="text-orange-700">
                この結果は基礎スキルチェックライト（体験版）のものであり、<br />
                基礎スキルチェック™の正規の結果とは異なりますので、ご了承ください。
            </p>
        </div>
    );
}

