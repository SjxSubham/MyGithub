import { useEffect, useState, useCallback } from 'react';
import {
  getUserProfile,
  getUserRepos,
  getUserEvents,
  buildSummary,
  deriveLanguageTotals,
  buildDailyTrend
} from '../services/githubApi.js';

export default function useGitHubUser(username) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(username));
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!username) return;
    setLoading(true);
    setError(null);
    try {
      const [profile, repos, events] = await Promise.all([
        getUserProfile(username),
        getUserRepos(username),
        getUserEvents(username)
      ]);
      const summary = buildSummary({ profile, repos, events });
      const languages = deriveLanguageTotals(repos);
      const trend = buildDailyTrend(events);
      setData({ profile, repos, events, summary, languages, trend });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = () => load();

  return { data, loading, error, refresh };
}