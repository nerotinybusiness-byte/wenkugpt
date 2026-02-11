import { copyFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const npxExecutable = process.platform === 'win32' ? 'npx.cmd' : path.join(path.dirname(process.execPath), 'npx');

const inputRelativePath = 'public/models/bejroska-hoodie.glb';
const outputRelativePath = 'public/models/bejroska-hoodie.optimized.glb';
const inputPath = path.join(rootDir, inputRelativePath);
const outputPath = path.join(rootDir, outputRelativePath);
async function getSizeInMb(targetPath) {
    const { size } = await stat(targetPath);
    return { bytes: size, mb: size / (1024 * 1024) };
}

async function optimizeModel() {
    const before = await getSizeInMb(inputPath);
    console.log(`[optimize-bejroska-model] input: ${before.mb.toFixed(2)} MB (${before.bytes} bytes)`);

    const args = [
        '--yes',
        '@gltf-transform/cli',
        'optimize',
        inputRelativePath,
        outputRelativePath,
        '--compress',
        'draco',
        '--texture-compress',
        'false',
        '--texture-size',
        '1024',
        '--simplify-ratio',
        '0.35',
        '--simplify-error',
        '0.0005',
    ];
    const quoteForCmd = (arg) => (/\s/.test(arg) ? `"${arg}"` : arg);

    const result =
        process.platform === 'win32'
            ? spawnSync(
                  process.env.ComSpec ?? 'cmd.exe',
                  ['/d', '/s', '/c', `${npxExecutable} ${args.map(quoteForCmd).join(' ')}`],
                  { stdio: 'inherit', cwd: rootDir },
              )
            : spawnSync(npxExecutable, args, { stdio: 'inherit', cwd: rootDir });
    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        throw new Error(`[optimize-bejroska-model] optimize command failed with code ${result.status ?? 'unknown'}`);
    }

    await copyFile(outputPath, inputPath);
    await rm(outputPath, { force: true });

    const after = await getSizeInMb(inputPath);
    const deltaPercent = ((before.bytes - after.bytes) / before.bytes) * 100;
    console.log(
        `[optimize-bejroska-model] output: ${after.mb.toFixed(2)} MB (${after.bytes} bytes), ` +
            `${deltaPercent.toFixed(1)}% smaller`,
    );
}

optimizeModel().catch((error) => {
    console.error('[optimize-bejroska-model] failed', error);
    process.exitCode = 1;
});
