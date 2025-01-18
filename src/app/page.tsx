'use client';

export default function Home() {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
          Modern Help Desk Solution
        </h1>
        <p className="mt-6 text-lg leading-8 text-gray-600">
          Streamline your customer support with our integrated ticketing system, knowledge base, and AI-powered chat.
        </p>
      </div>

      <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {/* Ticketing System Card */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900">Ticketing System</h2>
          <p className="mt-2 text-gray-600">
            Efficiently manage and track customer support requests with our comprehensive ticketing system.
          </p>
        </div>

        {/* Knowledge Base Card */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900">Knowledge Base</h2>
          <p className="mt-2 text-gray-600">
            Create and manage a searchable repository of helpful articles and documentation.
          </p>
        </div>

        {/* AI Chat Card */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900">AI-Powered Chat</h2>
          <p className="mt-2 text-gray-600">
            Provide instant support with our AI-powered chat system that learns from your knowledge base.
          </p>
        </div>
      </div>
    </div>
  );
}
