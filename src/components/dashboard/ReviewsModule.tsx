import { useEffect, useState } from 'react';
import { StarIcon } from '@heroicons/react/24/solid';
import { supabase } from '@/utils/supabase';
import { formatDistanceToNow } from 'date-fns';

interface Review {
  id: string;
  rating: number;
  rating_comment: string;
  rating_submitted_at: string;
  title: string;
  customer_name: string;
}

interface ReviewStats {
  avg_rating: number;
  total_reviews: number;
}

interface ReviewsModuleProps {
  organizationId: string;
}

export default function ReviewsModule({ organizationId }: ReviewsModuleProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<ReviewStats>({ avg_rating: 0, total_reviews: 0 });

  useEffect(() => {
    async function fetchReviews() {
      try {
        const { data, error } = await supabase
          .rpc('get_recent_reviews', {
            org_id: organizationId
          });

        if (error) throw error;

        if (data && data.length > 0) {
          setReviews(data);
          setStats({
            avg_rating: data[0].avg_rating,
            total_reviews: data[0].total_reviews
          });
        }
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    fetchReviews();

    const channel = supabase
      .channel(`reviews-${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
          filter: `organization_id=eq.${organizationId} AND rating_submitted_at.is.not.null`
        },
        () => {
          fetchReviews();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [organizationId]);

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error loading reviews</h3>
            <p className="mt-2 text-sm text-red-700">{error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-gray-900">Customer Reviews</h2>
        <p className="mt-1 text-sm text-gray-500">
          Recent feedback from your support tickets.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow h-full">
        {loading ? (
          <div className="p-4 space-y-4">
            <div className="animate-pulse flex justify-between items-center">
              <div className="h-8 bg-gray-200 rounded w-24"></div>
              <div className="h-6 bg-gray-200 rounded w-32"></div>
            </div>
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse space-y-3 border-t pt-4">
                <div className="flex justify-between">
                  <div className="h-4 bg-gray-200 rounded w-24"></div>
                  <div className="h-4 bg-gray-200 rounded w-20"></div>
                </div>
                <div className="h-4 bg-gray-200 rounded w-full"></div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <StarIcon className="w-6 h-6 text-yellow-400" />
                <span className="text-2xl font-bold">{stats.avg_rating.toFixed(1)}</span>
              </div>
              <div className="text-sm text-gray-500">
                {stats.total_reviews} reviews
              </div>
            </div>

            <div className="h-[360px] overflow-y-auto">
              {reviews.map(review => (
                <div key={review.id} className="p-4 border-b hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <StarIcon 
                          key={i}
                          className={`w-4 h-4 ${
                            i < review.rating 
                              ? 'text-yellow-400' 
                              : 'text-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                    <time className="text-sm text-gray-500">
                      {formatDistanceToNow(new Date(review.rating_submitted_at), { addSuffix: true })}
                    </time>
                  </div>
                  <div className="mt-2">
                    <div className="text-sm font-medium">
                      {review.customer_name || 'Anonymous'}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {review.rating_comment}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
} 