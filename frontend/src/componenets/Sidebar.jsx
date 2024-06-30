import React from 'react'
import { Link } from 'react-router-dom'
import { IoHomeSharp } from "react-icons/io5";
import { FaHeart } from "react-icons/fa";
import { MdOutlineExplore } from "react-icons/md";
import { LuLogIn } from "react-icons/lu";
import { SiGnuprivacyguard } from "react-icons/si";
import Logout from './Logout';


const Sidebar = () => {
  const authuser = true;

  return (
    <aside className='flex flex-col items-center min-w-12 sm:w-12 sticky top-0 left-0 h-screen py-8
    overflow-y-auto border-r w-full rounded-md bg-glass'>
     <nav className='h-full flex flex-col gap-3'>
      <Link to='/' className='flex justify-center'>
        <img className='h-8' src='/github.svg' alt='Github Logo' />
      </Link>
      <Link
          to='/' className='p-1.5 flex justify-center transition-colors duration-200 rounded-lg hover:bg-gray-800'>
            <IoHomeSharp size={20}/>

      </Link>
      {authuser && (
        <Link to='/likes' className='p-1.5 flex justify-center  transition-colors duration-200 rounded-lg hover:bg-gray-800'>
          <FaHeart size={18} />
        </Link>
      )}

      {authuser && (
              <Link to='/explore' className='p-1.5 flex justify-center  transition-colors duration-200 rounded-lg hover:bg-gray-800'>
                < MdOutlineExplore size={22} />
              </Link>
            )}
      {!authuser && (
              <Link to='/login' className='p-1.5 flex justify-center  transition-colors duration-200 rounded-lg hover:bg-gray-800'>
                <LuLogIn size={22} />
              </Link>
            )}
      {!authuser && (
              <Link to='/signup' className='p-1.5 flex justify-center  transition-colors duration-200 rounded-lg hover:bg-gray-800'>
                <SiGnuprivacyguard size={22} />
              </Link>
            )}

        {authuser && (
          <div className='flex flex-col gap-2 mt-auto'>
            <Logout />
          </div>
        )}
     </nav>

      </aside>
  )
}

export default Sidebar