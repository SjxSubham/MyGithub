import React from 'react';

const Graph = ({ userProfile }) => {
    let userName = userProfile?.login || 'sjxsubhamn'; // Fallback value checking 
    // console.log('userProfile:', userProfile);
    // console.log('userName:', userName); 
  return (
    <div>
       <a href={`https://github.com/${userName}`}>
        <img 
          src={`https://github-readme-activity-graph.vercel.app/graph?username=${userName}&theme=github-compact&bg_color=282C35`} 
          alt={`${userName} GitHub activity graph`} 
        />
      </a>
    </div>
    // 
  );
};

export default Graph;