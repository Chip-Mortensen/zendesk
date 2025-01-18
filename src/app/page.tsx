'use client';

import Link from 'next/link';

export default function Home() {
  const features = [
    {
      name: 'Multi-tenant Support',
      description: 'Dedicated support portals for each organization with custom branding.',
      icon: '🏢',
    },
    {
      name: 'Ticketing System',
      description: 'Efficiently manage and track customer support requests with our comprehensive ticketing system.',
      icon: '🎫',
    },
    {
      name: 'Knowledge Base',
      description: 'Create and manage a searchable repository of helpful articles and documentation.',
      icon: '📚',
    },
    {
      name: 'AI-Powered Chat',
      description: 'Provide instant support with our AI-powered chat system that learns from your knowledge base.',
      icon: '🤖',
    },
    {
      name: 'Role-Based Access',
      description: 'Manage permissions with admin, agent, and customer roles for secure access control.',
      icon: '🔒',
    },
    {
      name: 'Analytics & Insights',
      description: 'Track support metrics and gain insights to improve customer satisfaction.',
      icon: '📊',
    },
  ];

  const pricingTiers = [
    {
      name: 'Starter',
      price: '$49',
      period: '/month',
      description: 'Perfect for small businesses just getting started with customer support.',
      features: [
        'Up to 3 support agents',
        '1,000 tickets per month',
        'Basic knowledge base',
        'Email support',
        'Standard chat support',
      ],
      cta: 'Start Free Trial',
      highlighted: false,
    },
    {
      name: 'Professional',
      price: '$99',
      period: '/month',
      description: 'Ideal for growing businesses with increasing support needs.',
      features: [
        'Up to 10 support agents',
        'Unlimited tickets',
        'Advanced knowledge base',
        'Priority email support',
        'AI-powered chat support',
        'Custom branding',
      ],
      cta: 'Start Free Trial',
      highlighted: true,
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: '',
      description: 'For large organizations requiring advanced features and customization.',
      features: [
        'Unlimited support agents',
        'Unlimited everything',
        'Advanced analytics',
        'Dedicated support',
        'Custom integrations',
        'SLA guarantees',
      ],
      cta: 'Contact Sales',
      highlighted: false,
    },
  ];

  return (
    <div className="space-y-32">
      {/* Hero section */}
      <div className="relative isolate">
        <div className="mx-auto max-w-4xl py-32">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
              Modern Help Desk for Growing Teams
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Streamline your customer support with our integrated ticketing system, knowledge base, and AI-powered chat.
              Built for organizations of all sizes.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link
                href="/signup"
                className="rounded-md bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                Get Started
              </Link>
              <Link href="/pricing" className="text-sm font-semibold leading-6 text-gray-900">
                View Pricing <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Features section */}
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Everything You Need for Customer Support
          </h2>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            Our platform provides all the tools you need to deliver exceptional customer support,
            from ticketing to AI-powered assistance.
          </p>
        </div>
        <div className="mx-auto mt-16 max-w-7xl">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.name} className="bg-white shadow-sm ring-1 ring-gray-900/5 rounded-lg p-8">
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-lg font-semibold text-gray-900">{feature.name}</h3>
                <p className="mt-2 text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pricing section */}
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Simple, Transparent Pricing
          </h2>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            Choose the plan that best fits your needs. All plans include a 14-day free trial.
          </p>
        </div>
        <div className="mx-auto mt-16 grid max-w-7xl grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {pricingTiers.map((tier) => (
            <div
              key={tier.name}
              className={`rounded-lg p-8 ${
                tier.highlighted
                  ? 'bg-blue-600 text-white ring-blue-500'
                  : 'bg-white text-gray-900 ring-gray-900/5'
              } ring-1 shadow-sm relative flex flex-col`}
            >
              <div className="mb-8">
                <h3 className={`text-lg font-semibold ${tier.highlighted ? 'text-white' : 'text-gray-900'}`}>
                  {tier.name}
                </h3>
                <div className="mt-4 flex items-baseline">
                  <span className="text-4xl font-bold tracking-tight">{tier.price}</span>
                  {tier.period && (
                    <span className={`text-sm ${tier.highlighted ? 'text-blue-100' : 'text-gray-600'}`}>
                      {tier.period}
                    </span>
                  )}
                </div>
                <p className={`mt-4 text-sm ${tier.highlighted ? 'text-blue-100' : 'text-gray-600'}`}>
                  {tier.description}
                </p>
              </div>
              <ul className="mb-8 space-y-3 text-sm leading-6">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex gap-x-3">
                    <svg
                      className={`h-6 w-5 flex-none ${tier.highlighted ? 'text-white' : 'text-blue-600'}`}
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className={`mt-auto rounded-md px-4 py-2 text-center text-sm font-semibold shadow-sm ${
                  tier.highlighted
                    ? 'bg-white text-blue-600 hover:bg-blue-50'
                    : 'bg-blue-600 text-white hover:bg-blue-500'
                }`}
              >
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
