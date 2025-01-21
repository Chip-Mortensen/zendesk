'use client';

import dynamic from 'next/dynamic';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

// Dynamically import the editor to avoid SSR issues
const MDEditor = dynamic(
  () => import('@uiw/react-md-editor').then((mod) => mod.default),
  { ssr: false }
);

interface MarkdownEditorProps {
  value: string;
  onChange?: (value: string) => void;
  preview?: boolean;
  height?: number;
}

export function MarkdownEditor({ value, onChange, preview = false, height = 400 }: MarkdownEditorProps) {
  if (preview) {
    return (
      <div className="prose prose-slate max-w-none dark:prose-invert">
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]} 
          rehypePlugins={[rehypeRaw]}
        >
          {value}
        </ReactMarkdown>
      </div>
    );
  }

  return (
    <div data-color-mode="light" className="text-gray-900">
      <MDEditor
        value={value}
        onChange={(val) => onChange?.(val || '')}
        preview="live"
        height={height}
        hideToolbar={false}
        enableScroll={true}
      />
    </div>
  );
} 