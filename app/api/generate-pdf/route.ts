import { NextRequest, NextResponse } from 'next/server';
// Remove puppeteer import - no longer needed

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

interface HierarchicalGroup {
  key: string;
  level: number;
  entries: TimeEntry[];
  subGroups: Map<string, HierarchicalGroup>;
}

export async function POST(request: NextRequest) {
  try {
    const { data, grouping = 'date', totalsOnly = false }: { data: ParsedData; grouping: string; totalsOnly?: boolean } = await request.json();

    if (!data || !data.entries || !Array.isArray(data.entries)) {
      return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
    }

    // Parse grouping levels from comma-separated string
    const groupingLevels = grouping.split(',').map(level => level.trim() as GroupingOption).filter(level => level !== 'none');
    
    // Before grouping, sort data.entries by date ascending
    const sortedEntries = [...data.entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Create hierarchical grouping structure
    const hierarchicalData = buildHierarchicalGrouping(sortedEntries, groupingLevels);

    const htmlContent = generateTimesheetHTML(data, hierarchicalData, totalsOnly);

    // Return HTML content for client-side PDF generation
    return NextResponse.json({ 
      html: htmlContent,
      filename: `timesheet-report-${new Date().toISOString().split('T')[0]}.pdf`
    });

  } catch (error) {
    console.error('Error generating HTML:', error);
    return NextResponse.json({ error: 'Failed to generate HTML' }, { status: 500 });
  }
}

function buildHierarchicalGrouping(entries: TimeEntry[], groupingLevels: GroupingOption[]): Map<string, HierarchicalGroup> {
  const rootGroups = new Map<string, HierarchicalGroup>();
  
  if (groupingLevels.length === 0) {
    // No grouping, create a single group with all entries
    rootGroups.set('All Entries', {
      key: 'All Entries',
      level: 0,
      entries: entries,
      subGroups: new Map()
    });
    return rootGroups;
  }
  
  entries.forEach(entry => {
    let currentGroups = rootGroups;
    let currentLevel = 0;
    
    groupingLevels.forEach((level, index) => {
      const groupValue = getGroupValue(entry, level);
      
      if (!currentGroups.has(groupValue)) {
        currentGroups.set(groupValue, {
          key: groupValue,
          level: currentLevel,
          entries: [],
          subGroups: new Map()
        });
      }
      
      const group = currentGroups.get(groupValue)!;
      
      // If this is the last grouping level, add the entry to this group
      if (index === groupingLevels.length - 1) {
        group.entries.push(entry);
      }
      
      // Move to next level
      currentGroups = group.subGroups;
      currentLevel++;
    });
  });
  
  return rootGroups;
}

function getGroupValue(entry: TimeEntry, groupBy: GroupingOption): string {
  switch (groupBy) {
    case 'date': return entry.date;
    case 'user': return entry.user;
    case 'client': return entry.client;
    case 'project': return entry.project;
    case 'task': return entry.task || 'No Task';
    default: return '';
  }
}

// Utility to sum durations in HH:MM or HH:MM:SS format
function sumDurations(entries: TimeEntry[]): string {
  let totalMinutes = 0;
  for (const entry of entries) {
    if (!entry.duration) continue;
    const [h, m] = entry.duration.split(':');
    totalMinutes += parseInt(h || '0', 10) * 60 + parseInt(m || '0', 10);
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

// Add formatDuration helper
function formatDuration(duration: string): string {
  if (!duration) return '00:00';
  const [h, m] = duration.split(':');
  return `${h.padStart(2, '0')}:${(m || '00').padStart(2, '0')}`;
}

function renderHierarchicalGroups(groups: Map<string, HierarchicalGroup>, totalsOnly: boolean, level: number = 0): string {
  return Array.from(groups.entries()).map(([groupKey, group]) => {
    const allEntriesInGroup = getAllEntriesFromGroup(group);
    const groupDuration = sumDurations(allEntriesInGroup);
    const indentClass = level > 0 ? `style="margin-left: ${level * 20}px;"` : '';
    
    let html = `
      <div class="group-header" ${indentClass}>
        <span>${groupKey || 'All Entries'}</span>
        <span class="group-stats">${allEntriesInGroup.length} entries • ${groupDuration} hours</span>
      </div>
    `;
    
    // If there are subgroups, render them recursively
    if (group.subGroups.size > 0) {
      html += renderHierarchicalGroups(group.subGroups, totalsOnly, level + 1);
    } else if (group.entries.length > 0 && !totalsOnly) {
      // This is a leaf group with actual entries, render the table
      html += `
        <table class="entries-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>User</th>
              <th>Client</th>
              <th>Project</th>
              <th>Task</th>
              <th>Duration</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            ${group.entries.map(entry => `
              <tr>
                <td>${entry.date}</td>
                <td>${entry.user}</td>
                <td>${entry.client}</td>
                <td>${entry.project}</td>
                <td>${entry.task || '-'}</td>
                <td class="duration-cell">${formatDuration(entry.duration)}</td>
                <td class="note-cell" title="${entry.note || ''}">${entry.note || '-'}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="5" style="text-align:right;">Subtotal</td>
              <td class="duration-cell">${sumDurations(group.entries)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      `;
    }
    
    return html;
  }).join('');
}

function getAllEntriesFromGroup(group: HierarchicalGroup): TimeEntry[] {
  let allEntries = [...group.entries];
  
  // Recursively get entries from subgroups
  for (const subGroup of group.subGroups.values()) {
    allEntries = allEntries.concat(getAllEntriesFromGroup(subGroup));
  }
  
  return allEntries;
}

function generateTimesheetHTML(data: ParsedData, hierarchicalData: Map<string, HierarchicalGroup>, totalsOnly: boolean = false): string {
  const totalDuration = sumDurations(data.entries);
  const totalEntries = data.entries.length;
  const uniqueUsers = [...new Set(data.entries.map(entry => entry.user))];
  const uniqueProjects = [...new Set(data.entries.map(entry => entry.project))];

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          margin: 0;
          padding: 0;
          background-color: #f8fafc;
          color: #1e293b;
          line-height: 1.6;
        }
        .container {
          max-width: 1000px;
          margin: 0 auto;
          background: white;
          padding: 40px 12px 32px 12px;
          border-radius: 16px;
          box-shadow: 0 6px 24px 0 rgba(30,64,175,0.08);
        }
        .header {
          text-align: left;
          margin-bottom: 32px;
          padding-bottom: 18px;
          border-bottom: 3px solid #3b82f6;
        }
        .client-name {
          font-size: 2rem;
          font-weight: 800;
          color: #1e40af;
          margin-bottom: 0.5rem;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .report-title {
          font-size: 1.25rem;
          color: #334155;
          margin-bottom: 0.5rem;
          font-weight: 600;
        }
        .summary-section {
          display: flex;
          gap: 32px;
          margin-bottom: 32px;
        }
        .summary-card {
          background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);
          color: white;
          padding: 18px 28px;
          border-radius: 12px;
          text-align: center;
          min-width: 120px;
          flex: 1;
        }
        .summary-card h3 {
          margin: 0 0 8px 0;
          font-size: 0.95rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          opacity: 0.9;
          font-weight: 600;
        }
        .summary-card .value {
          font-size: 1.5rem;
          font-weight: 800;
          margin: 0;
        }
        .details-section {
          display: flex;
          gap: 32px;
          margin-bottom: 32px;
        }
        .detail-card {
          background: #f1f5f9;
          padding: 18px 24px;
          border-radius: 10px;
          border-left: 4px solid #3b82f6;
          flex: 1;
        }
        .detail-card h3 {
          margin: 0 0 12px 0;
          color: #1e40af;
          font-size: 1rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 700;
        }
        .detail-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .detail-list li {
          padding: 4px 0;
          border-bottom: 1px solid #e2e8f0;
          color: #475569;
          font-size: 0.98rem;
        }
        .detail-list li:last-child {
          border-bottom: none;
        }
        .entries-section {
          margin-top: 32px;
        }
        .group-header {
          background: linear-gradient(90deg, #1e40af 0%, #3b82f6 100%);
          color: white;
          padding: 12px 20px;
          margin: 24px 0 0 0;
          border-radius: 10px 10px 0 0;
          font-weight: bold;
          font-size: 1.1rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .group-stats {
          font-size: 0.98rem;
          opacity: 0.9;
        }
        .entries-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 24px;
          background: white;
          border-radius: 0 0 10px 10px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(30,64,175,0.04);
        }
        .entries-table th {
          background: #f1f5f9;
          padding: 10px 6px;
          text-align: left;
          font-weight: 700;
          color: #334155;
          font-size: 0.95rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 2px solid #e2e8f0;
        }
        .entries-table td {
          padding: 8px 6px;
          border-bottom: 1px solid #f1f5f9;
          font-size: 0.98rem;
          color: #475569;
        }
        .entries-table tr:hover {
          background-color: #f8fafc;
        }
        .duration-cell {
          font-weight: 700;
          color: #059669;
          text-align: right;
        }
        .note-cell {
          max-width: 400px;
          word-wrap: break-word;
          white-space: pre-line;
          line-height: 1.4;
        }
        .total-row {
          background: #e0e7ff;
          font-weight: 800;
          color: #1e40af;
        }
        .main-title {
          font-size: 2rem;
          font-weight: 800;
          color: #1e40af;
          margin-bottom: 0.5rem;
          letter-spacing: 1px;
        }
        .client-subheading {
          font-size: 1.25rem;
          color: #334155;
          margin-bottom: 0.5rem;
          font-weight: 600;
          text-transform: uppercase;
        }
        .totals-only .group-header {
          margin-bottom: 16px;
          border-radius: 10px;
        }
        .group-header[style*="margin-left"] {
          background: linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%);
          font-size: 1rem;
          margin-top: 12px;
        }
        .group-header[style*="margin-left: 40px"] {
          background: linear-gradient(90deg, #8b5cf6 0%, #a855f7 100%);
          font-size: 0.95rem;
          margin-top: 8px;
        }
      </style>
    </head>
    <body>
      <div class="container${totalsOnly ? ' totals-only' : ''}">
        <div class="header">
          <div class="main-title">Timesheet Report${totalsOnly ? ' - Summary View' : ''}</div>
          <div class="client-subheading">${data.client || 'No Client'}</div>
          ${totalsOnly ? '<div style="color: #6366f1; font-size: 0.9rem; margin-top: 8px;">This report shows group totals only. Individual entries are hidden.</div>' : ''}
        </div>

        <div class="summary-section">
          <div class="summary-card">
            <h3>Total Hours</h3>
            <p class="value">${totalDuration}</p>
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

        <div class="entries-section">
          ${renderHierarchicalGroups(hierarchicalData, totalsOnly)}
        </div>
      </div>
    </body>
    </html>
  `;
} 