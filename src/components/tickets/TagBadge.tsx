import React from 'react';

interface TagBadgeProps {
  tag: string | null;
}

export default function TagBadge({ tag }: TagBadgeProps) {
  if (!tag) return null;

  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
      {tag}
    </span>
  );
} 