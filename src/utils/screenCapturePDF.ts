import html2canvas from 'html2canvas';
// @ts-ignore - jsPDF types may not be available
import { jsPDF } from 'jspdf';

interface CaptureOptions {
    filename?: string;
    quality?: number;
    scale?: number;
    backgroundColor?: string;
}

/**
 * Captures the entire page content and generates a PDF
 * Similar to GoFullPage Chrome extension
 */
export const capturePageAsPDF = async (
    elementId: string = 'pdf-content',
    options: CaptureOptions = {}
): Promise<void> => {
    const {
        filename = 'customer-detail.pdf',
        quality = 0.95,
        scale = 2,
        backgroundColor = '#ffffff'
    } = options;

    try {
        // Get the element to capture
        const element = document.getElementById(elementId);
        if (!element) {
            throw new Error(`Element with id "${elementId}" not found`);
        }

        // Show loading indicator
        const loadingToast = document.createElement('div');
        loadingToast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #333;
            color: white;
            padding: 16px 24px;
            border-radius: 8px;
            z-index: 10000;
            font-family: system-ui, -apple-system, sans-serif;
        `;
        loadingToast.textContent = 'PDF生成中...';
        document.body.appendChild(loadingToast);

        // Scroll to top to ensure everything is visible
        window.scrollTo(0, 0);

        // Wait a bit for any animations to complete
        await new Promise(resolve => setTimeout(resolve, 500));

        // Capture the element as canvas
        const canvas = await html2canvas(element, {
            scale: scale,
            useCORS: true,
            allowTaint: true,
            backgroundColor: backgroundColor,
            logging: false,
            windowWidth: element.scrollWidth,
            windowHeight: element.scrollHeight,
            onclone: (clonedDoc) => {
                // Ensure all content is visible in the clone
                const clonedElement = clonedDoc.getElementById(elementId);
                if (clonedElement) {
                    clonedElement.style.display = 'block';
                    clonedElement.style.position = 'relative';
                }
            }
        });

        // Calculate PDF dimensions
        const imgWidth = 210; // A4 width in mm
        const pageHeight = 297; // A4 height in mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;

        // Create PDF
        const pdf = new jsPDF('p', 'mm', 'a4');
        let position = 0;

        // Convert canvas to image
        const imgData = canvas.toDataURL('image/jpeg', quality);

        // Add first page
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        // Add additional pages if content is longer than one page
        while (heightLeft > 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }

        // Save the PDF
        pdf.save(filename);

        // Remove loading indicator
        document.body.removeChild(loadingToast);

        // Show success message
        const successToast = document.createElement('div');
        successToast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #22c55e;
            color: white;
            padding: 16px 24px;
            border-radius: 8px;
            z-index: 10000;
            font-family: system-ui, -apple-system, sans-serif;
        `;
        successToast.textContent = 'PDF生成完了！';
        document.body.appendChild(successToast);
        setTimeout(() => {
            document.body.removeChild(successToast);
        }, 3000);

    } catch (error) {
        console.error('Failed to capture page as PDF:', error);

        // Show error message
        const errorToast = document.createElement('div');
        errorToast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ef4444;
            color: white;
            padding: 16px 24px;
            border-radius: 8px;
            z-index: 10000;
            font-family: system-ui, -apple-system, sans-serif;
        `;
        errorToast.textContent = 'PDF生成に失敗しました';
        document.body.appendChild(errorToast);
        setTimeout(() => {
            if (document.body.contains(errorToast)) {
                document.body.removeChild(errorToast);
            }
        }, 3000);

        throw error;
    }
};

interface SectionWithTab {
    tab: string;
    id: string;
}

/**
 * Captures multiple sections separately and combines them into one PDF
 * Each section can be in a different tab
 */
export const captureMultipleSectionsAsPDF = async (
    sections: SectionWithTab[],
    filename: string = 'customer-detail.pdf',
    switchTab: (tabValue: string) => Promise<void>,
    options: CaptureOptions = {}
): Promise<void> => {
    const {
        quality = 0.95,
        scale = 2,
        backgroundColor = '#ffffff'
    } = options;

    try {
        const loadingToast = document.createElement('div');
        loadingToast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #333;
            color: white;
            padding: 16px 24px;
            border-radius: 8px;
            z-index: 10000;
            font-family: system-ui, -apple-system, sans-serif;
        `;
        loadingToast.textContent = 'PDF生成中...';
        document.body.appendChild(loadingToast);

        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgWidth = 210;
        const pageHeight = 297;
        let isFirstPage = true;

        for (const section of sections) {
            // Switch to the correct tab
            await switchTab(section.tab);

            const element = document.getElementById(section.id);
            if (!element) {
                console.warn(`Section "${section.id}" not found in tab "${section.tab}", skipping...`);
                continue;
            }

            // Scroll element into view
            element.scrollIntoView({ behavior: 'instant', block: 'start' });
            await new Promise(resolve => setTimeout(resolve, 300));

            const canvas = await html2canvas(element, {
                scale: scale,
                useCORS: true,
                allowTaint: true,
                backgroundColor: backgroundColor,
                logging: false,
            });

            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            const imgData = canvas.toDataURL('image/jpeg', quality);

            if (!isFirstPage) {
                pdf.addPage();
            }
            isFirstPage = false;

            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            while (heightLeft > 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }
        }

        pdf.save(filename);
        document.body.removeChild(loadingToast);

        const successToast = document.createElement('div');
        successToast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #22c55e;
            color: white;
            padding: 16px 24px;
            border-radius: 8px;
            z-index: 10000;
            font-family: system-ui, -apple-system, sans-serif;
        `;
        successToast.textContent = 'PDF生成完了！';
        document.body.appendChild(successToast);
        setTimeout(() => {
            document.body.removeChild(successToast);
        }, 3000);

    } catch (error) {
        console.error('Failed to capture sections as PDF:', error);
        throw error;
    }
};

