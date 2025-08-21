import React from 'react'
import { Link } from 'react-router-dom'
import { IoHomeSharp } from "react-icons/io5";
import { FaHeart } from "react-icons/fa";
import { User } from 'lucide-react';
import { MdOutlineExplore } from "react-icons/md";
import { LuLogIn } from "react-icons/lu";
import { SiGnuprivacyguard } from "react-icons/si";
import Logout from './Logout';
import { useAuthContext } from '../context/Auth.Context';

const Sidebar = () => {
  //correct data
  const {authUser} = useAuthContext();

  return (
    <aside className='flex flex-col items-center min-w-24 sm:w-12 sticky top-0 left-0 h-screen py-8
    overflow-y-auto border-r w-full rounded-md bg-glass'>
     <nav className='h-full flex flex-col gap-3'>
      <Link to='/' className='flex justify-center'>
        <img className='h-8' src='/github.svg' alt='Github Logo' />
      </Link>
      <Link
          to='/' className='p-1.5 flex justify-center transition-colors duration-200 rounded-lg hover:bg-gray-800'>
            <IoHomeSharp size={20}/>

      </Link>
      {authUser && (
        <Link to='/likes' className='text-md font-mono p-1.5 flex justify-center  transition-colors duration-200 rounded-lg hover:bg-gray-800'>
          Likes <FaHeart size={18} />
        </Link>
      )}

      {authUser && (
              <Link to='/explore' className='text-md font-mono p-1.5 flex justify-center  transition-colors duration-200 rounded-lg hover:bg-gray-800'>
               Explore < MdOutlineExplore size={22} />
              </Link>
            )}
      {!authUser && (
              <Link to='/login' className='text-md p-1.5 flex justify-center  transition-colors duration-200 rounded-lg hover:bg-gray-800'>
                Login<LuLogIn size={22} />
                
              </Link>
            )}
      {!authUser && (
              <Link to='/signup' className='text-md font-mono p-1.5 flex justify-center  transition-colors duration-200 rounded-lg hover:bg-gray-800'>
                Signup<SiGnuprivacyguard size={22} />
              </Link>
            )}

        {authUser && (
          <div className='flex flex-col gap-2 mt-auto'>
            <Logout />
          </div>
        )}
        {authUser && (
          <Link to='/profile' className='flex flex-col gap-2 mt-auto'>
            <User />
          </Link>
        )}
     </nav>

      </aside>
  )
}

export default Sidebar