import React from 'react';

const fields = [
  { key: 'publicRepos', label: 'Public Repos' },
  { key: 'totalStars', label: 'Stars (Sum)' },
  { key: 'pushEvents', label: 'Push Events' },
  { key: 'prEvents', label: 'PR Events' },
  { key: 'issueEvents', label: 'Issue Events' },
  { key: 'recentEvents', label: 'Recent Events' }
];

export default function StatsCards({ summary }) {
  if (!summary) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {fields.map(f => (
        <div key={f.key} className="panel p-3">
          <h4 className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">{f.label}</h4>
          <div className="text-lg font-semibold">{summary[f.key]}</div>
        </div>
      ))}
    </div>
  );
}