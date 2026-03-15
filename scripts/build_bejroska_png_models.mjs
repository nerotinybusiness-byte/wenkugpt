import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const npxExecutable = process.platform === 'win32' ? 'npx.cmd' : path.join(path.dirname(process.execPath), 'npx');

const sourceFastRelative = 'public/models/bejroska-hoodie-fast.glb';
const outputFastPngRelative = 'public/models/bejroska-hoodie-fast-png.glb';
const outputDracoPngRelative = 'public/models/bejroska-hoodie-draco-png.glb';

function parseGlb(buffer) {
    const dataView = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const magic = dataView.getUint32(0, true);
    const version = dataView.getUint32(4, true);
    if (magic !== 0x46546c67 || version !== 2) {
        throw new Error('Invalid GLB header.');
    }

    const jsonChunkLength = dataView.getUint32(12, true);
    const jsonChunkType = dataView.getUint32(16, true);
    if (jsonChunkType !== 0x4e4f534a) {
        throw new Error('Missing JSON chunk.');
    }
    const jsonStart = 20;
    const jsonEnd = jsonStart + jsonChunkLength;
    const jsonText = buffer.slice(jsonStart, jsonEnd).toString('utf8').replace(/\u0000+$/g, '');
    const json = JSON.parse(jsonText);

    const binHeaderStart = jsonEnd;
    const binChunkLength = dataView.getUint32(binHeaderStart, true);
    const binChunkType = dataView.getUint32(binHeaderStart + 4, true);
    if (binChunkType !== 0x004e4942) {
        throw new Error('Missing BIN chunk.');
    }
    const binStart = binHeaderStart + 8;
    const bin = buffer.slice(binStart, binStart + binChunkLength);

    return { json, bin };
}

function buildGlb(json, binBuffer) {
    const jsonBytes = Buffer.from(JSON.stringify(json), 'utf8');
    const jsonPadding = (4 - (jsonBytes.length % 4)) % 4;
    const jsonChunk = Buffer.concat([jsonBytes, Buffer.alloc(jsonPadding, 0x20)]);

    const binPadding = (4 - (binBuffer.length % 4)) % 4;
    const binChunk = Buffer.concat([binBuffer, Buffer.alloc(binPadding, 0x00)]);

    const totalLength = 12 + 8 + jsonChunk.length + 8 + binChunk.length;
    const header = Buffer.alloc(12);
    header.writeUInt32LE(0x46546c67, 0);
    header.writeUInt32LE(2, 4);
    header.writeUInt32LE(totalLength, 8);

    const jsonHeader = Buffer.alloc(8);
    jsonHeader.writeUInt32LE(jsonChunk.length, 0);
    jsonHeader.writeUInt32LE(0x4e4f534a, 4);

    const binHeader = Buffer.alloc(8);
    binHeader.writeUInt32LE(binChunk.length, 0);
    binHeader.writeUInt32LE(0x004e4942, 4);

    return Buffer.concat([header, jsonHeader, jsonChunk, binHeader, binChunk]);
}

function runDracoEncode(inputRelative, outputRelative) {
    const args = ['--yes', '@gltf-transform/cli', 'draco', inputRelative, outputRelative];
    const quoteForCmd = (arg) => (/\s/.test(arg) ? `"${arg}"` : arg);
    const result =
        process.platform === 'win32'
            ? spawnSync(
                  process.env.ComSpec ?? 'cmd.exe',
                  ['/d', '/s', '/c', `${npxExecutable} ${args.map(quoteForCmd).join(' ')}`],
                  { stdio: 'inherit', cwd: rootDir },
              )
            : spawnSync(npxExecutable, args, { stdio: 'inherit', cwd: rootDir });

    if (result.error) throw result.error;
    if (result.status !== 0) {
        throw new Error(`Draco encode failed with code ${result.status ?? 'unknown'}`);
    }
}

async function main() {
    const sourceFastPath = path.join(rootDir, sourceFastRelative);
    const outputFastPngPath = path.join(rootDir, outputFastPngRelative);
    const outputDracoPngPath = path.join(rootDir, outputDracoPngRelative);

    const glbBuffer = await readFile(sourceFastPath);
    const { json, bin } = parseGlb(glbBuffer);

    const imageDef = json.images?.[0];
    if (!imageDef || typeof imageDef.bufferView !== 'number') {
        throw new Error('No embedded texture found.');
    }
    const imageBufferView = json.bufferViews?.[imageDef.bufferView];
    if (!imageBufferView) {
        throw new Error('Image bufferView missing.');
    }

    const imageStart = imageBufferView.byteOffset ?? 0;
    const imageLength = imageBufferView.byteLength;
    const imageEnd = imageStart + imageLength;
    const sourceImage = bin.slice(imageStart, imageEnd);

    const image = await loadImage(sourceImage);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0, image.width, image.height);
    const pngBuffer = canvas.toBuffer('image/png');

    const beforeImage = bin.slice(0, imageStart);
    const afterImage = bin.slice(imageEnd);
    const rebuiltBin = Buffer.concat([beforeImage, Buffer.from(pngBuffer), afterImage]);

    const delta = pngBuffer.length - imageLength;
    for (const bufferView of json.bufferViews ?? []) {
        if ((bufferView.byteOffset ?? 0) > imageStart) {
            bufferView.byteOffset = (bufferView.byteOffset ?? 0) + delta;
        }
    }
    imageBufferView.byteLength = pngBuffer.length;
    imageDef.mimeType = 'image/png';
    if (json.buffers?.[0]) {
        json.buffers[0].byteLength = rebuiltBin.length;
    }

    const outFastPng = buildGlb(json, rebuiltBin);
    await writeFile(outputFastPngPath, outFastPng);
    runDracoEncode(outputFastPngRelative, outputDracoPngRelative);

    console.log(
        `[build-bejroska-png] wrote ${outputFastPngRelative} (${outFastPng.length} bytes) and ${outputDracoPngPath}`,
    );
}

main().catch((error) => {
    console.error('[build-bejroska-png] failed', error);
    process.exitCode = 1;
});
