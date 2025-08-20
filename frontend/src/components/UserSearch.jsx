import React, { useState, useEffect } from 'react';
import useDebounce from '../hooks/useDebounce.js';

export default function UserSearch({ onSearch, defaultValue = 'octocat', onRefresh }) {
  const [value, setValue] = useState(defaultValue);
  const debounced = useDebounce(value, 600);

  useEffect(() => {
    if (debounced && debounced !== defaultValue) onSearch(debounced.trim());
  }, [debounced, defaultValue, onSearch]);

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (value.trim()) onSearch(value.trim()); }}
      className="flex gap-2 flex-wrap"
    >
      <input
        className="bg-[#0f141a] border border-[#30363d] rounded-md px-3 py-2 text-sm outline-none focus:ring focus:ring-blue-600/30 min-w-[240px]"
        placeholder="GitHub username..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        spellCheck="false"
      />
      <button
        type="submit"
        className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-md text-sm font-medium"
      >
        Search
      </button>
      <button
        type="button"
        onClick={onRefresh}
        className="bg-[#30363d] hover:bg-[#3a4149] px-4 py-2 rounded-md text-sm font-medium"
      >
        Refresh
      </button>
    </form>
  );
}