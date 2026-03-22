import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import { fromPath } from 'pdf2pic';
import OpenAI from 'openai';

const client = new OpenAI({
    baseURL: 'http://localhost:11434/v1',
    apiKey: 'ollama',
});

function toNumber(value: string): number | null {
    const cleaned = value
        .replace(/[^0-9.,]/g, '')
        .replace(/,/g, '');
    const num = parseFloat(cleaned);
    return Number.isFinite(num) ? num : null;
}

function extractAmountByLabel(text: string): number | null {
    const patterns = [
        /ยอดเงิน\s*สุทธิ\s*[:：\-]?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)/u,
        /รวมเงิน\s*ทั้งสิ้น\s*[:：\-]?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)/u,
        /Grand\s*Total\s*[:：\-]?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)/i,
        /Total\s*Amount\s*Due\s*[:：\-]?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)/i,
    ];

    for (const p of patterns) {
        const m = p.exec(text);
        if (m && m[1]) {
            const candidate = toNumber(m[1]);
            if (candidate !== null) return candidate;
        }
    }

    const numericMatches = [...text.matchAll(/([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2}))/g)];
    for (let i = numericMatches.length - 1; i >= 0; i--) {
        const candidate = toNumber(numericMatches[i][1]);
        if (candidate !== null && candidate > 0) {
            return candidate;
        }
    }

    return null;
}

export interface ExtractedData {
    filePath: string;
    totalCost: number;
    method: 'text' | 'ocr' | 'failed';
}

async function parseAmount(text: string): Promise<number | null> {
    // Deterministic label-based extraction first (makes ${"W395-21-27731.pdf"}-style values more reliable)
    const deterministic = extractAmountByLabel(text);
    if (deterministic !== null) {
        return deterministic;
    }

    try {
        const response = await client.chat.completions.create({
            model: 'scb10x/typhoon2.1-gemma3-4b',
            messages: [
                {
                    role: 'system',
                    content: `Extract the final grand total paid from the Thai receipt.
CRITICAL RULES:
1. If there is a Thai text spelling of the amount (e.g. "( หนึ่งพันสามร้อยห้าสิบสี่บาทเก้าสิบสองสตางค์ )"), you MUST translate it into digits and output that. This is the ULTIMATE source of truth.
2. Avoid trusting standalone values with likely OCR artifact structure (e.g. numbers that appear to concatenate items). Prefer explicitly labeled final totals over loose candidate values.
3. If there is no Thai text, look for "ยอดเงินสุทธิ" or "รวมเงินทั้งสิ้น".
4. Output ONLY the final numeric value (e.g. "1354.92"). No other text, no commas. If none found, output "null".`
                },
                {
                    role: 'user',
                    content: `What is the final total amount paid on this Thai receipt?\n\n${text}`
                }
            ],
            temperature: 0.0,
        });

        const output = response.choices?.[0]?.message?.content?.trim();
        if (!output || output.toLowerCase() === 'null') return null;
        
        const num = parseFloat(output.replace(/,/g, ''));
        return !isNaN(num) ? num : null;
    } catch (error) {
        console.error('Error parsing amount with LLM:', error);
        return null;
    }
}

export async function extractPdf(pdfPath: string): Promise<ExtractedData> {
    try {
        const dataBuffer = fs.readFileSync(pdfPath);
        const textData = await pdfParse(dataBuffer);
        
        let cost = await parseAmount(textData.text);
        if (cost !== null) {
            return { filePath: pdfPath, totalCost: cost, method: 'text' };
        }
        
        // OCR Fallback
        console.log(`Text extraction failed for ${path.basename(pdfPath)}, attempting Typhoon-OCR via Ollama...`);
        const baseOptions = {
            width: 2550,
            height: 3300,
            density: 300,
            savePath: "/tmp",
            format: "png"
        };
        const convert = fromPath(pdfPath, baseOptions);
        const pageToConvertAsImage = 1;
        const result = await convert(pageToConvertAsImage, { responseType: "image" });
        if (result && result.path) {
            const base64Image = fs.readFileSync(result.path, { encoding: 'base64' });
            console.log(`Sending image to Typhoon-OCR... (This may take a minute)`);
            const response = await client.chat.completions.create({
                model: 'scb10x/typhoon-ocr-3b:latest',
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: 'Extract text from this image:' },
                            { type: 'image_url', image_url: { url: `data:image/png;base64,${base64Image}` } as any }
                        ]
                    }
                ],
            });
            const text = response.choices[0].message.content || "";
            cost = await parseAmount(text);
            fs.unlinkSync(result.path); // cleanup
            
            if (cost !== null) {
                return { filePath: pdfPath, totalCost: cost, method: 'ocr' };
            }
        }
    } catch (error) {
        console.error(`Error processing ${pdfPath}:`, error);
    }
    
    return { filePath: pdfPath, totalCost: 0, method: 'failed' };
}
