
export { };

// Native fetch is available in Node 18+

async function main() {
    console.log('--- Testing API Settings ---');
    try {
        const response = await fetch('http://localhost:3000/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: 'Co je WenkuGPT?',
                settings: {
                    generatorModel: 'gemini-1.5-flash', // Different from default
                    temperature: 0.9,
                    topK: 3
                }
            })
        });

        const data = await response.json();
        console.log('Status:', response.status);
        if (data.success) {
            console.log('Success!');
            console.log('Chat ID:', data.chatId);
            // We can't easily verify the internal model usage from response alone
            // without inspecting logs, but a 200 OK means it parsed correctly.
        } else {
            console.error('Error:', data);
        }
    } catch (e) {
        console.error('Fetch error:', e);
    }
    console.log('--- Done ---');
}

main();
