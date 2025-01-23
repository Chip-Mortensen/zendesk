interface SortableHeaderProps {
  label: string;
  field: string;
  sortField: string | null;
  sortDirection: 'asc' | 'desc' | null;
  onSort: (field: string) => void;
  className?: string;
}

export default function SortableHeader({
  label,
  field,
  sortField,
  sortDirection,
  onSort,
  className,
}: SortableHeaderProps) {
  return (
    <th
      scope="col"
      className={`px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer ${className || ''}`}
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortField === field && (
          <span className="text-gray-900">
            {sortDirection === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </div>
    </th>
  );
} 