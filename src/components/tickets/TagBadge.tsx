import React from 'react';

interface TagBadgeProps {
  tag: string | null | undefined;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'px-2.5 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-base'
};

export default function TagBadge({ tag, size = 'sm' }: TagBadgeProps) {
  if (!tag) return null;

  return (
    <span className={`inline-flex items-center rounded-full font-medium bg-blue-100 text-blue-700 border border-blue-200 ${sizeClasses[size]}`}>
      {tag}
    </span>
  );
} 