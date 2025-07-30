/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface TimeEntry {
  date: string;
  user: string;
  client: string;
  project: string;
  task: string;
  time_field_1307: string;
  duration: string;
  note: string;
}

interface ParsedData {
  client?: string;
  entries: TimeEntry[];
}

type GroupingOption = 'none' | 'date' | 'user' | 'client' | 'project' | 'task';

const GROUPING_OPTIONS: { value: GroupingOption; label: string }[] = [
  { value: 'none', label: 'No grouping' },
  { value: 'date', label: 'Date' },
  { value: 'user', label: 'User' },
  { value: 'client', label: 'Client' },
  { value: 'project', label: 'Project' },
  { value: 'task', label: 'Task' }
];

// Helper function to transform XML data to ParsedData format
function transformXmlData(xmlData: Record<string, unknown>): ParsedData {
  // Handle the XML structure: <rows><row>...</row></rows>
  if (xmlData.rows && (xmlData.rows as Record<string, unknown>).row) {
    const rowsData = (xmlData.rows as Record<string, unknown>).row;
    const rows = Array.isArray(rowsData) ? rowsData : [rowsData];
    
    const entries: TimeEntry[] = rows.map((row: Record<string, unknown>) => ({
      date: String(row.date || ''),
      user: String(row.user || ''),
      client: String(row.client || ''),
      project: String(row.project || ''),
      task: String(row.time_field_1307 || ''), // Use time_field_1307 as task
      time_field_1307: String(row.time_field_1307 || ''),
      duration: String(row.duration || '0'),
      note: String(row.note || '')
    }));

    // Get client name from first entry if available
    const client = entries.length > 0 ? entries[0].client : undefined;

    return {
      client,
      entries
    };
  }

  // Fallback: if data already has entries array, return as is
  if (xmlData.entries && Array.isArray(xmlData.entries)) {
    return xmlData as unknown as ParsedData;
  }

  // If no recognizable structure, return empty data
  return {
    client: undefined,
    entries: []
  };
}

