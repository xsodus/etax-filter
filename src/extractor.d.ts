export interface ExtractedData {
    filePath: string;
    totalCost: number;
    method: 'text' | 'ocr' | 'failed';
}
export declare function extractPdf(pdfPath: string): Promise<ExtractedData>;
//# sourceMappingURL=extractor.d.ts.map