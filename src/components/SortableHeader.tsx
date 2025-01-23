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
  return (
    <th
      scope="col"
      className={`px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer ${className || ''}`}
      onClick={() => onSort(field)}
    >
      {label}
    </th>
  );
} 