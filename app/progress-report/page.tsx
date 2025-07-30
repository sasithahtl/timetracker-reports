'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface TimeEntry {
  id: string;
  date: string;
  user: string;
  project: string;
  task: string;
  description: string;
  hours: number;
  taskNumber?: string;
}

interface ParsedData {
  entries: TimeEntry[];
  summary: {
    totalHours: number;
    totalDays: number;
    users: string[];
    projects: string[];
  };
}

interface GroupedProgress {
  [user: string]: {
    projects: {
      [project: string]: {
        tasks: Array<{
          taskNumber?: string;
          description: string;
          hours: number;
          dates: string[];
        }>;
        totalHours: number;
      };
    };
    leave?: Array<{ date: string; reason: string }>;
    publicHolidays?: Array<{ date: string; reason: string }>;
    totalHours: number;
  };
}

interface XmlRow {
  id?: string;
  date?: string;
  user?: string;
  project?: string;
  time_field_1307?: string;
  duration?: string;
  note?: string;
  [key: string]: unknown;
}

interface XmlData {
  rows?: {
    row?: XmlRow | XmlRow[];
  };
  [key: string]: unknown;
}

export default function ProgressReportPage() {
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [groupedProgress, setGroupedProgress] = useState<GroupedProgress>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const router = useRouter();

  const extractTaskNumber = (task: string): string | undefined => {
    const match = task.match(/#(\d+)/);
    return match ? match[1] : undefined;
  };

  const transformXmlData = (xmlData: XmlData): ParsedData => {
    const entries: TimeEntry[] = [];
    
    // Handle the XML structure: <rows><row>...</row></rows>
    if (xmlData.rows && (xmlData.rows as Record<string, unknown>).row) {
      const rowsData = (xmlData.rows as Record<string, unknown>).row;
      const rows = Array.isArray(rowsData) ? rowsData : [rowsData];
      
      rows.forEach((row: XmlRow) => {
        const entry: TimeEntry = {
          id: String(row.id || ''),
          date: String(row.date || ''),
          user: String(row.user || ''),
          project: String(row.project || ''),
          task: String(row.time_field_1307 || ''), // Use time_field_1307 as task
          description: String(row.note || ''),
          hours: parseFloat(String(row.duration || '0')),
          taskNumber: extractTaskNumber(String(row.time_field_1307 || ''))
        };
        entries.push(entry);
      });
    }

    const users = [...new Set(entries.map(entry => entry.user))];
    const projects = [...new Set(entries.map(entry => entry.project))];
    const totalHours = entries.reduce((sum, entry) => sum + entry.hours, 0);
    const totalDays = [...new Set(entries.map(entry => entry.date))].length;

    return {
      entries,
      summary: {
        totalHours,
        totalDays,
        users,
        projects
      }
    };
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xml')) {
      setError('Please upload an XML file');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/parse-xml', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to parse XML file');
      }

      const data = await response.json();
      console.log('Raw XML data:', data); // Debug log
      
      const transformedData = transformXmlData(data);
      console.log('Transformed data:', transformedData); // Debug log
      
      setParsedData(transformedData);
      processData(transformedData);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsUploading(false);
    }
  };

  const processData = (data: ParsedData) => {
    console.log('Processing data with entries:', data.entries.length); // Debug log
    const grouped: GroupedProgress = {};

    data.entries.forEach(entry => {
      console.log('Processing entry:', entry); // Debug log
      
      if (!grouped[entry.user]) {
        grouped[entry.user] = {
          projects: {},
          totalHours: 0
        };
      }

      // Check if this is a public holiday entry
      const isPublicHoliday = entry.project.toLowerCase().includes('public holiday') || 
                             entry.task.toLowerCase().includes('public holiday') ||
                             entry.description.toLowerCase().includes('public holiday') ||
                             entry.project.toLowerCase().includes('public holidays') ||
                             entry.task.toLowerCase().includes('public holidays') ||
                             entry.description.toLowerCase().includes('public holidays');

      // Check if this is a regular leave entry (not public holiday)
      const isLeave = (entry.project.toLowerCase().includes('leave') || 
                      entry.task.toLowerCase().includes('leave') ||
                      entry.description.toLowerCase().includes('leave')) && !isPublicHoliday;

      if (isPublicHoliday) {
        if (!grouped[entry.user].publicHolidays) {
          grouped[entry.user].publicHolidays = [];
        }
        grouped[entry.user].publicHolidays?.push({
          date: entry.date,
          reason: entry.description || entry.task || 'Public Holiday'
        });
      } else if (isLeave) {
        if (!grouped[entry.user].leave) {
          grouped[entry.user].leave = [];
        }
        grouped[entry.user].leave?.push({
          date: entry.date,
          reason: entry.description || entry.task || 'Leave'
        });
      } else {
        if (!grouped[entry.user].projects[entry.project]) {
          grouped[entry.user].projects[entry.project] = {
            tasks: [],
            totalHours: 0
          };
        }

        // Find existing task with same task number or description
        const existingTaskIndex = grouped[entry.user].projects[entry.project].tasks.findIndex(task => {
          if (entry.taskNumber && task.taskNumber) {
            return task.taskNumber === entry.taskNumber;
          }
          return task.description === entry.description;
        });

        if (existingTaskIndex >= 0) {
          // Update existing task
          const existingTask = grouped[entry.user].projects[entry.project].tasks[existingTaskIndex];
          existingTask.hours += entry.hours;
          if (!existingTask.dates.includes(entry.date)) {
            existingTask.dates.push(entry.date);
          }
        } else {
          // Add new task
          grouped[entry.user].projects[entry.project].tasks.push({
            taskNumber: entry.taskNumber,
            description: entry.description,
            hours: entry.hours,
            dates: [entry.date]
          });
        }

        grouped[entry.user].projects[entry.project].totalHours += entry.hours;
      }

      grouped[entry.user].totalHours += entry.hours;
    });

    console.log('Grouped progress:', grouped); // Debug log
    setGroupedProgress(grouped);
  };

  const generateReportText = () => {
    if (!groupedProgress || Object.keys(groupedProgress).length === 0) {
      return '';
    }

    let report = `Here are the team's progress for the last 2 weeks as follows.\n\n`;

    Object.entries(groupedProgress).forEach(([user, userData]) => {
      report += `${user}\n`;

      // Add projects
      Object.entries(userData.projects).forEach(([project, projectData]) => {
        if (projectData.tasks.length > 0) {
          report += `${project}\n`;
          projectData.tasks.forEach(task => {
            const taskPrefix = task.taskNumber ? `#${task.taskNumber} | ` : '';
            const datesInfo = task.dates.length > 1 ? ` (${task.dates.join(', ')})` : '';
            report += `${taskPrefix}${task.description}${datesInfo}\n`;
          });
          report += '\n';
        }
      });

      // Add public holiday information
      if (userData.publicHolidays && userData.publicHolidays.length > 0) {
        const holidayDates = userData.publicHolidays.map(holiday => holiday.date).join(', ');
        report += `${holidayDates} - Public Holiday\n\n`;
      }

      // Add leave information
      if (userData.leave && userData.leave.length > 0) {
        const leaveDates = userData.leave.map(leave => leave.date).join(', ');
        report += `${leaveDates} - Leave\n\n`;
      }

      report += '\n';
    });

    return report;
  };

  const handleGenerateReport = async () => {
    if (!parsedData) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/generate-progress-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          groupedProgress,
          reportText: generateReportText()
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `team-progress-report.txt`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        console.error('Failed to generate report');
      }
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAiAnalysis = async () => {
    if (!parsedData || !aiPrompt.trim()) return;

    setIsAnalyzing(true);
    setAiAnalysis('');

    try {
      const response = await fetch('/api/ai-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: aiPrompt,
          data: {
            entries: parsedData.entries,
            summary: parsedData.summary,
            groupedProgress
          }
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setAiAnalysis(result.analysis);
      } else {
        setError('Failed to generate AI analysis');
      }
    } catch (error) {
      setError('Error generating AI analysis');
      console.error('Error:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/')}
            className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
          >
            ← Back to Home
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Team Progress Report Generator</h1>
          <p className="mt-2 text-gray-600">
            Upload an XML file to generate a professional team progress report with AI analysis
          </p>
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload XML File</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-center w-full">
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <svg className="w-8 h-8 mb-4 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
                  </svg>
                  <p className="mb-2 text-sm text-gray-500">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-gray-500">XML files only</p>
                </div>
                <input 
                  type="file" 
                  className="hidden" 
                  accept=".xml"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                />
              </label>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-red-800">{error}</p>
              </div>
            )}

            {isUploading && (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                <span className="ml-2 text-gray-600">Processing XML...</span>
              </div>
            )}
          </div>
        </div>

        {/* AI Analysis Section */}
        {parsedData && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">AI Analysis</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Analysis Prompt
                </label>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Enter your analysis prompt here. For example: 'Analyze team productivity trends and identify areas for improvement' or 'Summarize the most time-consuming tasks and suggest optimization strategies'"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={4}
                />
              </div>
              
              <button
                onClick={handleAiAnalysis}
                disabled={isAnalyzing || !aiPrompt.trim()}
                className="bg-purple-600 text-white px-6 py-2 rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isAnalyzing ? 'Analyzing...' : 'Generate AI Analysis'}
              </button>

              {aiAnalysis && (
                <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-md">
                  <h3 className="font-semibold text-purple-900 mb-2">AI Analysis Results:</h3>
                  <div className="text-purple-800 whitespace-pre-wrap">{aiAnalysis}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Generate Report Button */}
        {parsedData && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex gap-4">
              <button
                onClick={handleGenerateReport}
                disabled={isLoading}
                className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Generating...' : 'Generate Report'}
              </button>
            </div>
          </div>
        )}

        {/* Preview Section */}
        {parsedData && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Report Preview</h2>
            
            {Object.keys(groupedProgress).length > 0 ? (
              <div className="space-y-6">
                {Object.entries(groupedProgress).map(([user, userData]) => (
                  <div key={user} className="border border-gray-200 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">{user}</h3>
                    
                    {Object.entries(userData.projects).map(([project, projectData]) => {
                      if (projectData.tasks.length > 0) {
                        return (
                          <div key={project} className="mb-4">
                            <h4 className="font-medium text-gray-800 mb-2">{project}</h4>
                            <div className="space-y-1 ml-4">
                              {projectData.tasks.map((task, index) => (
                                <div key={index} className="text-sm text-gray-700">
                                  {task.taskNumber && <span className="font-mono text-blue-600">#{task.taskNumber}</span>}
                                  {task.taskNumber && ' | '}
                                  {task.description}
                                  {task.dates.length > 1 && (
                                    <span className="text-gray-500 text-xs ml-2">
                                      ({task.dates.join(', ')})
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })}

                    {userData.publicHolidays && userData.publicHolidays.length > 0 && (
                      <div className="mt-3">
                        <div className="text-sm text-orange-600 font-medium">
                          {userData.publicHolidays.map(holiday => holiday.date).join(', ')} - Public Holiday
                        </div>
                      </div>
                    )}

                    {userData.leave && userData.leave.length > 0 && (
                      <div className="mt-3">
                        <div className="text-sm text-red-600 font-medium">
                          {userData.leave.map(leave => leave.date).join(', ')} - Leave
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600">No data to display.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 