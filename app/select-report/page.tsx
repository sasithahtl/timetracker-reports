'use client';

import { useRouter } from 'next/navigation';

export default function SelectReportPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-lg shadow-lg p-10 flex flex-col items-center gap-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Choose Report Type</h1>
        <div className="flex flex-col md:flex-row gap-6 w-full justify-center">
          <button
            onClick={() => router.push('/preview')}
            className="bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold shadow hover:bg-blue-700 transition"
          >
            PDF Generator
          </button>
          <button
            onClick={() => router.push('/progress-report')}
            className="bg-green-600 text-white px-8 py-4 rounded-lg text-lg font-semibold shadow hover:bg-green-700 transition"
          >
            Progress Report
          </button>
        </div>
        <button
          onClick={() => router.push('/')}
          className="mt-8 text-gray-500 hover:text-gray-700 underline"
        >
          Back to Upload
        </button>
      </div>
    </div>
  );
} 