import React from 'react';

export default function UserProfile({ profile, summary }) {
  if (!profile) return null;
  return (
    <div className="panel bg-glass flex gap-4 items-center">
      <img
        src={profile.avatar_url}
        alt={profile.login}
        className="w-24 h-24 rounded-full border border-[#30363d]"
      />
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">{profile.name || profile.login}</h2>
        {profile.bio && <p className="text-sm text-gray-400 max-w-xl">{profile.bio}</p>}
        <div className="flex flex-wrap gap-4 text-xs text-gray-400">
          <span>@{profile.login}</span>
          {profile.company && <span>🏢 {profile.company}</span>}
          {profile.location && <span>📍 {profile.location}</span>}
          <span>👥 {summary.followers} followers</span>
        </div>
      </div>
    </div>
  );
}