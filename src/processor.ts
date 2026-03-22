import fs from 'fs';
import path from 'path';
import { extractPdf, ExtractedData } from './extractor';

export async function processPath(inputPath: string): Promise<ExtractedData[]> {
    const stat = fs.statSync(inputPath);
    const results: ExtractedData[] = [];

    if (stat.isDirectory()) {
        const files = fs.readdirSync(inputPath);
        for (const file of files) {
            if (file.toLowerCase().endsWith('.pdf')) {
                const fullPath = path.join(inputPath, file);
                console.log(`Processing: ${file}`);
                const data = await extractPdf(fullPath);
                results.push(data);
            }
        }
    } else if (stat.isFile() && inputPath.toLowerCase().endsWith('.pdf')) {
        console.log(`Processing: ${path.basename(inputPath)}`);
        const data = await extractPdf(inputPath);
        results.push(data);
    } else {
        console.error('Invalid input. Must be a PDF file or a directory containing PDFs.');
    }

    return results;
}
