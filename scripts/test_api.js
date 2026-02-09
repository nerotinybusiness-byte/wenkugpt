async function main() {
    console.log('--- Fetching from API ---');
    try {
        const res = await fetch('http://localhost:3000/api/documents');
        const data = await res.json();
        console.log(`Success: ${data.success}`);
        if (data.documents) {
            console.log(`Documents returned: ${data.documents.length}`);
            data.documents.forEach(d => console.log(`- ${d.filename} (${d.fileSize} bytes)`));
        } else {
            console.log('No documents field in response');
        }
    } catch (e) {
        console.error('Fetch error:', e);
    }
}
main();
