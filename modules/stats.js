import Stats from 'stats.js';

export default function initStats() {
  const stats = new Stats();
  document.body.appendChild(stats.dom);
  return stats;
}
