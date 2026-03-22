#!/usr/bin/env node

import { Command } from 'commander';
import { processPath } from './processor';
import { generateCsv } from './csv-generator';
import path from 'path';

const program = new Command();

program
  .name('etaxfilter')
  .description('Extract total cost from Thai E-Tax PDF files')
  .version('1.0.0')
  .option('-f, --file <path>', 'Single PDF file to scan')
  .option('-d, --dir <path>', 'Directory containing PDF files to scan')
  .option('-o, --output <path>', 'Output CSV file path', 'summary.csv')
  .parse(process.argv);

const options = program.opts();

async function run() {
    let inputPath = '';
    
    if (options.file && options.dir) {
        console.error('Error: Please provide either --file or --dir, not both.');
        process.exit(1);
    } else if (options.file) {
        inputPath = options.file;
    } else if (options.dir) {
        inputPath = options.dir;
    } else {
        console.error('Error: You must specify --file or --dir.');
        program.help();
    }

    const resolvedInputPath = path.resolve(inputPath);
    const resolvedOutputPath = path.resolve(options.output);

    try {
        const results = await processPath(resolvedInputPath);
        await generateCsv(results, resolvedOutputPath);
        console.log('Processing completed Successfully!');
    } catch (error) {
        console.error('An error occurred during execution:', error);
    }
}

run();
