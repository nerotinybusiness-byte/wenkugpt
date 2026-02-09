
import { parsePDF } from './src/lib/ingest/parser';
import fs from 'fs';

async function verify() {
    console.log('Verifying PDF parsing...');
    try {
        const buffer = fs.readFileSync('test.pdf');
        console.log('Read test.pdf, size:', buffer.length);

        // Pass Buffer directly - this was failing before
        const result = await parsePDF(buffer);

        console.log('SUCCESS: Parsed PDF');
        console.log('Page Count:', result.pageCount);
        console.log('Metadata:', result.metadata);
        console.log('First Page Text Length:', result.pages[0]?.fullText?.length);

    } catch (e) {
        console.error('FAIL: Error parsing PDF:', e);
        process.exit(1);
    }
}

verify();
