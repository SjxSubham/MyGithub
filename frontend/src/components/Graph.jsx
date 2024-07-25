import React from 'react';

const Graph = ({ userProfile }) => {
  return (
    <div>
      <a href={`https://github.com/ashutosh00710/github-readme-activity-graph`}>
        <img 
          src={`https://github-readme-activity-graph.vercel.app/graph?username=${userProfile?.name}&theme=github-compact&bg_color=282C35`} 
          alt={`${userProfile?.name} GitHub activity graph`} 
        />
      </a>
    </div>
  );
};

export default Graph;