import React from 'react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="space-container max-w-md text-center">
        <h1 className="text-6xl font-bold text-plasma-blue mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-space-text mb-4">
          Page Not Found
        </h2>
        <p className="text-space-subtext mb-8">
          The page you're looking for doesn't exist in this space dimension.
        </p>
        <Link href="/" className="space-button">
          <i className="fa-solid fa-home mr-2"></i>
          Return Home
        </Link>
      </div>
    </div>
  );
}