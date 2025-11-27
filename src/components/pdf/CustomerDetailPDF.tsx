import React from "react";
import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

Font.register({
    family: "Noto Sans JP",
    fonts: [
        {
            src: "/fonts/NotoSansJP.ttf",
            fontWeight: 400,
        },
    ],
});

type Customer = {
    name?: string;
    external_id?: string;
    application_date?: string;
};

type SectionImage = {
    title: string;
    image?: string;
};

type CustomerDetailPDFProps = {
    customer?: Customer;
    sections: SectionImage[];
};

const styles = StyleSheet.create({
    heroPage: {
        padding: 48,
        fontSize: 10,
        fontFamily: "Noto Sans JP",
        backgroundColor: "#ffffff",
    },
    sectionPage: {
        padding: 24,
        fontSize: 10,
        fontFamily: "Noto Sans JP",
        backgroundColor: "#ffffff",
    },
    heroHeading: {
        marginBottom: 18,
    },
    heroTitle: {
        fontSize: 22,
        fontWeight: "bold",
        color: "#111827",
    },
    heroSubtitle: {
        fontSize: 9,
        color: "#6b7280",
        letterSpacing: 1,
        marginTop: 2,
    },
    heroCard: {
        backgroundColor: "#fff2f1",
        paddingVertical: 18,
        paddingHorizontal: 20,
        borderRadius: 10,
    },
    heroName: {
        fontSize: 13,
        fontWeight: "bold",
        color: "#111827",
        marginBottom: 6,
    },
    heroMeta: {
        fontSize: 9,
        color: "#6b7280",
    },
    sectionWrapper: {
        marginTop: 12,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: "bold",
        marginBottom: 6,
        color: "#1f2937",
    },
    sectionImage: {
        width: "100%",
        borderRadius: 6,
    },
    placeholder: {
        borderWidth: 1,
        borderColor: "#e5e7eb",
        borderStyle: "dashed",
        padding: 18,
        borderRadius: 6,
        alignItems: "center",
        justifyContent: "center",
        color: "#9ca3af",
    },
});

const CustomerDetailPDF: React.FC<CustomerDetailPDFProps> = ({ customer, sections }) => {
    const pages = sections.length ? sections : [{ title: "セクション", image: undefined }];

    return (
        <Document>
            <Page size="A4" style={styles.heroPage} orientation="landscape">
                <View style={styles.heroHeading}>
                    <Text style={styles.heroTitle}>基礎スキルチェック</Text>
                    <Text style={styles.heroSubtitle}>BASIC NAIL SKILLS CHECK</Text>
                </View>
                <View style={styles.heroCard}>
                    <Text style={styles.heroName}>{customer?.name ?? "—"} 様</Text>
                    <Text style={styles.heroMeta}>
                        ID：{customer?.external_id ?? "—"}　　採点日：{customer?.application_date ?? "—"}
                    </Text>
                </View>
            </Page>
            {pages.map((section, index) => (
                <Page key={`pdf-section-${index}`} size="A4" style={styles.sectionPage} orientation="landscape">
                    <View style={styles.sectionWrapper}>
                        {/* <Text style={styles.sectionTitle}>{section.title}</Text> */}
                        {section.image ? (
                            <Image src={section.image} style={styles.sectionImage} />
                        ) : (
                            <View style={styles.placeholder}>
                                <Text>表示できる情報がありません</Text>
                            </View>
                        )}
                    </View>
                </Page>
            ))}
        </Document>
    );
};

export default CustomerDetailPDF;

