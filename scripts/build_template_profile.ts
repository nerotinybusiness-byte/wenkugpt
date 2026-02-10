import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { parseDocument } from '../src/lib/ingest/parser';
import {
    computePageVisualHash,
    computeSampledPageNumbers,
    computeTextTokenHash,
    type TemplateAnchor,
    type TemplatePageFingerprint,
    type TemplateProfile,
} from '../src/lib/ingest/template';

dotenv.config({ path: '.env.local' });
dotenv.config();

interface CliArgs {
    inputPath: string;
    profileId: string;
    profileName: string;
    description?: string;
    outputPath: string;
    threshold: number;
}

function normalizeText(value: string): string {
    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function parseArgs(argv: string[]): CliArgs {
    if (argv.length === 0) {
        throw new Error('Usage: npx tsx scripts/build_template_profile.ts <pdf-path> [--profile-id id] [--name "Profile Name"] [--description "text"] [--output path] [--threshold 0.65]');
    }

    const inputPath = argv[0];
    const args = argv.slice(1);

    const readOption = (name: string): string | undefined => {
        const index = args.findIndex((arg) => arg === name);
        if (index === -1) return undefined;
        return args[index + 1];
    };

    const profileId = readOption('--profile-id') ?? path.basename(inputPath, path.extname(inputPath)).toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const profileName = readOption('--name') ?? `Template ${profileId}`;
    const description = readOption('--description');
    const outputPath = readOption('--output') ?? path.join(process.cwd(), 'config', 'template-profiles', `${profileId}.json`);
    const thresholdRaw = Number(readOption('--threshold') ?? '0.65');
    const threshold = Number.isFinite(thresholdRaw) ? Math.max(0.4, Math.min(0.95, thresholdRaw)) : 0.65;

    return {
        inputPath,
        profileId,
        profileName,
        description,
        outputPath,
        threshold,
    };
}

function collectAnchorCandidates(documentPages: Awaited<ReturnType<typeof parseDocument>>['pages']): TemplateAnchor[] {
    const rows: Array<{ text: string; normalized: string; page: number; region: { x: number; y: number; width: number; height: number } }> = [];

    for (const page of documentPages) {
        for (const block of page.textBlocks) {
            const text = block.text.replace(/\s+/g, ' ').trim();
            if (text.length < 6 || text.length > 140) continue;
            const normalized = normalizeText(text);
            if (normalized.length < 6) continue;
            if (/^\d+$/.test(normalized)) continue;
            rows.push({
                text,
                normalized,
                page: page.pageNumber,
                region: block.bbox,
            });
        }
    }

    const frequency = new Map<string, { count: number; first: typeof rows[number] }>();
    for (const row of rows) {
        const existing = frequency.get(row.normalized);
        if (!existing) {
            frequency.set(row.normalized, { count: 1, first: row });
        } else {
            existing.count += 1;
        }
    }

    return [...frequency.entries()]
        .map(([, value]) => ({
            count: value.count,
            first: value.first,
            score: (value.count * 2) + Math.min(value.first.text.length / 50, 1),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 12)
        .map((entry) => ({
            text: entry.first.text,
            page: entry.first.page,
            region: entry.first.region,
            weight: Math.min(1.5, 0.8 + (entry.count * 0.2)),
        }));
}

async function main() {
    const cli = parseArgs(process.argv.slice(2));
    const buffer = await fs.readFile(cli.inputPath);
    const document = await parseDocument(buffer, 'application/pdf');

    const sampledPages = computeSampledPageNumbers(document.pageCount);
    const sampledFingerprints: TemplatePageFingerprint[] = sampledPages
        .map((pageNumber) => document.pages.find((page) => page.pageNumber === pageNumber))
        .filter((page): page is (typeof document.pages)[number] => Boolean(page))
        .map((page) => ({
            page: page.pageNumber,
            visualHash: computePageVisualHash(page),
            tokenHash: computeTextTokenHash(page.textBlocks.map((block) => block.text).join(' ')),
        }));

    const anchors = collectAnchorCandidates(document.pages);
    const boilerplatePatterns = anchors
        .map((anchor) => normalizeText(anchor.text))
        .filter((pattern) => pattern.length >= 6)
        .slice(0, 14);

    const profile: TemplateProfile = {
        id: cli.profileId,
        version: 1,
        name: cli.profileName,
        description: cli.description,
        matchThreshold: cli.threshold,
        anchors,
        boilerplatePatterns,
        sampledPages: sampledFingerprints,
        metadata: {
            generatedAt: new Date().toISOString(),
            sourcePath: cli.inputPath,
            pageCount: document.pageCount,
            sampledPages: sampledPages.length,
        },
    };

    await fs.mkdir(path.dirname(cli.outputPath), { recursive: true });
    await fs.writeFile(cli.outputPath, `${JSON.stringify(profile, null, 2)}\n`, 'utf-8');

    console.log(`template_profile_written=${cli.outputPath}`);
    console.log(`profile_id=${profile.id}`);
    console.log(`anchors=${profile.anchors.length}`);
    console.log(`sampled_pages=${profile.sampledPages?.length ?? 0}`);
}

void main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`build_template_profile_failed=${message}`);
    process.exit(1);
});
