# ETaxFilter

Extract total costs from Thai E-Tax PDF files. This CLI tool processes Thai E-Tax invoices/receipts (PDFs), extracts the final total amount paid (including VAT), and outputs the results into a CSV file. It uses a local LLM through [Ollama](https://ollama.com/) for natural language parsing of the amounts and has an OCR fallback mechanism for scanned PDFs.

## Prerequisites

Before running this application, ensure you have the following installed on your system:

1. **Node.js** (v18 or higher recommended)
2. **Ollama**: Running locally and accessible at `http://localhost:11434`
3. **Ghostscript & GraphicsMagick** (Required by the `pdf2pic` library for the OCR fallback to convert PDFs to images):
   - **macOS (Homebrew)**: 
     ```bash
     brew install ghostscript graphicsmagick
     ```
   - **Ubuntu/Debian**: 
     ```bash
     sudo apt-get install ghostscript graphicsmagick
     ```
4. **Ollama Models**: You need to pull the specific SCB 10X Typhoon models used by the application:
   ```bash
   ollama pull scb10x/typhoon2.1-gemma3-4b
   ollama pull scb10x/typhoon-ocr-3b:latest
   ```

## Installation

1. Navigate to the project directory:
   ```bash
   cd ETaxFilter
   ```

2. Install the Node.js dependencies:
   ```bash
   npm install
   ```

3. Build the project (compiles TypeScript to JavaScript in the `dist/` folder):
   ```bash
   npm run build
   ```

4. *(Optional)* Link the package globally to use the `etaxfilter` command from anywhere:
   ```bash
   npm link
   ```

## Usage

You can run the application either directly via `npm start`, using the compiled `dist/index.js`, or using the global `etaxfilter` command if you ran `npm link`.

### Command Line Options

- `-f, --file <path>`: Submits a single PDF file to scan and process.
- `-d, --dir <path>`: Submits a directory containing multiple PDF files to scan and process.
- `-o, --output <path>`: Specifies the output CSV file path (default: `summary.csv`).
- `-h, --help`: Display help for the command.

*(Note: You must provide either `-f` or `-d`, but not both.)*

### Examples

**Processing a single file:**
```bash
npm start -- -f ./receipt.pdf
# Or if linked globally:
etaxfilter -f ./receipt.pdf
```

**Processing a directory of files:**
```bash
npm start -- -d ./invoices
# Or if linked globally:
etaxfilter -d ./invoices
```

**Specifying a custom output CSV file:**
```bash
npm start -- -d ./invoices -o my-monthly-summary.csv
# Or if linked globally:
etaxfilter -d ./invoices -o my-monthly-summary.csv
```

## How It Works

1. **Text Extraction**: The tool first attempts to extract text directly from the PDF file using `pdf-parse`.
2. **LLM Parsing Classification**: It sends the extracted text to your local Ollama instance running the `scb10x/typhoon2.1-gemma3-4b` model to intelligently locate the true final total (prioritizing terms like "ยอดเงินสุทธิ", "รวมเงินทั้งสิ้น", etc.) and handles Thai text amount formatting seamlessly.
3. **OCR Fallback**: If standard text extraction fails or yields no results (e.g., the PDF is essentially a scanned image), the tool converts the first page of the PDF to a PNG image. It then sends this image to `scb10x/typhoon-ocr-3b:latest` via Ollama for Optical Character Recognition (OCR).
4. **CSV Export**: The extracted data consisting of the file path, the identified total cost, and the successful methodology (`text` or `ocr`) are compiled and exported to the specified CSV file.
