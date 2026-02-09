
async function testQuery(query: string, settings: any = {}) {
    console.log(`\nTesting query: "${query}" with settings:`, JSON.stringify(settings));
    try {
        const response = await fetch('http://localhost:3000/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query,
                settings,
                chatId: null
            })
        });

        const data = await response.json();

        if (data.success) {
            console.log(`Success! Found ${data.sources.length} sources.`);
            data.sources.forEach((s: any, i: number) => {
                console.log(`[${i + 1}] Score: ${s.relevanceScore.toFixed(3)} | File: ${s.filename} | Content: ${s.content.slice(0, 50)}...`);
            });
        } else {
            console.error("API Error:", data.error);
            console.error("Response:", data.response);
        }

    } catch (e) {
        console.error("Fetch failed:", e);
    }
}

async function main() {
    // 1. Test with default settings (simulating the user's issue)
    console.log("--- TEST 1: Default Settings ---");
    await testQuery("kde je sklad wenku?");

    // 2. Test with permissive settings (debugging)
    console.log("\n--- TEST 2: Permissive Settings (minScore: 0.0, limit: 50) ---");
    await testQuery("kde je sklad wenku?", {
        minScore: 0.0,
        searchLimit: 50,
    });
}

main();
