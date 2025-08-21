import React, { useEffect, useRef } from 'react';
import { Chart } from 'chart.js/auto';

export default function LanguageChart({ languages }) {
  const ref = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!languages || !ref.current) return;
    if (chartRef.current) chartRef.current.destroy();

    const top = languages.slice(0, 8);
    chartRef.current = new Chart(ref.current, {
      type: 'doughnut',
      data: {
        labels: top.map(l => l.language),
        datasets: [{
          data: top.map(l => l.count),
          backgroundColor: [
            '#238636','#1f6feb','#9e6a03','#a371f7',
            '#8957e5','#d29922','#f0883e','#db6d28'
          ]
        }]
      },
      options: {
        plugins: {
          legend: { position: 'bottom', labels: { color: '#e6edf3', font: { size: 11 } } }
        }
      }
    });
  }, [languages]);

  return (
    <div className="panel bg-glass">
      <h3 className="text-base font-semibold mb-4">Languages (Repo Count) </h3>
      <canvas ref={ref} height="220" />
    </div>
  );
}