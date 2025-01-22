import { useState, useRef, useEffect } from 'react';

interface SelectOption {
  label: string;
  value: string;
}

interface SelectProps {
  label?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  isLoading?: boolean;
}

export default function Select({
  value,
  options,
  onChange,
  placeholder = 'Select an option',
  isLoading = false
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(option => option.value === value);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        onClick={() => !isLoading && setIsOpen(!isOpen)}
        disabled={isLoading}
        className={`w-full inline-flex items-center justify-between px-3 py-2 border rounded-md text-sm
          border-gray-300 text-gray-900 bg-white hover:bg-gray-50
          ${isLoading ? 'cursor-not-allowed opacity-75' : ''}`}
        type="button"
      >
        <div className="flex items-center min-w-0">
          <span className="truncate">
            {isLoading ? 'Loading...' : (selectedOption?.label || placeholder)}
          </span>
        </div>
        <svg
          className={`ml-2 h-5 w-5 flex-shrink-0 text-gray-400 transition-transform ${isOpen ? 'transform rotate-180' : ''}`}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {isOpen && !isLoading && (
        <div className="absolute left-0 z-10 mt-2 min-w-full rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5">
          <div className="py-1 max-h-60 overflow-auto">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50
                  ${option.value === value 
                    ? 'bg-gray-100 text-gray-900' 
                    : 'text-gray-700'
                  }`}
              >
                <span className="block truncate">
                  {option.label}
                </span>
              </button>
            ))}
            {options.length === 0 && (
              <div className="px-4 py-2 text-sm text-gray-500">No options available</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 