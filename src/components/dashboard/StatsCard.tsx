import React from 'react';

interface StatsCardProps {
  title: string;
  value: number | string;
  description?: string;
  icon?: React.ReactNode;
  backgroundColor?: string;
}

export default function StatsCard({
  title,
  value,
  description,
  icon,
  backgroundColor = 'bg-white'
}: StatsCardProps) {
  // Extract border class if present in backgroundColor
  const borderClass = backgroundColor.includes('border-') 
    ? backgroundColor.split(' ').find(cls => cls.startsWith('border-'))
    : 'border-gray-100';

  // Remove border class from backgroundColor if present
  const bgClass = backgroundColor.replace(/border-[^\s]+/, '').trim();

  return (
    <div className={`${bgClass} rounded-lg border ${borderClass} shadow-sm hover:shadow-md transition-shadow duration-200`}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-medium text-gray-600 uppercase tracking-wider">
            {title}
          </p>
          {icon && <div className="text-gray-400">{icon}</div>}
        </div>
        <div className="flex flex-col">
          <p className="text-3xl font-semibold text-gray-900">
            {value}
          </p>
          {description && (
            <p className="mt-1 text-sm text-gray-500">
              {description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
} 