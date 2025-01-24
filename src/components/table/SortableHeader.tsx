import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/20/solid';

interface SortableHeaderProps {
  label: string;
  field: string;
  currentSort: {
    field: string;
    direction: 'asc' | 'desc';
  };
  onSort: (field: string) => void;
  className?: string;
}

export default function SortableHeader({ label, field, currentSort, onSort, className }: SortableHeaderProps) {
  const isCurrentSort = currentSort.field === field;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSort(field);
  };

  return (
    <th 
      scope="col" 
      className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 ${className || ''}`}
      onClick={handleClick}
    >
      <div className="flex items-center space-x-1">
        <span>{label}</span>
        <div className="flex flex-col">
          {isCurrentSort && currentSort.direction === 'asc' ? (
            <ChevronUpIcon className="h-4 w-4" />
          ) : isCurrentSort && currentSort.direction === 'desc' ? (
            <ChevronDownIcon className="h-4 w-4" />
          ) : (
            <div className="h-4 w-4" /> // Placeholder to maintain spacing
          )}
        </div>
      </div>
    </th>
  );
} 