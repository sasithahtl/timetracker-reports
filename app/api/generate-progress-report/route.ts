import { NextRequest, NextResponse } from 'next/server';

interface TimeEntry {
  taskNumber?: string;
  description: string;
  hours: number;
  dates: string[];
}

interface ProjectData {
  tasks: TimeEntry[];
  totalHours: number;
}

interface UserData {
  projects: { [project: string]: ProjectData };
  leave?: Array<{ date: string; reason: string }>;
  publicHolidays?: Array<{ date: string; reason: string }>;
  totalHours: number;
}

interface GroupedProgress {
  [user: string]: UserData;
}

interface RequestBody {
  groupedProgress: GroupedProgress;
  reportText: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    const { groupedProgress, reportText } = body;

    // Generate the report text
    let report = `Team Progress Report\n`;
    report += `Generated on: ${new Date().toLocaleDateString()}\n\n`;
    report += reportText;

    Object.entries(groupedProgress).forEach(([user, userData]) => {
      report += `${user}\n`;

      // Add projects
      Object.entries(userData.projects).forEach(([project, projectData]) => {
        if (projectData.tasks && projectData.tasks.length > 0) {
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

    // Create response with text content
    const response = new NextResponse(report, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Content-Disposition': `attachment; filename="team-progress-report.txt"`,
      },
    });

    return response;
  } catch (error) {
    console.error('Error generating progress report:', error);
    return NextResponse.json(
      { error: 'Failed to generate progress report' },
      { status: 500 }
    );
  }
} 