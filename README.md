# 📂 WenkuGPT

**Advanced RAG (Retrieval-Augmented Generation) Platform for Documents.**

WenkuGPT is a professional document intelligence system built with Next.js, featuring a sophisticated "Liquid Glass" design and a robust verification pipeline.

## ✨ Key Features
- **Semantic PDF Search**: Deep search through documents using hybrid vector/text retrieval.
- **Sophisticated PDF Viewer**: Integrated viewer with precision-aligned highlights based on RAG citations.
- **Auditor Loop**: Triple-agent verification system (Generator, Auditor, Verifier) to eliminate hallucinations.
- **Liquid Glass UI**: Stunning 2026-era aesthetics with vibrant animations and micro-interactions.
- **Hybrid Search Tuning**: Fine-tune the balance between semantic meaning and keyword precision.

## 🛠 Tech Stack
- **Framework**: Next.js 14+ (App Router)
- **Styling**: Tailwind CSS + Shadcn UI
- **Database**: Supabase (PostgreSQL + pgvector)
- **AI Models**: Google Gemini 2.0 & Claude 3.5
- **Icons**: Lucide React

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 18+
- Supabase project (with pgvector enabled)
- Google AI (Gemini) API Key
- Anthropic (Claude) API Key (optional for Auditor Loop)

### 2. Environment Setup
Create a `.env.local` file with the following:
```env
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
GOOGLE_AI_API_KEY=your_gemini_key
ANTHROPIC_API_KEY=your_claude_key
```

### 3. Installation
```bash
npm install
```

### 4. Database Migration
```bash
npx drizzle-kit push
```

### 5. Run Development Server
```bash
npm run dev
```

## 📄 License
MIT
