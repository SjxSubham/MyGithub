import React from 'react';

const Graph = ({ userProfile }) => {
  return (
    <div>
      <a >
        <img 
          src={`https://github-readme-activity-graph.vercel.app/graph?username=${userProfile?.html_url}&theme=github-compact&bg_color=282C35`} 
          alt={`${userProfile?.html_url} GitHub activity graph`} 
        />
      </a>
    </div>
    // 
  );
};

export default Graph;