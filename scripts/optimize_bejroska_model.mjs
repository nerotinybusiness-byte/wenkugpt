import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const npxExecutable = process.platform === 'win32' ? 'npx.cmd' : path.join(path.dirname(process.execPath), 'npx');

const inputRelativePath = 'public/models/bejroska-hoodie.glb';
const fastOutputRelativePath = 'public/models/bejroska-hoodie-fast.glb';
const dracoOutputRelativePath = 'public/models/bejroska-hoodie-draco.glb';
const inputPath = path.join(rootDir, inputRelativePath);
const fastOutputPath = path.join(rootDir, fastOutputRelativePath);
const dracoOutputPath = path.join(rootDir, dracoOutputRelativePath);
async function getSizeInMb(targetPath) {
    const { size } = await stat(targetPath);
    return { bytes: size, mb: size / (1024 * 1024) };
}

function runCli(args, stepName) {
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
        throw new Error(`[optimize-bejroska-model] ${stepName} failed with code ${result.status ?? 'unknown'}`);
    }
}

async function optimizeModel() {
    const source = await getSizeInMb(inputPath);
    console.log(`[optimize-bejroska-model] source: ${source.mb.toFixed(2)} MB (${source.bytes} bytes)`);

    runCli(['--yes', '@gltf-transform/cli', 'copy', inputRelativePath, fastOutputRelativePath], 'copy to fast');
    runCli(['--yes', '@gltf-transform/cli', 'draco', fastOutputRelativePath, dracoOutputRelativePath], 'encode draco');

    const fast = await getSizeInMb(fastOutputPath);
    const draco = await getSizeInMb(dracoOutputPath);
    const dracoDelta = ((fast.bytes - draco.bytes) / fast.bytes) * 100;
    console.log(`[optimize-bejroska-model] fast:  ${fast.mb.toFixed(2)} MB (${fast.bytes} bytes)`);
    console.log(
        `[optimize-bejroska-model] draco: ${draco.mb.toFixed(2)} MB (${draco.bytes} bytes), ${dracoDelta.toFixed(1)}% smaller vs fast`,
    );
}

optimizeModel().catch((error) => {
    console.error('[optimize-bejroska-model] failed', error);
    process.exitCode = 1;
});
