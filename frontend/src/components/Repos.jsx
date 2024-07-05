import React from 'react'
import Repo from './Repo'

const Repos = ({repos,alwaysfullWidth}) => {
	console.log("REPOS:",repos);;
	const classname = alwaysfullWidth ? 'w-full' : 'lg:w-2/3 w-full';
  return (
    <div className={`${classname} bg-glass rounded-lg px-8 py-6`}>
			<ol className='relative border-s border-gray-200'>
				{repos.map((repo) => (
					<Repo key={repo.id} repo={repo} />
				
				))}
				{repos.length === 0 &&  <p className='fles items-center justify-center h-32'>No Repositories found</p>}
			</ol>
		</div>
  )
}

export default Repos

