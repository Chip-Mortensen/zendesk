'use client';

import { useState } from 'react';
import { StarIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';

interface StarRatingProps {
  rating?: number;
  onChange?: (rating: number) => void;
  readOnly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
};

export function StarRating({ rating, onChange, readOnly = false, size = 'md' }: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  
  const displayRating = hoverRating ?? rating ?? 0;
  
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          className={`transition-colors ${!readOnly ? 'hover:scale-110 cursor-pointer' : 'cursor-default'}`}
          onMouseEnter={() => !readOnly && setHoverRating(star)}
          onMouseLeave={() => !readOnly && setHoverRating(null)}
          onClick={() => !readOnly && onChange?.(star)}
        >
          {star <= displayRating ? (
            <StarIconSolid className={`${sizeClasses[size]} text-yellow-400`} />
          ) : (
            <StarIcon className={`${sizeClasses[size]} text-gray-300`} />
          )}
        </button>
      ))}
    </div>
  );
} 