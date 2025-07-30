'use client';

import React, { useState, useEffect } from 'react';
import type { JSX } from 'react';
import Link from 'next/link';

interface TimeEntry {
  id: number;
  user_id: number;
  user_name: string;
  user_login: string;
  date: string;
  start: string | null;
  duration: string | null;
  project_name: string | null;
  task_name: string | null;
  client_name: string | null;
  comment: string | null;
  billable: number;
  approved: number;
  paid: number;
  task_id?: number; // Added for task number
  task_number?: string; // Added for custom task number
}

interface User {
  id: number;
  name: string;
  login: string;
  email: string | null;
}

interface Project {
  id: number;
  name: string;
  description: string | null;
  client_ids?: number[]; // Added for client filtering
}

interface Client {
  id: number;
  name: string;
  address: string | null;
}

export default function DatabasePage() {
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states
  const [selectedUser, setSelectedUser] = useState<string>('');
  // Change selectedProject from string to array
  const [selectedProject, setSelectedProject] = useState<string[]>([]);
  const [selectedTask, setSelectedTask] = useState<string>('');
  const [selectedClient, setSelectedClient] = useState<string>('');
  // Default date range - will be updated with actual database range
  const [dateFrom, setDateFrom] = useState<string>('2025-07-01');
  const [dateTo, setDateTo] = useState<string>('2025-07-31');
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  // Add billable filter state
  const [billableOnly, setBillableOnly] = useState(false);
  // Add totals only filter state
  const [totalsOnly, setTotalsOnly] = useState(false);

  // Add state for group by dropdowns
  const groupByOptions = [
    { value: 'no_grouping', label: '--- no grouping ---' },
    { value: 'date', label: 'date' },
    { value: 'user', label: 'user' },
    { value: 'client', label: 'client' },
    { value: 'project', label: 'project' },
    { value: 'time_field_2', label: 'Task / Bug Number' },
  ];
  const [groupBy1, setGroupBy1] = useState<string>('user');
  const [groupBy2, setGroupBy2] = useState<string>('no_grouping');
  const [groupBy3, setGroupBy3] = useState<string>('no_grouping');

  useEffect(() => {
    loadInitialData();
  }, []);

  // Fetch projects for selected client
  useEffect(() => {
    const fetchProjects = async () => {
      if (selectedClient) {
        const res = await fetch(`/api/database?action=projectsByClient&client_id=${selectedClient}`);
        if (res.ok) {
          const data = await res.json();
          setFilteredProjects(data);
        } else {
          setFilteredProjects([]);
        }
      } else {
        setFilteredProjects(projects);
      }
    };
    fetchProjects();
  }, [selectedClient, projects]);

  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load all data in parallel
      const [entriesRes, usersRes, projectsRes, clientsRes, dateRangeRes] = await Promise.all([
        fetch('/api/database?action=timeEntries'),
        fetch('/api/database?action=users'),
        fetch('/api/database?action=projects'),
        fetch('/api/database?action=clients'),
        fetch('/api/database?action=dateRange')
      ]);

      if (!entriesRes.ok || !usersRes.ok || !projectsRes.ok || !clientsRes.ok || !dateRangeRes.ok) {
        throw new Error('Failed to load data from database');
      }

      const [entries, usersData, projectsData, clientsData, dateRangeData] = await Promise.all([
        entriesRes.json(),
        usersRes.json(),
        projectsRes.json(),
        clientsRes.json(),
        dateRangeRes.json()
      ]);

      setTimeEntries(entries);
      setUsers(usersData);
      setProjects(projectsData);
      setClients(clientsData);
      
      // Update date range with actual database range
      if (dateRangeData && dateRangeData.min_date && dateRangeData.max_date) {
        setDateFrom(dateRangeData.min_date);
        setDateTo(dateRangeData.max_date);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams({
        action: 'filteredEntries'
      });

      if (selectedUser) params.append('user_id', selectedUser);
      if (selectedProject.length > 0) {
        selectedProject.forEach(projectId => params.append('project_id', projectId));
      }
      if (selectedTask) params.append('task_id', selectedTask);
      if (selectedClient) params.append('client_id', selectedClient);
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      if (billableOnly) params.append('billable', '1');

      const response = await fetch(`/api/database?${params}`);
      if (!response.ok) {
        throw new Error('Failed to filter data');
      }

      const data = await response.json();
      setTimeEntries(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to filter data');
    } finally {
      setIsLoading(false);
    }
  };

  const clearFilters = () => {
    setSelectedUser('');
    setSelectedProject([]);
    setSelectedTask('');
    setSelectedClient('');
    setDateFrom('2025-07-01');
    setDateTo('2025-07-31');
    setBillableOnly(false);
    setTotalsOnly(false);
    loadInitialData();
  };

  const generatePDF = async () => {
    try {
      // Transform database entries to match the expected format
      // In generatePDF, pass the selected client name as the 'client' property in the data object
      const clientName = selectedClient ? (clients.find(c => String(c.id) === selectedClient)?.name || '') : '';
      const transformedData = {
        client: clientName,
        entries: timeEntries.map(entry => ({
          // Only date part
          date: getDateOnly(entry.date),
          user: entry.user_name || entry.user_login,
          client: entry.client_name || 'No Client',
          project: entry.project_name || 'No Project',
          // Include task number with name
          task: entry.task_id ? `#${entry.task_id} ${entry.task_name || ''}`.trim() : (entry.task_name || 'No Task'),
          time_field_1307: entry.start || '',
          duration: entry.duration || '0',
          note: entry.comment || ''
        }))
      };

      // In generatePDF, build grouping string based on dropdowns
      const buildGrouping = () => {
        const g1 = groupBy1 !== 'no_grouping' ? groupBy1 : null;
        const g2 = groupBy2 !== 'no_grouping' && groupBy2 !== groupBy1 ? groupBy2 : null;
        const g3 = groupBy3 !== 'no_grouping' && groupBy3 !== groupBy1 && groupBy3 !== groupBy2 ? groupBy3 : null;
        return [g1, g2, g3].filter(Boolean).join(',');
      };

      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: transformedData,
          grouping: buildGrouping() || 'none',
          totalsOnly: totalsOnly, // Pass the totals only flag
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `database-timesheet-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate PDF');
    }
  };

  const formatDuration = (duration: string | null) => {
    if (!duration) return '0:00';
    // Assuming duration is in HH:MM:SS format
    const parts = duration.split(':');
    if (parts.length >= 2) {
      return `${parts[0]}:${parts[1]}`;
    }
    return duration;
  };

  // Helper to extract only the date part from ISO string
  const getDateOnly = (dateStr: string) => {
    if (!dateStr) return '';
    // Handles both 'YYYY-MM-DD' and 'YYYY-MM-DDTHH:mm:ss.sssZ'
    return dateStr.split('T')[0];
  };

  // Filter projects by selected client
  // const filteredProjects = selectedClient
  //   ? projects.filter(p => {
  //       // Assume project has a client_ids array or similar, otherwise needs backend support
  //       // For now, fallback to all projects if not available
  //       // This will be replaced after backend endpoint is added
  //       return !p.client_ids || p.client_ids.includes(Number(selectedClient));
  //     })
  //   : projects;

  // Helper to sum durations in HH:MM or HH:MM:SS format
  function sumDurations(entries: TimeEntry[]): string {
    let totalMinutes = 0;
    for (const entry of entries) {
      if (!entry.duration) continue;
      const [h, m] = entry.duration.split(':');
      totalMinutes += parseInt(h || '0', 10) * 60 + parseInt(m || '0', 10);
    }
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
  }

  // Grouping types - Updated to handle 3-level nesting properly
  interface Group {
    key: string | null;
    entries: TimeEntry[];
  }

  interface NestedGroup {
    key: string | null;
    entries: Group[];
  }

  interface DeepNestedGroup {
    key: string | null;
    entries: NestedGroup[];
  }

  // Grouping logic - Updated to handle proper typing
  function groupEntries(entries: TimeEntry[], groupBy1: string, groupBy2: string, groupBy3: string): (Group | NestedGroup | DeepNestedGroup)[] {
    if (!entries.length) return [];
    
    const g1 = groupBy1 !== 'no_grouping' ? groupBy1 : null;
    const g2 = groupBy2 !== 'no_grouping' && groupBy2 !== groupBy1 ? groupBy2 : null;
    const g3 = groupBy3 !== 'no_grouping' && groupBy3 !== groupBy1 && groupBy3 !== groupBy2 ? groupBy3 : null;
    
    if (!g1) return [{ key: null, entries }];
    
    const getKey = (entry: TimeEntry, key: string): string => {
      switch (key) {
        case 'date': return getDateOnly(entry.date);
        case 'user': return entry.user_name || entry.user_login;
        case 'client': return entry.client_name || '-';
        case 'project': return entry.project_name || '-';
        case 'time_field_2': return entry.task_number || '-';
        default: return '-';
      }
    };
    
    const grouped: Record<string, TimeEntry[]> = {};
    for (const entry of entries) {
      const k1 = getKey(entry, g1) || '-';
      if (!grouped[k1]) grouped[k1] = [];
      grouped[k1].push(entry);
    }
    
    if (!g2) {
      return Object.entries(grouped).map(([key, groupEntries]) => ({ 
        key, 
        entries: groupEntries 
      })) as Group[];
    }
    
    // Nested grouping (2 or 3 levels)
    return Object.entries(grouped).map(([key, groupEntries]) => {
      const nested: Record<string, TimeEntry[]> = {};
      for (const entry of groupEntries) {
        const k2 = getKey(entry, g2) || '-';
        if (!nested[k2]) nested[k2] = [];
        nested[k2].push(entry);
      }
      
      if (!g3) {
        return {
          key,
          entries: Object.entries(nested).map(([subkey, subentries]) => ({ 
            key: subkey, 
            entries: subentries 
          }))
        } as NestedGroup;
      }
      
      // 3rd level
      return {
        key,
        entries: Object.entries(nested).map(([subkey, subentries]) => {
          const nested3: Record<string, TimeEntry[]> = {};
          for (const entry of subentries) {
            const k3 = getKey(entry, g3) || '-';
            if (!nested3[k3]) nested3[k3] = [];
            nested3[k3].push(entry);
          }
          return {
            key: subkey,
            entries: Object.entries(nested3).map(([k, v]) => ({ 
              key: k, 
              entries: v 
            }))
          };
        })
      } as DeepNestedGroup;
    });
  }

  function flattenEntries(group: Group | NestedGroup | DeepNestedGroup): TimeEntry[] {
    if ('entries' in group && group.entries.length > 0) {
      if ('id' in group.entries[0]) {
        // Group
        return (group as Group).entries as TimeEntry[];
      } else {
        // NestedGroup or DeepNestedGroup
        return (group.entries as (Group | NestedGroup | DeepNestedGroup)[]).flatMap(flattenEntries);
      }
    }
    return [];
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-800">{error}</p>
            <button 
              onClick={loadInitialData}
              className="mt-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Before rendering and before PDF generation, sort timeEntries by date ascending
  const sortedTimeEntries = [...timeEntries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const grouped = groupEntries(sortedTimeEntries, groupBy1, groupBy2, groupBy3);
  const totalDuration = sumDurations(sortedTimeEntries);

  // Update renderRows to handle the new DeepNestedGroup type
  function renderRows(groups: (Group | NestedGroup | DeepNestedGroup)[], level = 0, parentKey = ''): JSX.Element[] {
    return groups.map(group => {
      const groupKey = `${parentKey}-${group.key || 'empty'}`;
      
      if ('entries' in group && group.entries.length && !('entries' in group.entries[0])) {
        // Leaf group (Group type)
        const leafGroup = group as Group;
        return [
          <tr key={`header-${groupKey}`} className={level === 0 ? 'bg-gray-100 font-bold' : 'bg-gray-50 font-semibold'}>
            <td colSpan={7} className="py-2 px-4 text-left">{level === 0 ? 'Subtotal' : 'Subgroup'} <span className="text-blue-700">{leafGroup.key}</span></td>
            <td className="py-2 px-4 text-right">{sumDurations(leafGroup.entries)}</td>
          </tr>,
          // Only show individual entries if totalsOnly is false
          ...(totalsOnly ? [] : leafGroup.entries.map(entry => (
            <tr key={entry.id} className="hover:bg-gray-50">
              <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900 w-24" title={getDateOnly(entry.date)}>{getDateOnly(entry.date)}</td>
              <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900 w-32 truncate" title={entry.user_name || entry.user_login}>{entry.user_name || entry.user_login}</td>
              <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900 w-32 truncate" title={entry.client_name || '-'}>{entry.client_name || '-'}</td>
              <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900 w-40 truncate" title={entry.project_name || '-'}>{entry.project_name || '-'}</td>
              <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900 w-32 truncate" title={`${entry.task_number || (entry.task_id ? `#${entry.task_id}` : '-')}${entry.task_name ? ` ${entry.task_name}` : ''}`}>{`${entry.task_number || (entry.task_id ? `#${entry.task_id}` : '-')}${entry.task_name ? ` ${entry.task_name}` : ''}`}</td>
              <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900 w-16 text-right">{formatDuration(entry.duration)}</td>
              <td className="px-4 py-4 text-sm text-gray-900 max-w-2xl break-words whitespace-pre-line" style={{wordBreak: 'break-word'}} title={entry.comment || ''}>
                {entry.comment && entry.comment.length > 120 ? (
                  <span>{entry.comment.slice(0, 120)}... <span className="text-blue-500">(hover to view)</span></span>
                ) : (entry.comment || '-')}
              </td>
            </tr>
          )))
        ];
      } else {
        // Nested group (NestedGroup or DeepNestedGroup)
        const nestedGroup = group as NestedGroup | DeepNestedGroup;
        return [
          <tr key={`header-${groupKey}`} className={level === 0 ? 'bg-gray-200 font-bold' : 'bg-gray-100 font-semibold'}>
            <td colSpan={8} className="py-2 px-4 text-left">{level === 0 ? 'Subtotal' : 'Subgroup'} <span className="text-blue-700">{nestedGroup.key}</span></td>
          </tr>,
          // Always show nested group headers and subtotals, but hide individual entries when totalsOnly is true
          ...renderRows(nestedGroup.entries, level + 1, groupKey),
          <tr key={`subtotal-${groupKey}`} className="bg-gray-100 font-bold">
            <td colSpan={7} className="py-2 px-4 text-right">Subtotal <span className="text-blue-700">{nestedGroup.key}</span></td>
            <td className="py-2 px-4 text-right">{sumDurations(flattenEntries(nestedGroup))}</td>
          </tr>
        ];
      }
    }).flat();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-10 w-full">
      <div className="w-full max-w-[1800px] mx-auto px-4 sm:px-8">
        {/* Header */}
        <div className="mb-10 flex flex-col gap-2 sm:gap-0 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-6">
          <div>
            <Link 
              href="/" 
              className="text-blue-600 hover:text-blue-800 text-base font-medium transition-colors"
            >
              ← Back to Home
            </Link>
            <h1 className="text-4xl font-extrabold text-slate-900 mt-2 tracking-tight">Database Timesheet Generator</h1>
            <p className="mt-1 text-lg text-slate-600 font-normal">Generate PDF reports directly from the MySQL database</p>
          </div>
        </div>

        {/* Filters Section */}
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-8 mb-10 flex flex-col gap-6">
          <h2 className="text-2xl font-semibold text-slate-900 mb-2">Filter Data</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {/* Client first */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Client</label>
              <select 
                value={selectedClient}
                onChange={e => {
                  setSelectedClient(e.target.value);
                  setSelectedProject([]);
                }}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 text-base"
              >
                <option value="">All Clients</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </div>
            {/* Project depends on client */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Project</label>
              <select
                multiple
                value={selectedProject}
                onChange={e => {
                  const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
                  setSelectedProject(selectedOptions);
                }}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 text-base min-h-[120px]"
              >
                <option value="">All Projects</option>
                {filteredProjects.map(project => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
              {selectedProject.length > 0 && (
                <div className="mt-2 text-sm text-slate-600">
                  Selected: {selectedProject.length} project{selectedProject.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>
            {/* User and Task as before */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">User</label>
              <select 
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 text-base"
              >
                <option value="">All Users</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>
            </div>
            {/* Date From/To as before */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Date From</label>
              <input 
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 text-base"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Date To</label>
              <input 
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 text-base"
              />
            </div>
            {/* Group By Dropdowns */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Group By 1</label>
              <select
                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 text-base"
                name="group_by1"
                id="group_by1"
                value={groupBy1}
                onChange={e => setGroupBy1(e.target.value)}
              >
                {groupByOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Group By 2</label>
              <select
                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 text-base"
                name="group_by2"
                id="group_by2"
                value={groupBy2}
                onChange={e => setGroupBy2(e.target.value)}
              >
                {groupByOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Group By 3</label>
              <select
                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 text-base"
                name="group_by3"
                id="group_by3"
                value={groupBy3}
                onChange={e => setGroupBy3(e.target.value)}
              >
                {groupByOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            {/* Billable only checkbox */}
            <div className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                id="billableOnly"
                checked={billableOnly}
                onChange={e => setBillableOnly(e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="billableOnly" className="text-sm font-medium text-slate-700">Billable only</label>
            </div>
            {/* Totals only checkbox */}
            <div className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                id="totalsOnly"
                checked={totalsOnly}
                onChange={e => setTotalsOnly(e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="totalsOnly" className="text-sm font-medium text-slate-700">Totals only</label>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 mt-4">
            <button
              onClick={applyFilters}
              disabled={isLoading}
              className="bg-blue-600 text-white px-8 py-2 rounded-lg font-semibold shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition disabled:opacity-50"
            >
              {isLoading ? 'Loading...' : 'Apply Filters'}
            </button>
            <button
              onClick={clearFilters}
              className="bg-slate-600 text-white px-8 py-2 rounded-lg font-semibold shadow hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 transition"
            >
              Clear Filters
            </button>
            <button
              onClick={generatePDF}
              disabled={timeEntries.length === 0}
              className="bg-green-600 text-white px-8 py-2 rounded-lg font-semibold shadow hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-400 transition disabled:opacity-50"
            >
              Generate PDF
            </button>
          </div>
        </div>

        {/* Data Preview */}
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8 w-full overflow-x-auto">
          <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-2">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Time Entries <span className="text-blue-600 font-semibold">({timeEntries.length})</span></h2>
            {isLoading && (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <span className="text-slate-600 text-base">Loading...</span>
              </div>
            )}
          </div>
          {timeEntries.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-lg font-medium">
              No time entries found
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
              <table className="min-w-full divide-y divide-slate-200 text-base">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-2 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider w-24">Date</th>
                    <th className="px-2 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider w-32">User</th>
                    <th className="px-2 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider w-32">Client</th>
                    <th className="px-2 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider w-40">Project</th>
                    <th className="px-2 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider w-32">Task / Bug Number</th>
                    <th className="px-2 py-3 text-right text-xs font-bold text-slate-600 uppercase tracking-wider w-16">Duration</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider max-w-2xl">Note</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {renderRows(grouped)}
                  <tr className="bg-blue-50 font-bold">
                    <td colSpan={6} className="py-2 px-4 text-right">Total</td>
                    <td className="py-2 px-4 text-right">{totalDuration}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 