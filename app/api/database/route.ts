import { NextRequest, NextResponse } from 'next/server';
import { 
  getTimeEntries, 
  getUsers, 
  getProjects, 
  getTasks, 
  getClients,
  getFilteredTimeEntries,
  testConnection,
  getProjectsByClient,
  getDateRange,
  getTeamSummaryData
} from '../../../lib/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    let data;
    switch (action) {
      case 'test':
        data = await testConnection();
        break;
      case 'timeEntries':
        data = await getTimeEntries(); // no limit
        break;
      case 'users':
        data = await getUsers();
        break;
      case 'projects':
        data = await getProjects();
        break;
      case 'tasks':
        data = await getTasks();
        break;
      case 'clients':
        data = await getClients();
        break;
      case 'filteredEntries':
        // Support multiple project_id
        const projectIds = searchParams.getAll('project_id').map(Number).filter(Boolean);
        const filters = {
          user_id: searchParams.get('user_id') ? parseInt(searchParams.get('user_id')!) : undefined,
          project_id: projectIds.length > 0 ? projectIds : (searchParams.get('project_id') ? parseInt(searchParams.get('project_id')!) : undefined),
          task_id: searchParams.get('task_id') ? parseInt(searchParams.get('task_id')!) : undefined,
          client_id: searchParams.get('client_id') ? parseInt(searchParams.get('client_id')!) : undefined,
          billable: searchParams.get('billable') ? parseInt(searchParams.get('billable')!) : undefined,
          date_from: searchParams.get('date_from') || undefined,
          date_to: searchParams.get('date_to') || undefined,
          // no limit, no offset
        };
        data = await getFilteredTimeEntries(filters);
        break;
      case 'projectsByClient':
        const clientId = searchParams.get('client_id');
        if (!clientId) {
          return NextResponse.json({ error: 'Missing client_id' }, { status: 400 });
        }
        data = await getProjectsByClient(Number(clientId));
        break;
      case 'dateRange':
        data = await getDateRange();
        break;
      case 'teamSummary':
        const dateFrom = searchParams.get('date_from') || '2025-07-01';
        const dateTo = searchParams.get('date_to') || '2025-07-31';
        data = await getTeamSummaryData(dateFrom, dateTo);
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Database connection failed' },
      { status: 500 }
    );
  }
} 