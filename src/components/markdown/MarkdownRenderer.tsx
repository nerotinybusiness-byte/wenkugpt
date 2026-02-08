
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface MarkdownRendererProps {
    content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
                code({ node, inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '');
                    return !inline && match ? (
                        <SyntaxHighlighter
                            style={vscDarkPlus}
                            language={match[1]}
                            PreTag="div"
                            {...props}
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
                a: ({ node, ...props }) => (
                    <a className="text-[var(--c-action)] hover:underline" {...props} />
                ),
                // Style headings
                h1: ({ node, ...props }) => <h1 className="text-2xl font-bold my-4" {...props} />,
                h2: ({ node, ...props }) => <h2 className="text-xl font-bold my-3" {...props} />,
                h3: ({ node, ...props }) => <h3 className="text-lg font-bold my-2" {...props} />,
                // Style lists
                ul: ({ node, ...props }) => <ul className="list-disc list-inside my-2" {...props} />,
                ol: ({ node, ...props }) => <ol className="list-decimal list-inside my-2" {...props} />,
            }}
        >
            {content}
        </ReactMarkdown>
    );
};
