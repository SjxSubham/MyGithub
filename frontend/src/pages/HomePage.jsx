import React, { useEffect, useState, useCallback  } from 'react'
import { toast } from 'react-hot-toast'
import Search from '../components/Search'
import SortRepos from '../components/SortRepos'
import ProfileInfo from '../components/ProfileInfo'
import Repos from '../components/Repos'
import Spinner from '../components/Spinner'
import Graph from '../components/Graph'

const Homepage = () => {
  const [userProfile, setUserProfile] = useState(null)
  const [repos, setRepos] = useState([])
  const [loading, setLoading] = useState(false)

  const [sortType, setSortType] = useState("recent")
  
  const getUserProfileAndRepos = useCallback(async (username="sjxsubham") => {
    setLoading(true);
    try {

      const res = await fetch(`/api/users/profile/${username}`);
      const {repos,userProfile} = await res.json();
     console.log(userProfile,"userProfile");

      
      repos.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
      setRepos(repos);
      setUserProfile(userProfile);
      return {userProfile,repos};
     

    } catch (error) {
      toast.error(error.message)
    }finally {
      setLoading(false);
    
    }
  },[]);

  useEffect(() => {
    getUserProfileAndRepos();
  },[getUserProfileAndRepos])

  const onSearch = async (e,username) => {
    e.preventDefault();
    setLoading(true);
    setRepos([]);
    setUserProfile(null);
    const {userProfile,repos} = await getUserProfileAndRepos(username);

    setUserProfile(userProfile);
    setRepos(repos);
    setLoading(false);
  };

  const onSort = (sortType) => {
    if(sortType === "recent") {
      repos.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)); // recent first
    }
    else if(sortType === "stars") {
      repos.sort((a,b) => b.stargazers_count - a.stargazers_count); // most stars first;
    }
    else if(sortType === "forks"){
      repos.sort((a,b) => b.forks_count - a.forks_count); // most forks first
    }
    setSortType(sortType);
    setRepos([...repos]);
  }

  return (
    <div className='m-4'>
      <Search onSearch={onSearch}/>
      {repos.length > 0 && <SortRepos onSort={onSort} sortType={sortType}/>}

    <div className='flex gap-4 flex-col lg:flex-row justify-center items-start'>
      {userProfile && !loading && <ProfileInfo  userProfile={userProfile} />}
      {!loading && <Repos  repos={repos} />}
      {loading && <Spinner />}
      {/* {userProfile && !loading && <Graph />} */}
</div>
    </div>
  )
}

export default Homepage
