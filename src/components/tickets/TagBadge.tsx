import React, { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase';

interface TagBadgeProps {
  tagId: string | null | undefined;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'px-2.5 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-base'
};

export default function TagBadge({ tagId, size = 'sm' }: TagBadgeProps) {
  const [tagName, setTagName] = useState<string | null>(null);

  useEffect(() => {
    const fetchTagName = async () => {
      if (!tagId) return;

      const { data, error } = await supabase
        .from('tags')
        .select('name')
        .eq('id', tagId)
        .single();

      if (!error && data) {
        setTagName(data.name);
      }
    };

    fetchTagName();
  }, [tagId]);

  if (!tagName) return null;

  return (
    <span className={`inline-flex items-center rounded-full font-medium bg-blue-100 text-blue-700 border border-blue-200 ${sizeClasses[size]}`}>
      {tagName}
    </span>
  );
} 