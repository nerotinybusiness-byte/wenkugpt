import { MessageSquare, Sparkles, Code2, Layers } from 'lucide-react';

export default function EmptyState() {
    const features = [
        {
            icon: Sparkles,
            label: "Liquid Glass",
            sub: "Apple Material Design"
        },
        {
            icon: Code2,
            label: "System UI",
            sub: "Native Font Stack"
        },
        {
            icon: Layers,
            label: "Backdrop Blur",
            sub: "Vibrancy & Depth"
        },
        {
            icon: MessageSquare,
            label: "Responsive",
            sub: "Adaptive Layouts"
        }
    ];

    return (
        <div className="flex flex-col items-center justify-center h-full p-8 animate-in fade-in zoom-in duration-700">
            <div className="relative mb-12 group">
                {/* Glow behind logo */}
                <div className="absolute inset-0 bg-blue-500/10 blur-[80px] rounded-full group-hover:bg-blue-500/20 transition-colors duration-1000" />

                <div className="relative w-24 h-24 rounded-[32px] flex items-center justify-center mb-8 mx-auto shadow-2xl ring-1 ring-white/10 bg-white/5 backdrop-blur-3xl">
                    <MessageSquare className="w-10 h-10 text-white/80" strokeWidth={1} />
                </div>

                <h2 className="text-4xl font-medium text-center tracking-tight text-white mb-3" style={{ fontFamily: 'var(--font-ui)' }}>
                    WenkuGPT
                </h2>
                <p className="text-white/40 text-center text-lg font-light tracking-wide">
                    Designed for 2026.
                </p>
            </div>

            <div className="grid grid-cols-2 gap-4 max-w-lg w-full">
                {features.map((feature, i) => (
                    <div
                        key={i}
                        className="p-5 rounded-[24px] text-center hover:bg-white/5 active:scale-[0.98] cursor-pointer transition-all duration-300 group border border-transparent hover:border-white/10 h-auto bg-white/[0.02]"
                    >
                        <div className="flex flex-col items-center gap-3">
                            <feature.icon className="w-6 h-6 text-white/70 group-hover:text-white transition-colors duration-300" strokeWidth={1.5} />
                            <div>
                                <h3 className="font-medium text-[15px] text-white/90 tracking-wide mb-0.5" style={{ fontFamily: 'var(--font-ui)' }}>
                                    {feature.label}
                                </h3>
                                <p className="text-[13px] text-white/40 font-light">
                                    {feature.sub}
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
