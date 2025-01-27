import { useState, useEffect, useCallback } from 'react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useDebounce } from '@/hooks/useDebounce';

interface KBSearchBarProps {
  onSearch: (query: string) => void;
  isSearching?: boolean;
  className?: string;
}

export function KBSearchBar({ onSearch, isSearching = false, className = '' }: KBSearchBarProps) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (debouncedQuery !== undefined) {
      onSearch(debouncedQuery);
    }
  }, [debouncedQuery, onSearch]);

  const clearSearch = useCallback(() => {
    setQuery('');
  }, []);

  return (
    <div className={`relative w-full mx-auto ${className}`}>
      <div className="relative">
        <div className="relative bg-white shadow-sm rounded-xl">
          <MagnifyingGlassIcon 
            className="pointer-events-none absolute left-4 top-3.5 h-5 w-5 text-gray-400" 
            aria-hidden="true" 
          />
          <input
            type="text"
            className="block w-full h-12 pl-11 pr-10 py-2 text-sm text-gray-900 rounded-xl border-0 ring-1 ring-inset ring-gray-200 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-500 bg-transparent"
            placeholder="Search articles..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-500"
            >
              <XMarkIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      {isSearching && (
        <div className="absolute right-14 top-3.5">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
        </div>
      )}
    </div>
  );
} 