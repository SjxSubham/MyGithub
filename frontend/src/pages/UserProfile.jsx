import { useState } from 'react';
import Loading from './components/Loading.jsx';
import ErrorMessage from './components/ErrorMessage.jsx';
import useGithubUser from './hooks/useGithubUser.js';
import UserSearch from './components/UserSearch.jsx';
import StatsCards from './components/StatsCards.jsx';
import RepoList from './components/RepoList.jsx';
import EventTimeline from './components/EventTimeline.jsx';
import LanguageChart from './components/LanguageChart.jsx';
import ActivityTrends from './components/ActivityTrends.jsx';

export default function UserProfile() {
    const [username, setUsername] = useState('octocat');
    const { data, error, loading, refresh } = useGithubUser(username);

    if (loading) return <Loading />;
    if (error) return <ErrorMessage message="Failed to fetch GitHub user data. Please try again later." />;

    return (
        <div className='flex'>
            <div className='max-w-5xl my-5 text-white mx-auto transition-all duration-300 flex-1'>
                <UserSearch onSearch={setUsername} defaultValue={username} onRefresh={refresh} />
                {data && (
                    <>
                        <StatsCards summary={data.summary} />
                        <RepoList repos={data.repos} />
                        <EventTimeline events={data.events} />
                        <LanguageChart languages={data.languages} />
                        <ActivityTrends events={data.events} />
                    </>
                )}
            </div>
        </div>
    );
}