import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { useState } from 'react';
import './App.css';
import { type File } from '../main/util';
import FilesTable from './FilesTable';

function Hello() {
  const [selectedZipPath, setSelectedZipPath] = useState<string | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<string | null>(
    null,
  );
  const [files, setFiles] = useState<File[] | null>(null);

  window.electron.ipcRenderer.on('file-selected', (file) => {
    setSelectedZipPath(file as string);
  });

  window.electron.ipcRenderer.on(
    'destination-selected',
    (...args: unknown[]) => {
      setSelectedDestination(args[0] as string);
      setFiles(args[1] as File[]);
    },
  );

  const handleFileSelect = () => {
    setSelectedZipPath(null);
    setSelectedDestination(null);
    window.electron.ipcRenderer.sendMessage('open-file-dialog');
  };

  const handleDestinationSelect = () => {
    setSelectedDestination(null);
    window.electron.ipcRenderer.sendMessage(
      'open-destination-dialog',
      selectedZipPath,
    );
  };

  return (
    <div>
      <h1>Zip Processing App</h1>
      <div>
        <button type="button" onClick={handleFileSelect}>
          {!selectedZipPath ? 'Select ZIP File' : 'Change ZIP File'}
        </button>
      </div>
      <div>
        <button
          type="button"
          onClick={handleDestinationSelect}
          disabled={!selectedZipPath}
        >
          {!selectedDestination ? 'Select destination' : 'Change Destination'}
        </button>
        {selectedDestination && <p>{selectedDestination}</p>}
      </div>
      {selectedZipPath && selectedDestination && files && (
        <FilesTable
          files={files}
          zipPath={selectedZipPath}
          destination={selectedDestination}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Hello />} />
      </Routes>
    </Router>
  );
}
