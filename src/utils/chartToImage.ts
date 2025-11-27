import html2canvas from 'html2canvas';

/**
 * Converts a DOM element (like a chart) to a base64 image data URL
 * @param elementId - The ID of the element to capture
 * @param options - html2canvas options
 * @returns Promise<string> - Base64 data URL of the image
 */
export const elementToImage = async (
    elementId: string,
    options?: {
        scale?: number;
        backgroundColor?: string;
        width?: number;
        height?: number;
    }
): Promise<string> => {
    const element = document.getElementById(elementId);

    if (!element) {
        throw new Error(`Element with id "${elementId}" not found`);
    }

    const canvas = await html2canvas(element, {
        scale: options?.scale || 2,
        backgroundColor: options?.backgroundColor || '#ffffff',
        width: options?.width,
        height: options?.height,
        useCORS: true,
        allowTaint: true,
        logging: false,
    });

    return canvas.toDataURL('image/png');
};

/**
 * Converts multiple chart elements to images
 * @param elementIds - Array of element IDs to capture
 * @returns Promise<Record<string, string>> - Object mapping element IDs to base64 images
 */
export const chartsToImages = async (
    elementIds: string[]
): Promise<Record<string, string>> => {
    const images: Record<string, string> = {};

    for (const id of elementIds) {
        try {
            images[id] = await elementToImage(id);
        } catch (error) {
            console.error(`Failed to capture element ${id}:`, error);
            images[id] = '';
        }
    }

    return images;
};

