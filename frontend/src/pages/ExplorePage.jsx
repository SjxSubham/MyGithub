import React from 'react'
import toast from 'react-hot-toast';
import { useState } from 'react';
import Spinner from '../components/Spinner';
import Repos from '../components/Repos';

const ExplorePage = () => {
  const [loading,setLoading] = useState(false);
  const [repos, setRepos] = useState([]);
  const [selectedLanguage, setSelectedLanguage] = useState(""); // Default language
  
  
  
  const exploreRepos = async (language) => {
    setLoading(true);
    setRepos([]);
    try {
      const res = await fetch("/api/explore/repos/" +language);
      const {repos} = await res.json();
        setRepos(repos); 
        setSelectedLanguage(language);

    } catch (error) {
      toast.error(error.message);
    }
    finally {
      setLoading(false);
    }
  };

  
  return (
    <div className='px-4'>
      <div className='bg-glass max-w-2xl mx-auto rounded-md p-4'>
        <h1 className='text-xl font-bold text-center'>Explore Popular Repositories</h1>
        <div className='flex flex-wrap gap-2 my-2 justify-center'>
          <img src='/csharp.svg' alt='C# Logo' className='h-11 sm:h-20 cursor-pointer'
            onClick={() => exploreRepos('csharp')}
          />
          <img src='/typescript.svg' alt='TypeScript Logo' className='h-11 sm:h-20 hover cursor-pointer' 
            onClick={() => exploreRepos('typescript')}
          />
          <img src='/java.svg' alt='Java Logo' className='h-11 sm:h-20 cursor-pointer'
            onClick={() => exploreRepos('java')}
          />
          <img src='/python.svg' alt='Python Logo' className='h-11 sm:h-20 cursor-pointer' 
            onClick={() => exploreRepos('python')}
          />
          <img src='/c++.svg' alt='C++ Logo' className='h-11 sm:h-20 cursor-pointer'
            onClick={() => exploreRepos('c++')}
          />
          <img src='/javascript.svg' alt='JavaScript Logo' className='h-11 sm:h-20 cursor-pointer' 
            onClick={() => exploreRepos("javascript")}
          />
           <img src='/rust.svg' alt='Rust Logo' className='h-11 sm:h-20 cursor-pointer' 
            onClick={() => exploreRepos('rust')}
          />
          <img src='/go.svg' alt='Go Logo' className='h-11 sm:h-20 cursor-pointer' 
            onClick={() => exploreRepos('go')}
          />
         
          
        </div>
        {repos.length > 0 && (
					<h2 className='text-lg font-semibold text-center justify-between my-4'>
						<span className='bg-blue-100 text-blue-800 font-medium me-2 px-2.5 py-0.5 rounded-full '>
							{selectedLanguage.toUpperCase()}{" "}
						</span>
						Repositories
					</h2>
				)}
        {!loading && repos.length > 0 && <Repos repos={repos} alwaysFullWidth />}
				{loading && <Spinner />}
      </div>
    </div>
  )
}

export default ExplorePage