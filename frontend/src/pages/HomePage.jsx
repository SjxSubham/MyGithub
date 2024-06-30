import React from 'react'
import Search from '../componenets/Search'
import SortRepos from '../componenets/SortRepos'
import ProfileInfo from '../componenets/ProfileInfo'
import Repos from '../componenets/Repos'

const Homepage = () => {
  return (
    <div className='m-4'>
      <Search />
      <SortRepos />

    <div className='flex gap-4 flex-col lg:flex-row justify-center items-start'>
      <ProfileInfo />
      <Repos />

</div>
    </div>
  )
}

export default Homepage
