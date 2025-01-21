'use client';

import React from 'react';
import { isImageFile } from '@/utils/kb/attachments';

interface AttachmentDisplayProps {
  href: string;
  className?: string;
}

export default function AttachmentDisplay({ href, className = '' }: AttachmentDisplayProps) {
  const fileName = href.split('/').pop() || '';
  const isImage = isImageFile(fileName);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center p-4 border rounded-lg hover:bg-gray-50 transition-colors duration-150 no-underline ${className}`}
    >
      {isImage ? (
        <div className="w-12 h-12 flex-shrink-0">
          <img
            src={href}
            alt={fileName}
            className="w-full h-full object-cover rounded"
          />
        </div>
      ) : (
        <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center bg-gray-100 rounded">
          {fileName.endsWith('.pdf') ? (
            <svg className="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11.363 2c4.155 0 2.637 6 2.637 6s6-1.65 6 2.457v11.543h-16v-20h7.363zm.826-2h-10.189v24h20v-14.386c0-2.391-6.648-9.614-9.811-9.614zm4.811 13h-2.628v3.686h.907v-1.472h1.49v-.732h-1.49v-.698h1.721v-.784zm-4.9 0h-1.599v3.686h1.599c.537 0 .961-.181 1.262-.535.555-.658.587-2.034-.062-2.692-.298-.3-.712-.459-1.2-.459zm-.692.783h.496c.473 0 .802.173.999.607.224.496.193 1.199-.127 1.592-.145.178-.42.275-.715.275h-.653v-2.474zm-2.74-.783h-1.668v3.686h.907v-1.277h.761c.619 0 1.064-.277 1.224-.763.095-.291.095-.597 0-.885-.16-.484-.606-.761-1.224-.761zm-.761.732h.546c.235 0 .467.028.576.228.067.123.067.366 0 .489-.109.199-.341.227-.576.227h-.546v-.944z"/>
            </svg>
          ) : fileName.endsWith('.txt') || fileName.endsWith('.md') ? (
            <svg className="w-8 h-8 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11zM8 15h8v2H8v-2zm0-4h8v2H8v-2z"/>
            </svg>
          ) : fileName.endsWith('.json') ? (
            <svg className="w-8 h-8 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm3.5 7.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm8 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm-4 4a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/>
            </svg>
          ) : (
            <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
            </svg>
          )}
        </div>
      )}
      <div className="ml-4 flex-grow min-w-0">
        <div className="text-sm font-medium text-blue-600 hover:text-blue-700 truncate">
          {fileName}
        </div>
      </div>
    </a>
  );
} 