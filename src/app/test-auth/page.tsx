'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function TestAuthPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleTestLogin = async (userType: 'admin' | 'employee' | 'customer') => {
    try {
      setIsLoading(userType);
      
      const response = await fetch('/api/test-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userType })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to login');
      }

      router.push(data.redirect);
    } catch (error) {
      console.error('Login error:', error);
      alert('Failed to log in: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="mx-auto max-w-md">
        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">
              Test User Login
            </h2>
            
            <div className="space-y-4">
              <button
                onClick={() => handleTestLogin('admin')}
                disabled={!!isLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {isLoading === 'admin' ? 'Logging in...' : 'Login as Admin'}
              </button>
              <button
                onClick={() => handleTestLogin('employee')}
                disabled={!!isLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
              >
                {isLoading === 'employee' ? 'Logging in...' : 'Login as Employee'}
              </button>
              <button
                onClick={() => handleTestLogin('customer')}
                disabled={!!isLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
              >
                {isLoading === 'customer' ? 'Logging in...' : 'Login as Customer'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 