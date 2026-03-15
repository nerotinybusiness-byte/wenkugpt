'use client';

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogClose
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Settings, RotateCcw } from "lucide-react";
import {
    useSettings,
    RAG_ENGINES,
    OCR_ENGINES,
    AMBIGUITY_POLICIES,
    GEMINI_MODELS,
    CLAUDE_MODELS,
    type OcrEngineId,
    type RAGEngineId,
    type AmbiguityPolicyId,
} from "@/lib/settings/store";
import { useState } from "react";
import { useShallow } from 'zustand/react/shallow';
import { useTheme } from "next-themes";

export function SettingsDialog() {
    const settings = useSettings(useShallow((state) => ({
        ragEngine: state.ragEngine,
        contextScope: state.contextScope,
        effectiveAt: state.effectiveAt,
        ambiguityPolicy: state.ambiguityPolicy,
        generatorModel: state.generatorModel,
        auditorModel: state.auditorModel,
        enableAuditor: state.enableAuditor,
        temperature: state.temperature,
        topK: state.topK,
        vectorWeight: state.vectorWeight,
        textWeight: state.textWeight,
        confidenceThreshold: state.confidenceThreshold,
        emptyChunkOcrEnabled: state.emptyChunkOcrEnabled,
        emptyChunkOcrEngine: state.emptyChunkOcrEngine,
        setRagEngine: state.setRagEngine,
        setContextScopeField: state.setContextScopeField,
        setEffectiveAt: state.setEffectiveAt,
        setAmbiguityPolicy: state.setAmbiguityPolicy,
        setGeneratorModel: state.setGeneratorModel,
        setAuditorModel: state.setAuditorModel,
        setEnableAuditor: state.setEnableAuditor,
        setTemperature: state.setTemperature,
        setTopK: state.setTopK,
        setVectorWeight: state.setVectorWeight,
        setTextWeight: state.setTextWeight,
        setConfidenceThreshold: state.setConfidenceThreshold,
        setEmptyChunkOcrEnabled: state.setEmptyChunkOcrEnabled,
        setEmptyChunkOcrEngine: state.setEmptyChunkOcrEngine,
        resetToDefaults: state.resetToDefaults,
    })));

    const { theme, setTheme, resolvedTheme } = useTheme();

    const [isOpen, setIsOpen] = useState(false);

    // Helper to format percentage
    const formatPercent = (val: number) => `${Math.round(val * 100)}%`;

    // Colors based on theme
    const isDark = resolvedTheme === 'dark';
    const bgColor = isDark ? 'bg-[#1b1b1d]' : 'bg-[#ffffff]';
    const textColor = isDark ? 'text-[#e1e1e1]' : 'text-[#1b1b1d]';
    const subTextColor = isDark ? 'text-[#a1a1aa]' : 'text-[#52525b]';
    const borderColor = isDark ? 'border-[#27272a]' : 'border-[#e4e4e7]';
    const actionColor = isDark ? 'text-[#aaff00]' : 'text-[#65a30d]';
    // Improved Slider Styles: Targeting data-slots directly for reliability
    const sliderStyles = isDark
        ? "[&_[data-slot=slider-track]]:bg-[#27272a] [&_[data-slot=slider-range]]:bg-[#aaff00] [&_[data-slot=slider-thumb]]:border-[#aaff00]"
        : "[&_[data-slot=slider-track]]:bg-[#e4e4e7] [&_[data-slot=slider-range]]:bg-[#65a30d] [&_[data-slot=slider-thumb]]:border-[#65a30d]";
    const ingestSwitchStyles = isDark
        ? "data-[state=checked]:bg-[#aaff00] data-[state=unchecked]:bg-[#3f3f46] border border-[#71717a]"
        : "data-[state=checked]:bg-[#65a30d] data-[state=unchecked]:bg-[#d4d4d8] border border-[#a1a1aa]";

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[var(--c-glass)]/20 transition-colors text-[var(--c-content)] hover:text-[var(--c-action)] group active:scale-95">
                    <Settings size={20} className="transition-transform duration-200 group-hover:rotate-90" />
                    <div className="text-sm font-medium">Settings</div>
                </button>
            </DialogTrigger>
            <DialogContent
                className={`max-w-2xl max-h-[90vh] overflow-y-auto border backdrop-blur-xl shadow-2xl transition-colors duration-200
                ${bgColor} ${textColor} ${borderColor}
                `}
            >
                <DialogHeader>
                    <DialogTitle className={`text-2xl font-bold flex items-center gap-2 ${actionColor}`}>
                        <Settings className="w-6 h-6" />
                        RAG Configuration
                    </DialogTitle>
                    <DialogDescription className={`text-sm ${subTextColor}`}>
                        Customize the behavior of the retrieval and generation pipeline.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-8 py-4">

                    {/* SECTION 1: MODELS */}
                    <div className="space-y-4">
                        <h3 className={`text-sm font-semibold uppercase tracking-wider border-b pb-2 ${subTextColor} ${borderColor}`}>
                            Model Selection
                        </h3>

                        <div className="grid gap-4 md:grid-cols-2">
                            {/* RAG Engine */}
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="rag-engine" className={textColor}>RAG Engine</Label>
                                <Select value={settings.ragEngine} onValueChange={(value) => settings.setRagEngine(value as RAGEngineId)}>
                                    <SelectTrigger id="rag-engine" className={`w-full ${isDark ? 'bg-[#27272a] border-[#3f3f46]' : 'bg-[#f4f4f5] border-[#e4e4e7]'} ${textColor}`}>
                                        <SelectValue placeholder="Select RAG engine" />
                                    </SelectTrigger>
                                    <SelectContent position="popper" className={`${bgColor} ${borderColor} ${textColor} shadow-xl max-h-[300px]`}>
                                        {RAG_ENGINES.map((engine) => (
                                            <SelectItem key={engine.id} value={engine.id} className="focus:bg-accent focus:text-accent-foreground">
                                                <div className="flex flex-col items-start text-left py-1">
                                                    <span className="font-medium text-sm">{engine.name}</span>
                                                    <span className="text-xs opacity-70">{engine.description}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Generator Model */}
                            <div className="space-y-2">
                                <Label htmlFor="generator-model" className={textColor}>Generator (Answer)</Label>
                                <Select value={settings.generatorModel} onValueChange={settings.setGeneratorModel}>
                                    <SelectTrigger id="generator-model" className={`w-full ${isDark ? 'bg-[#27272a] border-[#3f3f46]' : 'bg-[#f4f4f5] border-[#e4e4e7]'} ${textColor}`}>
                                        <SelectValue placeholder="Select model" />
                                    </SelectTrigger>
                                    <SelectContent position="popper" className={`${bgColor} ${borderColor} ${textColor} shadow-xl max-h-[300px]`}>
                                        {GEMINI_MODELS.map((model) => (
                                            <SelectItem key={model.id} value={model.id} className="focus:bg-accent focus:text-accent-foreground">
                                                <div className="flex flex-col items-start text-left py-1">
                                                    <span className="font-medium text-sm">{model.name}</span>
                                                    <span className="text-xs opacity-70">{model.description}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Auditor Model */}
                            <div className="space-y-2 opacity-100 transition-opacity duration-200" style={{ opacity: settings.enableAuditor ? 1 : 0.5, pointerEvents: settings.enableAuditor ? 'auto' : 'none' }}>
                                <Label htmlFor="auditor-model" className={textColor}>Auditor (Verifier)</Label>
                                <Select value={settings.auditorModel} onValueChange={settings.setAuditorModel}>
                                    <SelectTrigger id="auditor-model" className={`w-full ${isDark ? 'bg-[#27272a] border-[#3f3f46]' : 'bg-[#f4f4f5] border-[#e4e4e7]'} ${textColor}`}>
                                        <SelectValue placeholder="Select model" />
                                    </SelectTrigger>
                                    <SelectContent position="popper" className={`${bgColor} ${borderColor} ${textColor} shadow-xl max-h-[300px]`}>
                                        {CLAUDE_MODELS.map((model) => (
                                            <SelectItem key={model.id} value={model.id} className="focus:bg-accent focus:text-accent-foreground">
                                                <div className="flex flex-col items-start text-left py-1">
                                                    <span className="font-medium text-sm">{model.name}</span>
                                                    <span className="text-xs opacity-70">{model.description}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 2: PARAMETERS */}
                    <div className="space-y-6">
                        <h3 className={`text-sm font-semibold uppercase tracking-wider border-b pb-2 ${subTextColor} ${borderColor}`}>
                            Parameters
                        </h3>

                        {/* Temperature */}
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <Label className={textColor}>Temperature (Creativity)</Label>
                                <span className={`text-sm ${subTextColor}`}>{settings.temperature.toFixed(1)}</span>
                            </div>
                            <Slider
                                value={[settings.temperature]}
                                min={0}
                                max={1}
                                step={0.1}
                                onValueChange={([val]) => settings.setTemperature(val)}
                                className={sliderStyles}
                            />
                            <p className={`text-xs ${subTextColor}`}>
                                Lower values are more deterministic. Higher values are more creative but may hallucinate more.
                            </p>
                        </div>

                        {/* Top K */}
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <Label className={textColor}>Context Window (Top K Chunks)</Label>
                                <span className={`text-sm ${subTextColor}`}>{settings.topK}</span>
                            </div>
                            <Slider
                                value={[settings.topK]}
                                min={1}
                                max={20}
                                step={1}
                                onValueChange={([val]) => settings.setTopK(val)}
                                className={sliderStyles}
                            />
                        </div>

                        {/* Search Weights */}
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <Label className={textColor}>Hybrid Search Weights</Label>
                                <span className={`text-sm ${subTextColor}`}>
                                    Vector: {formatPercent(settings.vectorWeight)} / Keyword: {formatPercent(settings.textWeight)}
                                </span>
                            </div>
                            <Slider
                                value={[settings.vectorWeight]}
                                min={0}
                                max={1}
                                step={0.1}
                                onValueChange={([val]) => settings.setVectorWeight(val)}
                                className={sliderStyles}
                            />
                            <div className={`flex justify-between text-xs ${subTextColor}`}>
                                <span>Full-Text (Keywords)</span>
                                <span>Semantic (Vector)</span>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 3: V2 CONTEXT */}
                    <div className="space-y-4">
                        <h3 className={`text-sm font-semibold uppercase tracking-wider border-b pb-2 ${subTextColor} ${borderColor}`}>
                            V2 Context (Scope/Time)
                        </h3>

                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label className={textColor}>Team</Label>
                                <Input
                                    value={settings.contextScope.team}
                                    onChange={(event) => settings.setContextScopeField('team', event.target.value)}
                                    placeholder="e.g. compliance"
                                    className={`${isDark ? 'bg-[#27272a] border-[#3f3f46]' : 'bg-[#f4f4f5] border-[#e4e4e7]'} ${textColor}`}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className={textColor}>Product</Label>
                                <Input
                                    value={settings.contextScope.product}
                                    onChange={(event) => settings.setContextScopeField('product', event.target.value)}
                                    placeholder="e.g. release-gate"
                                    className={`${isDark ? 'bg-[#27272a] border-[#3f3f46]' : 'bg-[#f4f4f5] border-[#e4e4e7]'} ${textColor}`}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className={textColor}>Region</Label>
                                <Input
                                    value={settings.contextScope.region}
                                    onChange={(event) => settings.setContextScopeField('region', event.target.value)}
                                    placeholder="e.g. eu"
                                    className={`${isDark ? 'bg-[#27272a] border-[#3f3f46]' : 'bg-[#f4f4f5] border-[#e4e4e7]'} ${textColor}`}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className={textColor}>Process</Label>
                                <Input
                                    value={settings.contextScope.process}
                                    onChange={(event) => settings.setContextScopeField('process', event.target.value)}
                                    placeholder="e.g. deploy"
                                    className={`${isDark ? 'bg-[#27272a] border-[#3f3f46]' : 'bg-[#f4f4f5] border-[#e4e4e7]'} ${textColor}`}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className={textColor}>Effective At (ISO / datetime-local)</Label>
                            <Input
                                type="datetime-local"
                                value={settings.effectiveAt}
                                onChange={(event) => settings.setEffectiveAt(event.target.value)}
                                className={`${isDark ? 'bg-[#27272a] border-[#3f3f46]' : 'bg-[#f4f4f5] border-[#e4e4e7]'} ${textColor}`}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className={textColor}>Ambiguity Policy</Label>
                            <Select
                                value={settings.ambiguityPolicy}
                                onValueChange={(value) => settings.setAmbiguityPolicy(value as AmbiguityPolicyId)}
                            >
                                <SelectTrigger className={`w-full ${isDark ? 'bg-[#27272a] border-[#3f3f46]' : 'bg-[#f4f4f5] border-[#e4e4e7]'} ${textColor}`}>
                                    <SelectValue placeholder="Select ambiguity policy" />
                                </SelectTrigger>
                                <SelectContent position="popper" className={`${bgColor} ${borderColor} ${textColor} shadow-xl max-h-[300px]`}>
                                    {AMBIGUITY_POLICIES.map((policy) => (
                                        <SelectItem key={policy.id} value={policy.id} className="focus:bg-accent focus:text-accent-foreground">
                                            <div className="flex flex-col items-start text-left py-1">
                                                <span className="font-medium text-sm">{policy.name}</span>
                                                <span className="text-xs opacity-70">{policy.description}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* SECTION 4: VERIFICATION */}
                    <div className="space-y-4">
                        <h3 className={`text-sm font-semibold uppercase tracking-wider border-b pb-2 ${subTextColor} ${borderColor}`}>
                            Verification & Safety
                        </h3>

                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className={textColor}>Enable Auditor Loop</Label>
                                <p className={`text-xs ${subTextColor}`}>
                                    Uses a second agent to verify claims against sources. Increases latency but reduces hallucinations.
                                </p>
                            </div>
                            <Switch checked={settings.enableAuditor} onCheckedChange={settings.setEnableAuditor} />
                        </div>

                        <div className="space-y-3 pt-2" style={{ opacity: settings.enableAuditor ? 1 : 0.5, pointerEvents: settings.enableAuditor ? 'auto' : 'none' }}>
                            <div className="flex justify-between">
                                <Label className={textColor}>Confidence Threshold</Label>
                                <span className={`text-sm ${subTextColor}`}>{formatPercent(settings.confidenceThreshold)}</span>
                            </div>
                            <Slider
                                value={[settings.confidenceThreshold]}
                                min={0.5}
                                max={1.0}
                                step={0.05}
                                onValueChange={([val]) => settings.setConfidenceThreshold(val)}
                                className={sliderStyles}
                            />
                        </div>
                    </div>

                    {/* SECTION 5: INGEST */}
                    <div className="space-y-4">
                        <h3 className={`text-sm font-semibold uppercase tracking-wider border-b pb-2 ${subTextColor} ${borderColor}`}>
                            Ingest
                        </h3>

                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className={textColor}>OCR rescue for empty/low PDF chunks</Label>
                                <p className={`text-xs ${subTextColor}`}>
                                    Applies only to PDF uploads when the first chunking pass returns zero or very few chunks.
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => settings.setEmptyChunkOcrEnabled(!settings.emptyChunkOcrEnabled)}
                                    className={`${isDark ? 'border-[#71717a] text-[#e4e4e7] hover:bg-[#27272a]' : 'border-[#a1a1aa] text-[#27272a] hover:bg-[#f4f4f5]'} h-8 px-3 text-xs font-semibold`}
                                >
                                    {settings.emptyChunkOcrEnabled ? 'ON' : 'OFF'}
                                </Button>
                                <Switch
                                    checked={settings.emptyChunkOcrEnabled}
                                    onCheckedChange={settings.setEmptyChunkOcrEnabled}
                                    className={ingestSwitchStyles}
                                    aria-label="OCR rescue on/off"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="ocr-engine" className={textColor}>OCR engine for rescue</Label>
                            <Select
                                value={settings.emptyChunkOcrEngine}
                                onValueChange={(value) => settings.setEmptyChunkOcrEngine(value as OcrEngineId)}
                                disabled={!settings.emptyChunkOcrEnabled}
                            >
                                <SelectTrigger
                                    id="ocr-engine"
                                    className={`w-full ${isDark ? 'bg-[#27272a] border-[#3f3f46]' : 'bg-[#f4f4f5] border-[#e4e4e7]'} ${textColor}`}
                                >
                                    <SelectValue placeholder="Select OCR engine" />
                                </SelectTrigger>
                                <SelectContent position="popper" className={`${bgColor} ${borderColor} ${textColor} shadow-xl max-h-[300px]`}>
                                    {OCR_ENGINES.map((engine) => (
                                        <SelectItem key={engine.id} value={engine.id} className="focus:bg-accent focus:text-accent-foreground">
                                            <div className="flex flex-col items-start text-left py-1">
                                                <span className="font-medium text-sm">{engine.name}</span>
                                                <span className="text-xs opacity-70">{engine.description}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* SECTION 6: APPEARANCE */}
                    <div className="space-y-4">
                        <h3 className={`text-sm font-semibold uppercase tracking-wider border-b pb-2 ${subTextColor} ${borderColor}`}>
                            Appearance
                        </h3>

                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <Label className={`text-base ${textColor}`}>Light Mode</Label>
                                <p className={`text-xs ${subTextColor}`}>
                                    Switch between light and dark theme aesthetics.
                                </p>
                            </div>
                            <Switch
                                checked={resolvedTheme === 'light' || theme === 'light'}
                                onCheckedChange={(checked) => setTheme(checked ? 'light' : 'dark')}
                            />
                        </div>
                    </div>

                </div>

                <DialogFooter className="sm:justify-between gap-4">
                    <Button
                        variant="ghost"
                        onClick={settings.resetToDefaults}
                        className="text-muted-foreground hover:text-destructive flex items-center gap-2"
                    >
                        <RotateCcw size={16} />
                        Reset Defaults
                    </Button>
                    <DialogClose asChild>
                        <Button type="button" className={`text-black hover:opacity-90 ${isDark ? 'bg-[#aaff00]' : 'bg-[#65a30d] text-white'}`}>
                            Save Changes
                        </Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
