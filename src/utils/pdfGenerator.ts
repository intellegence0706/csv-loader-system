import React from 'react';
import { pdf } from '@react-pdf/renderer';
import CustomerDetailPDF from '../components/pdf/CustomerDetailPDF';

type Customer = {
    name?: string;
    external_id?: string;
    application_date?: string;
};

type SectionImage = {
    title: string;
    image?: string;
};

type PDFData = {
    customer?: Customer;
    sections: SectionImage[];
};

export const generateCustomerDetailPDF = async (data: PDFData): Promise<Blob> => {
    const doc = React.createElement(CustomerDetailPDF as React.FC<any>, data);
    const blob = await pdf(doc).toBlob();
    return blob;
};

export const downloadPDF = async (data: PDFData, filename: string = 'customer-detail.pdf') => {
    try {
        const blob = await generateCustomerDetailPDF(data);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Failed to generate PDF:', error);
        throw error;
    }
};

