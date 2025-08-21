import { getCache, setCache, getETag, setETag } from '../utills/cache.js';

const BASE = 'https://api.github.com';
const TOKEN = import.meta.env.GITHUB_API_KEY || '';

const TTL = {
  profile: 10 * 60 * 1000,
  repos: 10 * 60 * 1000,
  events: 2 * 60 * 1000
};

async function fetchWithCache(cacheBase, url) {
  const cached = getCache(cacheBase);
  const etag = getETag(`${cacheBase}:etag`);
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'mygithub-dashboard'
  };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  if (etag) headers['If-None-Match'] = etag;

  const res = await fetch(url, { headers });
  if (res.status === 304 && cached) return cached;
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API ${res.status}: ${body}`);
  }
  const data = await res.json();
  const newETag = res.headers.get('etag');
  if (newETag) setETag(`${cacheBase}:etag`, newETag);

  const ttl =
    cacheBase.startsWith('profile') ? TTL.profile :
    cacheBase.startsWith('repos') ? TTL.repos :
    TTL.events;

  setCache(cacheBase, data, ttl);
  return data;
}

export async function getUserProfile(username) {
  return fetchWithCache(`profile:${username}`, `${BASE}/users/${encodeURIComponent(username)}`);
}

export async function getUserRepos(username) {
  const data = await fetchWithCache(
    `repos:${username}`,
    `${BASE}/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated&type=owner`
  );
  return data.sort((a, b) => b.stargazers_count - a.stargazers_count);
}

export async function getUserEvents(username) {
  return fetchWithCache(
    `events:${username}`,
    `${BASE}/users/${encodeURIComponent(username)}/events?per_page=50`
  );
}

export function buildSummary({ profile, repos, events }) {
  const totalStars = repos.reduce((s, r) => s + r.stargazers_count, 0);
  const countsByType = events.reduce((m, e) => {
    m[e.type] = (m[e.type] || 0) + 1;
    return m;
  }, {});
  const pushEvents = countsByType.PushEvent || 0;
  const prEvents = (countsByType.PullRequestEvent || 0) + (countsByType.PullRequestReviewEvent || 0);
  const issueEvents = (countsByType.IssuesEvent || 0) + (countsByType.IssueCommentEvent || 0);

  return {
    username: profile.login,
    publicRepos: profile.public_repos,
    followers: profile.followers,
    following: profile.following,
    totalStars,
    pushEvents,
    prEvents,
    issueEvents,
    recentEvents: events.length
  };
}

export function deriveLanguageTotals(repos) {
  const tally = {};
  repos.forEach(r => {
    if (r.language) tally[r.language] = (tally[r.language] || 0) + 1;
  });
  return Object.entries(tally)
    .map(([language, count]) => ({ language, count }))
    .sort((a, b) => b.count - a.count);
}

export function buildDailyTrend(events) {
  const map = {};
  events.forEach(e => {
    const day = e.created_at.slice(0, 10);
    map[day] = (map[day] || 0) + 1;
  });
  return Object.keys(map)
    .sort()
    .map(d => ({ date: d, count: map[d] }));
}