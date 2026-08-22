import React from 'react';
import { Download } from 'lucide-react';
import { api } from '../../services/api';

interface ExportButtonProps {
  filename: string;
  data: Record<string, any>[];
  label?: string;
}

export const ExportButton: React.FC<ExportButtonProps> = ({
  filename,
  data,
  label = 'Export CSV',
}) => {
  const handleExport = async () => {
    if (!data || data.length === 0) {
      alert('No data available to export.');
      return;
    }

    const headers = Object.keys(data[0]);
    const csvRows = [];

    // Header row
    csvRows.push(headers.map(h => `"${h}"`).join(','));

    // Data rows
    for (const row of data) {
      const values = headers.map(header => {
        const val = row[header] ?? '';
        const escaped = String(val).replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    try {
      await api.logAction('EXPORT', filename, `Exported ${data.length} records to CSV archive (${filename})`);
    } catch (e) {
      // ignore log failure
    }
  };

  return (
    <button
      onClick={handleExport}
      className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
    >
      <Download className="w-3.5 h-3.5 text-slate-500" />
      {label}
    </button>
  );
};
