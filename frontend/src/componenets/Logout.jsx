import React from 'react'
import { CiLogout } from "react-icons/ci";
const Logout = ({userProfile}) => {
  return (
    <>
    <a href={userProfile?.html_url} target='_blank' rel='noreferrer'>
    <img src={userProfile?.avatar_url} className=' w-10 h-10 rounded-full mb-2 border border-gray-800' alt='' />
    </a>


    <div className='cursor-pointer flex items-center p-2 border-spacing-1 border-gray-500 last:rounded-lg bg-glass mt-auto'>
    <CiLogout size={22} />

    </div>

    
    </>
  )
}

export default Logout