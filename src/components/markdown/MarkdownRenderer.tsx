
import React from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface MarkdownRendererProps {
    content: string;
}

const syntaxHighlighterStyle = vscDarkPlus as { [key: string]: React.CSSProperties };

const markdownComponents: Components = {
    code({ className, children, ...props }) {
        const match = /language-(\w+)/.exec(className || '');
        return match ? (
            <SyntaxHighlighter
                style={syntaxHighlighterStyle}
                language={match[1]}
                PreTag="div"
            >
                {String(children).replace(/\n$/, '')}
            </SyntaxHighlighter>
        ) : (
            <code className={className} {...props}>
                {children}
            </code>
        );
    },
    // Style links to match the theme
    a: (props) => <a className="text-[var(--c-action)] hover:underline" {...props} />,
    // Style headings
    h1: (props) => <h1 className="text-2xl font-bold my-4" {...props} />,
    h2: (props) => <h2 className="text-xl font-bold my-3" {...props} />,
    h3: (props) => <h3 className="text-lg font-bold my-2" {...props} />,
    // Style lists
    ul: (props) => <ul className="list-disc list-inside my-2" {...props} />,
    ol: (props) => <ol className="list-decimal list-inside my-2" {...props} />,
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={markdownComponents}
        >
            {content}
        </ReactMarkdown>
    );
};
