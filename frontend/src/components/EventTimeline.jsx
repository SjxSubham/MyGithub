import React from 'react';

function describe(ev) {
  switch (ev.type) {
    case 'PushEvent':
      return `Pushed ${(ev.payload?.commits || []).length} commit(s) to ${ev.repo?.name}`;
    case 'PullRequestEvent':
      return `${ev.payload.action} PR #${ev.payload.number} ${ev.repo?.name}`;
    case 'IssuesEvent':
      return `${ev.payload.action} issue #${ev.payload.issue?.number} ${ev.repo?.name}`;
    default:
      return `${ev.type} on ${ev.repo?.name}`;
  }
}

export default function EventTimeline({ events }) {
  if (!events) return null;
  return (
    <div className="panel bg-glass">
      <h3 className="text-base font-semibold mb-4">Recent Events</h3>
      <div className="flex flex-col gap-3 max-h-[420px] overflow-y-auto pr-1">
        {events.slice(0, 40).map(e => (
          <div key={e.id} className="bg-[#0f141a] border border-[#30363d] rounded-md p-3 text-xs space-y-1">
            <div>{describe(e)}</div>
            <div className="text-[10px] text-gray-500">{new Date(e.created_at).toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}