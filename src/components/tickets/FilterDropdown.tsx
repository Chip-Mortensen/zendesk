import { useState, useRef, useEffect } from 'react';

interface FilterOption {
  label: string;
  value: string;
  count: number;
}

interface FilterDropdownProps {
  label: string;
  options: FilterOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
}

export default function FilterDropdown({
  label,
  options,
  selectedValues,
  onChange
}: FilterDropdownProps) {
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

  const handleCheckboxChange = (value: string) => {
    const newValues = selectedValues.includes(value)
      ? selectedValues.filter(v => v !== value)
      : [...selectedValues, value];
    onChange(newValues);
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full inline-flex items-center justify-between px-3 py-2 border rounded-md text-sm font-medium
          ${selectedValues.length > 0
            ? 'border-blue-500 text-blue-700 bg-blue-50 hover:bg-blue-100'
            : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
          }`}
      >
        <div className="flex items-center min-w-0">
          <span className="truncate">{label}</span>
          {selectedValues.length > 0 && (
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {selectedValues.length}
            </span>
          )}
        </div>
        <svg
          className={`ml-2 h-5 w-5 flex-shrink-0 transition-transform ${isOpen ? 'transform rotate-180' : ''}`}
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

      {isOpen && (
        <div className="absolute z-10 mt-2 w-72 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5">
          <div className="p-2 max-h-60 overflow-auto">
            {options.map((option) => (
              <label
                key={option.value}
                className="flex items-center px-2 py-2 hover:bg-gray-50 rounded cursor-pointer"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  checked={selectedValues.includes(option.value)}
                  onChange={() => handleCheckboxChange(option.value)}
                />
                <span className="ml-3 text-gray-900 truncate flex-1">{option.label}</span>
                <span className="ml-auto text-gray-500 text-sm">{option.count}</span>
              </label>
            ))}
            {options.length === 0 && (
              <div className="px-2 py-2 text-sm text-gray-500">No options available</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 