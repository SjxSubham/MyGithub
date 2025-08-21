import React, { useEffect, useRef } from 'react';
import { Chart } from 'chart.js/auto';

export default function ActivityTrends({ events }) {
  const canvas = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!events || !canvas.current) return;
    const daily = {};
    events.forEach(e => {
      const d = e.created_at.slice(0, 10);
      daily[d] = (daily[d] || 0) + 1;
    });
    const labels = Object.keys(daily).sort();
    const data = labels.map(l => daily[l]);

    if (chartRef.current) chartRef.current.destroy();
    chartRef.current = new Chart(canvas.current, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Events',
          data,
          borderColor: '#1f6feb',
          backgroundColor: 'rgba(31,111,235,0.25)',
          tension: 0.3,
          fill: true,
          pointRadius: 2
        }]
      },
      options: {
        scales: {
          x: { ticks: { color: '#8b949e' }, grid: { color: '#222' } },
          y: { ticks: { color: '#8b949e' }, grid: { color: '#222' } }
        },
        plugins: {
          legend: { labels: { color: '#e6edf3' } }
        }
      }
    });
  }, [events]);

  return (
    <div className="panel bg-glass">
      <h3 className="text-base font-semibold mb-4">Activity (Daily Events)</h3>
      <canvas ref={canvas} height="220" />
    </div>
  );
}