import React from 'react';

interface TagBadgeProps {
  tag: string | null | undefined;
}

export default function TagBadge({ tag }: TagBadgeProps) {
  if (!tag) return null;

  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
      {tag}
    </span>
  );
} 