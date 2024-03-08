import React, { useState } from 'react';
import { type File } from '../main/util';

export type DataFile = File & {
  willCopy: boolean;
  isProcessed: boolean;
};

function FilesTable({
  files,
  destination,
  zipPath,
}: {
  files: File[];
  destination: string;
  zipPath: string;
}) {
  const [data, setData] = useState<DataFile[]>(
    files.map((file) => ({
      ...file,
      willCopy: false,
      isProcessed: false,
    })),
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: keyof DataFile,
    index: number,
  ) => {
    let newValue: boolean | string;

    if (field === 'willCopy') {
      newValue = e.target.checked;
    } else {
      newValue = e.target.value;
    }

    setData((prevData) => {
      const newData = [...prevData];
      newData[index] = {
        ...newData[index],
        [field]: newValue,
      };
      return newData;
    });
  };

  const handleProcess = () => {
    // Process the data
    setIsProcessing(true);
    window.electron.ipcRenderer.sendMessage(
      'process-files',
      data,
      zipPath,
      destination,
    );
  };

  window.electron.ipcRenderer.on(
    'process-files',
    (processedFiles, hasFinished) => {
      setData(processedFiles as DataFile[]);
      if (hasFinished) {
        setIsProcessing(false);
      }
    },
  );

  window.electron.ipcRenderer.on('process-files-error', (error) => {
    // eslint-disable-next-line no-alert
    alert(`Error processing file: ${error}`);
  });

  return (
    <>
      <table>
        <thead>
          <tr>
            <th>File</th>
            <th>Copy</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {data.map((file, index) => (
            // eslint-disable-next-line react/no-array-index-key
            <tr key={`${index}_tr`}>
              <td>
                <input
                  type="text"
                  value={file.fileName}
                  onChange={(e) => handleChange(e, 'fileName', index)}
                  readOnly={!file.willCopy}
                  style={{
                    padding: '0.5rem 0.8rem',
                  }}
                />
              </td>
              <td
              // style={{
              //   padding: '0 0.8rem',
              //   display: 'flex',
              //   alignItems: 'center',
              //   justifyContent: 'center',
              // }}
              >
                <input
                  type="checkbox"
                  checked={file.willCopy}
                  onChange={(e) => handleChange(e, 'willCopy', index)}
                />
              </td>
              <td>{file.isProcessed ? '✓' : '✗'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        type="button"
        onClick={handleProcess}
        disabled={isProcessing}
        style={{ marginTop: '1rem' }}
      >
        {isProcessing ? 'Processing...' : 'Process'}
      </button>
      {isProcessing && (
        <button type="button">{isPaused ? 'Paused' : 'Pause'}</button>
      )}
    </>
  );
}

export default FilesTable;
