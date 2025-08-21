import React from 'react';

export default function Loading({ text = 'Loading...' }) {
  return (
    <div className="panel animate-pulse text-sm text-gray-300">
      {text}
    </div>
  );
}