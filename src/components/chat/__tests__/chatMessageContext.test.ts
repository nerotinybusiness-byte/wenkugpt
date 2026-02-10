import { describe, expect, it } from 'vitest';
import { buildFooterCitationContext, buildInlineCitationContext } from '../ChatMessage';

describe('buildInlineCitationContext', () => {
    it('returns local snippet around citation marker', () => {
        const content = 'Prvni veta. Dulezite tvrzeni o skladu [1]. Dalsi veta.';
        const marker = '[1]';
        const index = content.indexOf(marker);
        const context = buildInlineCitationContext(content, index, marker.length);

        expect(context).toContain('Dulezite tvrzeni o skladu');
        expect(context).not.toContain('Prvni veta.');
    });
});

describe('buildFooterCitationContext', () => {
    it('prefers highlight text when available', () => {
        const content = 'Text odpovedi s citaci [1].';
        const highlightText = 'Toto je preferovany snippet z ingestu.';
        const context = buildFooterCitationContext(content, '1', highlightText);
        expect(context).toBe('Toto je preferovany snippet z ingestu.');
    });

    it('falls back to local citation snippet when highlight text is missing', () => {
        const content = 'Uvod. Tady je jadro tvrzeni [2]. Konec.';
        const context = buildFooterCitationContext(content, '2', null);
        expect(context).toContain('Tady je jadro tvrzeni');
    });
});