export default function PreviewPage() {
  const [data, setData] = useState<ParsedData | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [groupBy1, setGroupBy1] = useState<GroupingOption>('date');
  const [groupBy2, setGroupBy2] = useState<GroupingOption>('none');
  const [groupBy3, setGroupBy3] = useState<GroupingOption>('none');
  const router = useRouter();

  useEffect(() => {
    const storedData = localStorage.getItem('parsedXmlData');
    if (!storedData) {
      router.push('/upload');
      return;
    }
    
    try {
      const parsedData = JSON.parse(storedData);
      const transformedData = transformXmlData(parsedData);
      
      if (transformedData.entries.length === 0) {
        console.error('No valid entries found in XML data');
        router.push('/upload');
        return;
      }
      
      setData(transformedData);
      // Generate initial preview
      generatePreview(transformedData, 'date', 'none', 'none');
    } catch (error) {
      console.error('Error parsing stored data:', error);
      router.push('/upload');
    }
  }, []);

  const buildGroupingKey = (entry: TimeEntry, level1: GroupingOption, level2: GroupingOption, level3: GroupingOption): string => {
    const parts: string[] = [];
    
    if (level1 !== 'none') {
      parts.push(getGroupValue(entry, level1));
    }
    if (level2 !== 'none') {
      parts.push(getGroupValue(entry, level2));
    }
    if (level3 !== 'none') {
      parts.push(getGroupValue(entry, level3));
    }
    
    return parts.join(' → ');
  };

  const getGroupValue = (entry: TimeEntry, groupBy: GroupingOption): string => {
    switch (groupBy) {
      case 'date': return entry.date;
      case 'user': return entry.user;
      case 'client': return entry.client;
      case 'project': return entry.project;
      case 'task': return entry.task || 'No Task';
      default: return '';
    }
  };

  const generatePreview = async (parsedData: ParsedData, level1: GroupingOption, level2: GroupingOption, level3: GroupingOption) => {
    setIsLoading(true);
    
    try {
      // Group the data according to the selected levels
      const groupedData = new Map<string, TimeEntry[]>();
      
      parsedData.entries.forEach(entry => {
        const groupKey = buildGroupingKey(entry, level1, level2, level3);
        if (!groupedData.has(groupKey)) {
          groupedData.set(groupKey, []);
        }
        groupedData.get(groupKey)!.push(entry);
      });

      // Generate the HTML content
      const htmlContent = generateTimesheetHTML(parsedData, groupedData, level1, level2, level3);
      setPreviewHtml(htmlContent);
    } catch (error) {
      console.error('Error generating preview:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateTimesheetHTML = (
    data: ParsedData, 
    groupedData: Map<string, TimeEntry[]>,
    level1: GroupingOption,
    level2: GroupingOption, 
    level3: GroupingOption
  ): string => {
    const totalHours = data.entries.reduce((sum, entry) => sum + parseFloat(entry.duration || '0'), 0);
    const totalEntries = data.entries.length;
    const uniqueUsers = [...new Set(data.entries.map(entry => entry.user))];
    const uniqueProjects = [...new Set(data.entries.map(entry => entry.project))];

    // Build grouping description
    const groupingLevels = [level1, level2, level3].filter(level => level !== 'none');
    const groupingDescription = groupingLevels.length > 0 
      ? `Grouped by: ${groupingLevels.map(level => level.charAt(0).toUpperCase() + level.slice(1)).join(' → ')}`
      : 'No grouping applied';

    // Show first 3 groups for preview
    const groupEntries = Array.from(groupedData.entries()).slice(0, 3);

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f8fafc;
            color: #1e293b;
            line-height: 1.6;
          }
          .container {
            max-width: 210mm;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 3px solid #3b82f6;
          }
          .client-name {
            font-size: 28px;
            font-weight: bold;
            color: #1e40af;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .report-title {
            font-size: 20px;
            color: #64748b;
            margin-bottom: 5px;
          }
          .grouping-info {
            font-size: 14px;
            color: #6b7280;
            font-style: italic;
            margin-top: 10px;
          }
          .summary-section {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
          }
          .summary-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
          }
          .summary-card h3 {
            margin: 0 0 10px 0;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            opacity: 0.9;
          }
          .summary-card .value {
            font-size: 24px;
            font-weight: bold;
            margin: 0;
          }
          .details-section {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 30px;
          }
          .detail-card {
            background: #f8fafc;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #3b82f6;
          }
          .detail-card h3 {
            margin: 0 0 15px 0;
            color: #1e40af;
            font-size: 16px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .detail-list {
            list-style: none;
            padding: 0;
            margin: 0;
          }
          .detail-list li {
            padding: 5px 0;
            border-bottom: 1px solid #e2e8f0;
            color: #475569;
          }
          .detail-list li:last-child {
            border-bottom: none;
          }
          .entries-section {
            margin-top: 30px;
          }
          .group-header {
            background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
            color: white;
            padding: 15px 20px;
            margin: 20px 0 0 0;
            border-radius: 8px 8px 0 0;
            font-weight: bold;
            font-size: 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .group-stats {
            font-size: 14px;
            opacity: 0.9;
          }
          .entries-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            background: white;
            border-radius: 0 0 8px 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .entries-table th {
            background: #f1f5f9;
            padding: 12px 8px;
            text-align: left;
            font-weight: 600;
            color: #334155;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 2px solid #e2e8f0;
          }
          .entries-table td {
            padding: 10px 8px;
            border-bottom: 1px solid #f1f5f9;
            font-size: 13px;
            color: #475569;
          }
          .entries-table tr:hover {
            background-color: #f8fafc;
          }
          .duration-cell {
            font-weight: 600;
            color: #059669;
            text-align: right;
          }
          .note-cell {
            max-width: 300px;
            word-wrap: break-word;
            white-space: normal;
            line-height: 1.4;
          }
          .preview-notice {
            background: #fef3c7;
            border: 1px solid #f59e0b;
            color: #92400e;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            text-align: center;
            font-weight: 500;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="client-name">${data.client || 'Timesheet Report'}</div>
            <div class="report-title">Professional Timesheet Report</div>
            <div class="grouping-info">${groupingDescription}</div>
          </div>

          <div class="summary-section">
            <div class="summary-card">
              <h3>Total Hours</h3>
              <p class="value">${totalHours.toFixed(2)}</p>
            </div>
            <div class="summary-card">
              <h3>Total Entries</h3>
              <p class="value">${totalEntries}</p>
            </div>
            <div class="summary-card">
              <h3>Team Members</h3>
              <p class="value">${uniqueUsers.length}</p>
            </div>
            <div class="summary-card">
              <h3>Projects</h3>
              <p class="value">${uniqueProjects.length}</p>
            </div>
          </div>

          <div class="details-section">
            <div class="detail-card">
              <h3>Team Members</h3>
              <ul class="detail-list">
                ${uniqueUsers.map(user => `<li>${user}</li>`).join('')}
              </ul>
            </div>
            <div class="detail-card">
              <h3>Projects</h3>
              <ul class="detail-list">
                ${uniqueProjects.map(project => `<li>${project}</li>`).join('')}
              </ul>
            </div>
          </div>

          ${groupEntries.length > 0 ? `
            <div class="preview-notice">
              Preview showing first ${groupEntries.length} group(s) of ${groupedData.size} total groups
            </div>
          ` : ''}

          <div class="entries-section">
            ${groupEntries.map(([groupKey, entries]) => {
              const groupHours = entries.reduce((sum, entry) => sum + parseFloat(entry.duration || '0'), 0);
              return `
                <div class="group-header">
                  <span>${groupKey || 'All Entries'}</span>
                  <span class="group-stats">${entries.length} entries • ${groupHours.toFixed(2)} hours</span>
                </div>
                <table class="entries-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>User</th>
                      <th>Client</th>
                      <th>Project</th>
                      <th>Task</th>
                      <th>Start Time</th>
                      <th>Duration</th>
                      <th>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${entries.map(entry => `
                      <tr>
                        <td>${entry.date}</td>
                        <td>${entry.user}</td>
                        <td>${entry.client}</td>
                        <td>${entry.project}</td>
                        <td>${entry.task || '-'}</td>
                        <td>${entry.time_field_1307}</td>
                        <td class="duration-cell">${entry.duration}h</td>
                        <td class="note-cell" title="${(entry.note || '').replace(/"/g, '&quot;')}">${entry.note || '-'}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              `;
            }).join('')}
          </div>
        </div>
      </body>
      </html>
    `;
  };

  const handlePreview = () => {
    if (data) {
      generatePreview(data, groupBy1, groupBy2, groupBy3);
    }
  };

  const handleGeneratePDF = async () => {
    if (!data) return;

    setIsLoading(true);
    try {
      // Build grouping parameter for the API
      const groupingLevels = [groupBy1, groupBy2, groupBy3].filter(level => level !== 'none');
      const groupingParam = groupingLevels.join(',');

      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          data, 
          grouping: groupingParam || 'date' 
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `timesheet-report-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading preview...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">PDF Preview</h1>
              <p className="text-sm text-gray-600">Review your timesheet report before generating PDF</p>
            </div>
            <div className="flex space-x-4">
              <button
                onClick={() => router.push('/upload')}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Upload New File
              </button>
              <button
                onClick={handleGeneratePDF}
                disabled={isLoading}
                className="px-6 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Generating...' : 'Generate PDF'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Grouping Controls */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Grouping Options</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Primary Grouping
              </label>
              <select
                value={groupBy1}
                onChange={(e) => setGroupBy1(e.target.value as GroupingOption)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {GROUPING_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Secondary Grouping
              </label>
              <select
                value={groupBy2}
                onChange={(e) => setGroupBy2(e.target.value as GroupingOption)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {GROUPING_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tertiary Grouping
              </label>
              <select
                value={groupBy3}
                onChange={(e) => setGroupBy3(e.target.value as GroupingOption)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {GROUPING_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <button
                onClick={handlePreview}
                disabled={isLoading}
                className="w-full px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Loading...' : 'Preview'}
              </button>
            </div>
          </div>
          
          <div className="mt-4 text-sm text-gray-600">
            <p>
              <strong>Current grouping:</strong> {
                [groupBy1, groupBy2, groupBy3]
                  .filter(level => level !== 'none')
                  .map(level => level.charAt(0).toUpperCase() + level.slice(1))
                  .join(' → ') || 'No grouping'
              }
            </p>
          </div>
        </div>

        {/* Preview */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Preview</h2>
            <p className="text-sm text-gray-600">This is how your PDF will look</p>
          </div>
          
          <div className="p-6">
            {previewHtml ? (
              <div 
                className="border border-gray-200 rounded-lg overflow-hidden"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            ) : (
              <div className="text-center py-12">
                <div className="text-gray-400">
                  <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No preview available</h3>
                <p className="mt-1 text-sm text-gray-500">Click &quot;Preview&quot; to generate a preview of your PDF</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 