/* eslint import/prefer-default-export: off */
import { URL } from 'url';
import path from 'path';
import AdmZip from 'adm-zip';

export function resolveHtmlPath(htmlFileName: string) {
  if (process.env.NODE_ENV === 'development') {
    const port = process.env.PORT || 1212;
    const url = new URL(`http://localhost:${port}`);
    url.pathname = htmlFileName;
    return url.href;
  }
  return `file://${path.resolve(__dirname, '../renderer/', htmlFileName)}`;
}

// Type
export type File = {
  fileName: string;
  filePath: string;
};

// Function to recursively extract file names from ZIP entries
export function extractFileNames(
  zip: AdmZip,
  zipEntries: AdmZip.IZipEntry[],
): File[] {
  const files: File[] = [];

  zipEntries.forEach((zipEntry) => {
    if (!zipEntry.isDirectory) {
      const fileName = zipEntry.entryName.split('/').pop()!;
      const filePath = zipEntry.entryName;
      files.push({ fileName, filePath });
    }
  });

  return files;
}
