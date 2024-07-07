import React from 'react'
import toast from 'react-hot-toast';
import { FaHeart } from "react-icons/fa";
import { useAuthContext } from '../context/Auth.Context';
const LikeProfile = ({userProfile}) => {
    const {authUser} = useAuthContext();
    const isOwnProfile = authUser?.username === userProfile.login;
        const handleLikeProfile = async () => {
            try {
                const res = await fetch(`/api/users/likes/${userProfile.login}`, {
                    method: "POST",
                    credentials: "include",
                });                                 
                const data = await res.json();
                if(data.error) throw new Error(data.error);
                toast.success(data.message);
            } catch (error) {
                toast.error(error.message);
            }
        
    };
    if(!authUser || isOwnProfile) return null;
  return (
   <button className='bg-glass font-medium w-full text-xs p-2 rounded-md cursor-pointer border border-red-400 flex items-center gap-2'
   onClick = {handleLikeProfile}
   >
    <FaHeart size={16}/> Like 
   </button>
  )
}

export default LikeProfile