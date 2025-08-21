import React from 'react';

export default function RepoList({ repos }) {
  if (!repos) return null;
  return (
    <div className="panel">
      <h3 className="text-base font-semibold mb-4">Top Repositories</h3>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {repos.slice(0, 12).map(r => (
          <div key={r.id} className="border border-[#30363d] rounded-md p-4 flex flex-col gap-2 bg-[#0f141a]">
            <h4 className="font-medium text-sm">
              <a
                href={r.html_url}
                target="_blank"
                rel="noreferrer"
                className="text-blue-400 hover:underline"
              >
                {r.name}
              </a>
            </h4>
            {r.description && <p className="text-xs text-gray-400 line-clamp-3">{r.description}</p>}
            <div className="flex flex-wrap gap-3 text-[11px] text-gray-400">
              {r.language && <span>{r.language}</span>}
              <span>⭐ {r.stargazers_count}</span>
              <span>🍴 {r.forks_count}</span>
              <span>⬆ {new Date(r.updated_at).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}