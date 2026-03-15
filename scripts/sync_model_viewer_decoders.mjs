import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const decoderFiles = [
    {
        source: 'node_modules/three/examples/jsm/libs/draco/gltf/draco_decoder.js',
        destination: 'public/model-viewer/draco/draco_decoder.js',
    },
    {
        source: 'node_modules/three/examples/jsm/libs/draco/gltf/draco_decoder.wasm',
        destination: 'public/model-viewer/draco/draco_decoder.wasm',
    },
    {
        source: 'node_modules/three/examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js',
        destination: 'public/model-viewer/draco/draco_wasm_wrapper.js',
    },
    {
        source: 'node_modules/three/examples/jsm/libs/basis/basis_transcoder.js',
        destination: 'public/model-viewer/basis/basis_transcoder.js',
    },
    {
        source: 'node_modules/three/examples/jsm/libs/basis/basis_transcoder.wasm',
        destination: 'public/model-viewer/basis/basis_transcoder.wasm',
    },
];

async function syncDecoders() {
    for (const file of decoderFiles) {
        const sourcePath = path.join(rootDir, file.source);
        const destinationPath = path.join(rootDir, file.destination);

        await mkdir(path.dirname(destinationPath), { recursive: true });
        await copyFile(sourcePath, destinationPath);
        console.log(`[sync-model-viewer-decoders] ${file.source} -> ${file.destination}`);
    }
}

syncDecoders().catch((error) => {
    console.error('[sync-model-viewer-decoders] failed', error);
    process.exitCode = 1;
});
