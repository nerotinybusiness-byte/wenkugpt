
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';

const logFile = 'api_log.txt';
fs.writeFileSync(logFile, '--- API Check Log ---\n');

function log(msg: string) {
    console.log(msg);
    fs.appendFileSync(logFile, msg + '\n');
}

async function listModels() {
    log("\n--- Listing Available Models (REST) ---");
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
        log("API Key missing");
        return;
    }

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (!response.ok) {
            log(`Failed to list models: ${response.status} ${response.statusText}`);
            const text = await response.text();
            log(`Response: ${text}`);
            return;
        }
        const data = await response.json();
        if (data.models) {
            log(`Found ${data.models.length} models:`);
            data.models.forEach((m: any) => {
                if (m.name.includes('embed') || m.supportedGenerationMethods?.includes('embedContent')) {
                    log(` - ${m.name} [${m.supportedGenerationMethods?.join(', ')}]`);
                }
            });
        } else {
            log("No models field in response.");
        }
    } catch (e) {
        log(`Error listing models: ${e}`);
    }
}

async function testModel(modelName: string) {
    log(`\nTesting model: ${modelName}`);
    try {
        const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        if (!apiKey) throw new Error("API Key missing");

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: modelName });
        // @ts-ignore
        const result = await model.embedContent({
            content: { role: 'user', parts: [{ text: "Hello world" }] },
            taskType: 'RETRIEVAL_DOCUMENT',
        });

        // Also test with outputDimensionality if supported
        try {
            const model768 = genAI.getGenerativeModel({ model: modelName }, { apiVersion: 'v1beta' });
            // Note: outputDimensionality is a parameter of embedContent in REST, but SDK map might vary.
            // In Node SDK, it's passed in generationConfig or similar? 
            // Actually, for embedding, it is not in generationConfig. It's often not supported in SDK < 0.12?
            // But let's try passing it in the request object if typed allows, or cast it.
            // @ts-ignore
            const result768 = await model.embedContent({
                content: { role: 'user', parts: [{ text: "Hello world" }] },
                outputDimensionality: 768
            } as any);
            // @ts-ignore
            const vec768 = result768.embedding.values;
            log(`✅ SUCCESS with outputDimensionality: 768. Result Vector length: ${vec768.length}`);
        } catch (e: any) {
            log(`⚠️ outputDimensionality: 768 failed: ${e.message || e}`);
        }

        const embedding = result.embedding;
        const vector = embedding.values;

        log(`✅ SUCCESS. Vector length: ${vector.length}`);
        return true;
    } catch (e: any) {
        log(`❌ FAILED: ${e.message || e}`);
        if (e.response) {
            log(`   Status: ${e.response.status} ${e.response.statusText}`);
        }
        return false;
    }
}

export { };

async function main() {
    log(`Checking API Key: ${process.env.GOOGLE_GENERATIVE_AI_API_KEY ? "Present" : "MISSING"}`);

    // First list available models
    await listModels();

    // Test Found Model
    await testModel('models/gemini-embedding-001');

    // Test 1: Explicit models/ prefix
    // await testModel('models/text-embedding-004');

    // Test 2: Standard name
    // await testModel('text-embedding-004');
}

main();
