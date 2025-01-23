'use client';

import { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { StarRating } from './StarRating';

interface RatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (rating: number, comment?: string) => void;
  initialRating?: number;
  initialComment?: string;
}

export function RatingModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  initialRating,
  initialComment 
}: RatingModalProps) {
  const [rating, setRating] = useState<number | undefined>(initialRating);
  const [comment, setComment] = useState(initialComment || '');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating) {
      onSubmit(rating, comment || undefined);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Rate Your Experience</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              How would you rate your experience?
            </label>
            <div className="flex justify-center mb-4">
              <StarRating
                rating={rating}
                onChange={setRating}
                size="lg"
              />
            </div>
          </div>

          <div className="mb-6">
            <label 
              htmlFor="comment" 
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Additional Comments (Optional)
            </label>
            <textarea
              id="comment"
              rows={4}
              className="w-full border rounded-md p-2"
              placeholder="Tell us more about your experience..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!rating}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Submit Rating
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 