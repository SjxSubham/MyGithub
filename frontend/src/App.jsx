import { Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from 'react-hot-toast';
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import SignUpPage from "./pages/SignUpPage";
import ExplorePage from "./pages/ExplorePage";
import LikesPage from "./pages/LikesPage";

import Sidebar from './components/Sidebar';
import { useAuthContext } from "./context/Auth.Context";
import Footer from "./components/Footer";

import React, { useState } from 'react';
import UserSearch from './components/UserSearch.jsx';
import UserProfile from './components/UserProfile.jsx';
import StatsCards from './components/StatsCards.jsx';
import RepoList from './components/RepoList.jsx';
import EventTimeline from './components/EventTimeline.jsx';
import LanguageChart from './components/LanguageChart.jsx';
import ActivityTrends from './components/ActivityTrends.jsx';
import Loading from './components/Loading.jsx';
import ErrorMessage from './components/ErrorMessage.jsx';
import useGithubUser from './hooks/useGithubUser.js';

function App() {
  const [username, setUsername] = useState('octocat');
  const { data,  error, refresh } = useGithubUser(username);
  const {authUser, loading} =  useAuthContext();
  console.log("Authenticated user:", authUser);

  if(loading) return null; // important point i need to min 

  return  (
    <div className='flex'>
      <Sidebar />
        <div className='max-w-5xl my-5 text-white mx-auto transition-all duration-300 flex-1'>
       
          <Routes>
            <Route path='/' element={<HomePage />} />
            <Route path='/login' element={!authUser ? <LoginPage /> : <Navigate to={"/"} />} />
            <Route path='/signup' element={!authUser ? <SignUpPage /> : <Navigate to = {"/"} />} />
            <Route path='/explore' element={authUser ? <ExplorePage /> : <Navigate to ={"/login"} />}  />
            <Route path='/likes' element={authUser ?<LikesPage /> : <Navigate to={"/login"} />} />
            <Route path='/profile' element={authUser ?<UserProfile /> : <Navigate to={"/login"} />} />
          </Routes>
          <Toaster/>
          <Footer />
        </div>
    </div>
  );
}

export default App



