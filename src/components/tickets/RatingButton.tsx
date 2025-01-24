'use client';

import { useState } from 'react';
import { StarIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import { RatingModal } from './RatingModal';

interface RatingButtonProps {
  ticketId: string;
  currentRating?: number;
  currentComment?: string;
  onSubmitRating: (ticketId: string, rating: number, comment?: string) => Promise<void>;
}

export function RatingButton({ 
  ticketId, 
  currentRating, 
  currentComment,
  onSubmitRating 
}: RatingButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSubmit = async (rating: number, comment?: string) => {
    await onSubmitRating(ticketId, rating, comment);
  };

  // If there's already a rating, just display it without button functionality
  if (currentRating) {
    return (
      <div className="inline-flex items-center gap-1 px-3 py-1 text-sm">
        <StarIconSolid className="w-5 h-5 text-yellow-400" />
        <span>{currentRating}</span>
      </div>
    );
  }

  // Otherwise, show the interactive button
  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="inline-flex items-center gap-1 px-3 py-1 text-sm rounded-md hover:bg-gray-100"
      >
        <StarIcon className="w-5 h-5" />
        <span>Rate</span>
      </button>

      <RatingModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
        initialRating={currentRating}
        initialComment={currentComment}
      />
    </>
  );
} 