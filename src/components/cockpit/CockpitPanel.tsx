'use client';

/**
 * WENKUGPT - Developer Control Center (Cockpit)
 * 
 * Slide-out panel with RAG configuration controls
 */

import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useSettings, RAG_ENGINES, GEMINI_MODELS, CLAUDE_MODELS, type RAGEngineId } from '@/lib/settings/store';

export default function CockpitPanel() {
    const {
        ragEngine,
        vectorWeight,
        topK,
        minRelevance,
        generatorModel,
        auditorModel,
        temperature,
        enableAuditor,
        confidenceThreshold,
        lastStats,
        setRagEngine,
        setVectorWeight,
        setTopK,
        setMinRelevance,
        setGeneratorModel,
        setAuditorModel,
        setTemperature,
        setEnableAuditor,
        setConfidenceThreshold,
        resetToDefaults,
    } = useSettings();

    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="fixed top-4 right-4 z-50 glass"
                >
                    ⚙️ Cockpit
                </Button>
            </SheetTrigger>

            <SheetContent className="glass w-[400px] overflow-y-auto">
                <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                        🎛️ Developer Cockpit
                    </SheetTitle>
                    <SheetDescription>
                        Real-time RAG nastavení
                    </SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-8">
                    {/* Search Weights */}
                    <section className="space-y-4">
                        <h3 className="text-sm font-semibold text-white/80 flex items-center gap-2">
                            🔍 Hybrid Search
                        </h3>

                        <div className="glass-light p-4 rounded-xl space-y-4">
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                    <Label>Vector / Text váha</Label>
                                    <span className="font-mono text-white/60">
                                        {Math.round(vectorWeight * 100)}% / {Math.round((1 - vectorWeight) * 100)}%
                                    </span>
                                </div>
                                <Slider
                                    value={[vectorWeight]}
                                    onValueChange={([v]) => setVectorWeight(v)}
                                    min={0}
                                    max={1}
                                    step={0.05}
                                    className="w-full"
                                />
                                <p className="text-xs text-white/40">
                                    Vlevo: více sémantické, vpravo: více keyword
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Reranker Settings */}
                    <section className="space-y-4">
                        <h3 className="text-sm font-semibold text-white/80 flex items-center gap-2">
                            🎯 Cohere Reranker
                        </h3>

                        <div className="glass-light p-4 rounded-xl space-y-4">
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                    <Label>Top K výsledků</Label>
                                    <span className="font-mono text-white/60">{topK}</span>
                                </div>
                                <Slider
                                    value={[topK]}
                                    onValueChange={([v]) => setTopK(v)}
                                    min={3}
                                    max={20}
                                    step={1}
                                    className="w-full"
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                    <Label>Min. relevance</Label>
                                    <span className="font-mono text-white/60">{minRelevance.toFixed(2)}</span>
                                </div>
                                <Slider
                                    value={[minRelevance]}
                                    onValueChange={([v]) => setMinRelevance(v)}
                                    min={0.1}
                                    max={0.9}
                                    step={0.05}
                                    className="w-full"
                                />
                            </div>
                        </div>
                    </section>

                    {/* Model Selection */}
                    <section className="space-y-4">
                        <h3 className="text-sm font-semibold text-white/80 flex items-center gap-2">
                            🤖 Modely
                        </h3>

                        <div className="glass-light p-4 rounded-xl space-y-4">
                            <div className="space-y-2">
                                <Label className="text-xs">RAG Engine</Label>
                                <Select value={ragEngine} onValueChange={(value) => setRagEngine(value as RAGEngineId)}>
                                    <SelectTrigger className="w-full bg-white/5">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {RAG_ENGINES.map(engine => (
                                            <SelectItem key={engine.id} value={engine.id}>
                                                <div className="flex flex-col">
                                                    <span>{engine.name}</span>
                                                    <span className="text-xs text-white/50">{engine.description}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Generator Model */}
                            <div className="space-y-2">
                                <Label className="text-xs">Generator (Gemini)</Label>
                                <Select value={generatorModel} onValueChange={setGeneratorModel}>
                                    <SelectTrigger className="w-full bg-white/5">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {GEMINI_MODELS.map(model => (
                                            <SelectItem key={model.id} value={model.id}>
                                                <div className="flex flex-col">
                                                    <span>{model.name}</span>
                                                    <span className="text-xs text-white/50">{model.description}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Auditor Model */}
                            <div className="space-y-2">
                                <Label className="text-xs">Auditor (Claude)</Label>
                                <Select value={auditorModel} onValueChange={setAuditorModel}>
                                    <SelectTrigger className="w-full bg-white/5">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CLAUDE_MODELS.map(model => (
                                            <SelectItem key={model.id} value={model.id}>
                                                <div className="flex flex-col">
                                                    <span>{model.name}</span>
                                                    <span className="text-xs text-white/50">{model.description}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Temperature */}
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                    <Label>Temperature</Label>
                                    <span className="font-mono text-white/60">{temperature.toFixed(1)}</span>
                                </div>
                                <Slider
                                    value={[temperature]}
                                    onValueChange={([v]) => setTemperature(v)}
                                    min={0}
                                    max={1}
                                    step={0.1}
                                    className="w-full"
                                />
                                <p className="text-xs text-white/40">
                                    0 = deterministické, 1 = kreativní
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Verification Settings */}
                    <section className="space-y-4">
                        <h3 className="text-sm font-semibold text-white/80 flex items-center gap-2">
                            🧐 Auditor Kontrola
                        </h3>

                        <div className="glass-light p-4 rounded-xl space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="text-xs">Povolit NLI verifikaci</Label>
                                    <p className="text-xs text-white/40">
                                        Claude kontroluje fakta
                                    </p>
                                </div>
                                <Switch
                                    checked={enableAuditor}
                                    onCheckedChange={setEnableAuditor}
                                />
                            </div>

                            {enableAuditor && (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs">
                                        <Label>Min. confidence</Label>
                                        <span className="font-mono text-white/60">
                                            {Math.round(confidenceThreshold * 100)}%
                                        </span>
                                    </div>
                                    <Slider
                                        value={[confidenceThreshold]}
                                        onValueChange={([v]) => setConfidenceThreshold(v)}
                                        min={0.5}
                                        max={0.99}
                                        step={0.01}
                                        className="w-full"
                                    />
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Analytics */}
                    {lastStats && (
                        <section className="space-y-4">
                            <h3 className="text-sm font-semibold text-white/80 flex items-center gap-2">
                                📊 Poslední dotaz
                            </h3>

                            <div className="glass-light p-4 rounded-xl">
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    <div>
                                        <span className="text-white/40">Retrieval</span>
                                        <p className="font-mono">{lastStats.retrievalTimeMs.toFixed(0)}ms</p>
                                    </div>
                                    <div>
                                        <span className="text-white/40">Generation</span>
                                        <p className="font-mono">{lastStats.generationTimeMs.toFixed(0)}ms</p>
                                    </div>
                                    <div>
                                        <span className="text-white/40">Verification</span>
                                        <p className="font-mono">{lastStats.verificationTimeMs.toFixed(0)}ms</p>
                                    </div>
                                    <div>
                                        <span className="text-white/40">Total</span>
                                        <p className="font-mono font-semibold">{lastStats.totalTimeMs.toFixed(0)}ms</p>
                                    </div>
                                    <div>
                                        <span className="text-white/40">Chunks</span>
                                        <p className="font-mono">{lastStats.chunksRetrieved} → {lastStats.chunksUsed}</p>
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}

                    {/* Reset Button */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={resetToDefaults}
                        className="w-full text-white/50 hover:text-white/80"
                    >
                        ↺ Reset na výchozí
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
}
