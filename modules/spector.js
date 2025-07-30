import { Spector } from 'spectorjs';

export default function initSpector() {
  const spector = new Spector();
  spector.displayUI();
  spector.spyCanvases();

  // Uncomment to export Spector data to JSON
  /*
  spector.onCapture.add((capture) => {
    const dataStr = JSON.stringify(capture, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'local_profiling.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  });
  */

  return spector;
}
