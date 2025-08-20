import React from 'react';

export default function ErrorMessage({ message }) {
  return (
    <div className="panel border-red-600 text-sm text-red-400">
      <strong className="mr-1">Error:</strong>{message}
    </div>
  );
}