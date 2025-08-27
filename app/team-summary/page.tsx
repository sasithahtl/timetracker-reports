/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface TeamMember {
  id: number;
  name: string;
  login: string;
}

interface Client {
  id: number;
  name: string;
}

interface TimeEntry {
  user_id: number;
  client_id: number | null;
  project_id: number | null;
  duration: string;
  billable: number;
  user_name: string;
  user_login: string;
  client_name: string | null;
}

interface TeamSummaryData {
  name: string;
  paidHours: number;
  workedHours: number;
  leaveHours: number;
  publicHolidayHours: number;
  chargedHours: number;
  chargedPercentage: number;
  clientHours: Record<string, number>;
}

export default function TeamSummaryPage() {
  const [teamData, setTeamData] = useState<TeamSummaryData[]>([]);
  const [allUsers, setAllUsers] = useState<TeamMember[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<string>(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    return firstDay.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState<string>(() => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return lastDay.toISOString().split('T')[0];
  });

  useEffect(() => {
    loadTeamSummary();
  }, []);

  // Reload data when selected users change
  useEffect(() => {
    if (allUsers.length > 0 && selectedUsers.length > 0) {
      loadTeamSummary();
    }
  }, [selectedUsers]);

  const loadTeamSummary = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/database?action=teamSummary&date_from=${dateFrom}&date_to=${dateTo}`);
      if (!response.ok) {
        throw new Error('Failed to fetch team summary data');
      }

      const { users, clients, timeEntries, leaveProjectId, holidayProjectId, workingDays } = await response.json();

      // Store all users and initialize selected users (all selected by default)
      setAllUsers(users);
      if (selectedUsers.length === 0) {
        setSelectedUsers(users.map((user: TeamMember) => user.id));
      }

      // Helper function to convert duration string to hours
      const durationToHours = (duration: string): number => {
        if (!duration) return 0;
        const [h, m] = duration.split(':').map(Number);
        return h + (m || 0) / 60;
      };

      // Process data for each user (filter by selected users)
      const filteredUsers = users.filter((user: TeamMember) => selectedUsers.includes(user.id));
      const processedData: TeamSummaryData[] = filteredUsers.map((user: TeamMember) => {
        const userEntries = timeEntries.filter((entry: TimeEntry) => entry.user_id === user.id);
        
        // Calculate metrics
        const paidHours = workingDays * 8; // Working days * 8 hours
        const workedHours = userEntries.reduce((total: number, entry: TimeEntry) => 
          total + durationToHours(entry.duration), 0);
        const leaveHours = userEntries
          .filter((entry: TimeEntry) => entry.project_id === leaveProjectId)
          .reduce((total: number, entry: TimeEntry) => total + durationToHours(entry.duration), 0);
        const publicHolidayHours = userEntries
          .filter((entry: TimeEntry) => entry.project_id === holidayProjectId)
          .reduce((total: number, entry: TimeEntry) => total + durationToHours(entry.duration), 0);
        const chargedHours = userEntries
          .filter((entry: TimeEntry) => entry.billable === 1)
          .reduce((total: number, entry: TimeEntry) => total + durationToHours(entry.duration), 0);
        const chargedPercentage = paidHours > 0 ? (chargedHours / paidHours) * 100 : 0;
        
        // Calculate client hours
        const clientHours: Record<string, number> = {};
        clients.forEach((client: Client) => {
          const clientTotal = userEntries
            .filter((entry: TimeEntry) => entry.client_id === client.id && entry.billable === 1)
            .reduce((total: number, entry: TimeEntry) => total + durationToHours(entry.duration), 0);
          if (clientTotal > 0) {
            clientHours[client.name] = clientTotal;
          }
        });

        return {
          name: user.name,
          paidHours,
          workedHours,
          leaveHours,
          publicHolidayHours,
          chargedHours,
          chargedPercentage,
          clientHours
        };
      });

      setTeamData(processedData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load team summary');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateTotals = () => {
    const totals = teamData.reduce((acc, member) => ({
      paidHours: acc.paidHours + member.paidHours,
      workedHours: acc.workedHours + member.workedHours,
      leaveHours: acc.leaveHours + member.leaveHours,
      publicHolidayHours: acc.publicHolidayHours + member.publicHolidayHours,
      chargedHours: acc.chargedHours + member.chargedHours,
      clientHours: { ...acc.clientHours }
    }), {
      paidHours: 0,
      workedHours: 0,
      leaveHours: 0,
      publicHolidayHours: 0,
      chargedHours: 0,
      clientHours: {} as Record<string, number>
    });
    
    // Aggregate client hours
    teamData.forEach(member => {
      Object.entries(member.clientHours).forEach(([clientName, hours]) => {
        totals.clientHours[clientName] = (totals.clientHours[clientName] || 0) + hours;
      });
    });
    
    return totals;
  };

  const totals = calculateTotals();
  const totalChargedPercentage = totals.paidHours > 0 ? (totals.chargedHours / totals.paidHours) * 100 : 0;

  // User selection functions
  const handleUserToggle = (userId: number) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    setSelectedUsers(allUsers.map(user => user.id));
  };

  const handleDeselectAll = () => {
    setSelectedUsers([]);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-800">{error}</p>
            <button 
              onClick={loadTeamSummary}
              className="mt-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-10 w-full">
      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-8">
        {/* Header */}
        <div className="mb-10 flex flex-col gap-2 sm:gap-0 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-6">
          <div>
            <Link 
              href="/" 
              className="text-blue-600 hover:text-blue-800 text-base font-medium transition-colors"
            >
              ← Back to Home
            </Link>
            <h1 className="text-4xl font-extrabold text-slate-900 mt-2 tracking-tight">Team Summary Report</h1>
            <p className="mt-1 text-lg text-slate-600 font-normal">Overview of team productivity and client billing</p>
          </div>
        </div>

        {/* Filters Section */}
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6 mb-8">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Filters</h2>
          
          {/* Date Range */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-slate-800 mb-3">Filter Period</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <div className="flex items-end">
                <button
                  onClick={loadTeamSummary}
                  disabled={isLoading}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition disabled:opacity-50"
                >
                  {isLoading ? 'Loading...' : 'Update Report'}
                </button>
              </div>
            </div>
          </div>

          {/* User Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium text-slate-800">Select Team Members</h3>
              <div className="flex gap-2">
                <button
                  onClick={handleSelectAll}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  Select all
                </button>
                <span className="text-slate-400">/</span>
                <button
                  onClick={handleDeselectAll}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  Deselect all
                </button>
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {allUsers.map(user => (
                <label key={user.id} className="flex items-center space-x-2 cursor-pointer hover:bg-slate-100 p-2 rounded">
                  <input
                    type="checkbox"
                    checked={selectedUsers.includes(user.id)}
                    onChange={() => handleUserToggle(user.id)}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-slate-700">{user.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Summary Table */}
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-2xl font-bold text-slate-900">Team Performance Summary</h2>
            <p className="text-slate-600 mt-1">Hours breakdown and client distribution</p>
          </div>
          
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-slate-600 mt-2">Loading team summary...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider border-r border-slate-200">Team Member</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-wider border-r border-slate-200">Paid Hours</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-wider border-r border-slate-200">Worked Hours</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-wider border-r border-slate-200">Leave Hours</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-wider border-r border-slate-200">Public Holiday</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-wider border-r border-slate-200">Charged Hours</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-wider border-r border-slate-200">% Charged</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-green-600 uppercase tracking-wider">Client Hours</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {teamData.map((member, index) => (
                    <tr key={index} className="hover:bg-slate-50">
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-slate-900 border-r border-slate-200">{member.name}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-slate-700 border-r border-slate-200">{member.paidHours}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-slate-700 border-r border-slate-200">{member.workedHours.toFixed(1)}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-slate-700 border-r border-slate-200">{member.leaveHours.toFixed(1)}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-slate-700 border-r border-slate-200">{member.publicHolidayHours.toFixed(1)}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-center font-semibold text-green-700 border-r border-slate-200">{member.chargedHours.toFixed(1)}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-center font-semibold text-green-700 border-r border-slate-200">{member.chargedPercentage.toFixed(2)}%</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-green-600">
                        {Object.entries(member.clientHours).map(([client, hours]) => (
                          <div key={client} className="text-xs">
                            {client}: {hours.toFixed(1)}h
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))}
                  {/* Totals Row */}
                  <tr className="bg-blue-50 border-t-2 border-blue-200 font-bold">
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-bold text-slate-900 border-r border-slate-200">TOTAL</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-center font-bold text-slate-900 border-r border-slate-200">{totals.paidHours}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-center font-bold text-slate-900 border-r border-slate-200">{totals.workedHours.toFixed(1)}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-center font-bold text-slate-900 border-r border-slate-200">{totals.leaveHours.toFixed(1)}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-center font-bold text-slate-900 border-r border-slate-200">{totals.publicHolidayHours.toFixed(1)}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-center font-bold text-green-700 border-r border-slate-200">{totals.chargedHours.toFixed(1)}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-center font-bold text-green-700 border-r border-slate-200">{totalChargedPercentage.toFixed(2)}%</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-center font-bold text-green-600">
                      {Object.entries(totals.clientHours).map(([client, hours]) => (
                        <div key={client} className="text-xs">
                          {client}: {hours.toFixed(1)}h
                        </div>
                      ))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex gap-4">
          <button
            className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold shadow hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-400 transition"
          >
            Export to Excel
          </button>
          <button
            className="bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold shadow hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-400 transition"
          >
            Generate PDF Report
          </button>
        </div>
      </div>
    </div>
  );
} 