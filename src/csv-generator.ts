import { createObjectCsvWriter } from 'csv-writer';
import { ExtractedData } from './extractor';
import path from 'path';

export async function generateCsv(data: ExtractedData[], outputPath: string) {
    if (data.length === 0) {
        console.log("No data extracted. Skipping CSV generation.");
        return;
    }

    const csvWriter = createObjectCsvWriter({
        path: outputPath,
        header: [
            { id: 'filename', title: 'File Name' },
            { id: 'method', title: 'Extraction Method' },
            { id: 'totalCost', title: 'Total Cost (Baht)' }
        ]
    });

    let grandTotal = 0;
    const records = data.map(item => {
        grandTotal += item.totalCost;
        return {
            filename: path.basename(item.filePath),
            method: item.method,
            totalCost: item.totalCost.toFixed(2)
        };
    });

    // Add a final summary row
    records.push({
        filename: 'GRAND TOTAL',
        method: '' as any,
        totalCost: grandTotal.toFixed(2)
    });

    await csvWriter.writeRecords(records);
    console.log(`CSV summary generated at: ${outputPath}`);
}
