import React from 'react'
import { TbGitFork } from "react-icons/tb";
import { RiStarSLine } from "react-icons/ri";
import { GoRepo } from "react-icons/go";
const SortRepos = ({onSort, sortType}) => {
  return (
    <div className='mb-2 flex justify-center lg:justify-end'>
			<button
				type='button'
				className='py-2.5 px-5 me-2 mb-2 text-xs sm:text-sm font-medium focus:outline-none rounded-lg bg-glass'
				onClick={() => onSort('recent')}
			>
				<GoRepo size={18} />Most Recent
			</button>
			<button
				type='button'
				className='py-2.5 px-5 me-2 mb-2  text-xs sm:text-sm font-medium focus:outline-none rounded-lg bg-glass'
				onClick={() => onSort('stars')}
			>
				<RiStarSLine size={18} />Most Stars
			</button>
			<button
				type='button'
				className='py-3 px-5 me-2 mb-2  text-xs sm:text-sm font-medium focus:outline-none rounded-lg bg-glass'
				onClick={() => onSort('forks')}
			>
				<TbGitFork size={18} /> Most Forks 
			</button>
		</div>
  )
}

export default SortRepos