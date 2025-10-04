import mysql from 'mysql2/promise';
import { dbConfig } from './config/database';

export interface TimeEntry {
  id: number;
  user_id: number;
  group_id: number;
  date: string;
  start: string | null;
  duration: string | null;
  client_id: number | null;
  project_id: number | null;
  task_id: number | null;
  comment: string | null;
  billable: number;
  approved: number;
  paid: number;
  created: string;
  modified: string;
  status: number;
}

export interface User {
  id: number;
  login: string;
  name: string;
  group_id: number;
  role_id: number | null;
  rate: number;
  email: string | null;
  status: number;
}

export interface Project {
  id: number;
  group_id: number;
  name: string;
  description: string | null;
  status: number;
}

export interface Task {
  id: number;
  group_id: number;
  name: string;
  description: string | null;
  status: number;
}

export interface Client {
  id: number;
  group_id: number;
  name: string;
  address: string | null;
  tax: number;
  status: number;
}

export async function getConnection() {
  try {
    console.log('Attempting to connect to database with config:', {
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      database: dbConfig.database
    });
    const connection = await mysql.createConnection(dbConfig);
    console.log('Database connection established successfully');
    return connection;
  } catch (error) {
    console.error('Failed to connect to database:', error);
    throw error;
  }
}

export async function getTimeEntries() {
  const connection = await getConnection();
  try {
    console.log('Executing getTimeEntries with no limit');
    const [rows] = await connection.query(`
      SELECT 
        l.*,
        DATE(l.date) as date,
        u.name as user_name,
        u.login as user_login,
        p.name as project_name,
        t.name as task_name,
        c.name as client_name,
        cf.value as task_number
      FROM tt_log l
      LEFT JOIN tt_users u ON l.user_id = u.id
      LEFT JOIN tt_projects p ON l.project_id = p.id
      LEFT JOIN tt_tasks t ON l.task_id = t.id
      LEFT JOIN tt_clients c ON l.client_id = c.id
      LEFT JOIN tt_custom_field_log cf ON cf.log_id = l.id AND cf.field_id = 2 AND cf.status = 1
      WHERE l.status = 1
      ORDER BY l.date ASC, l.created ASC
    `);
    console.log('Query executed successfully, rows returned:', Array.isArray(rows) ? rows.length : 'not an array');
    return rows;
  } catch (error) {
    console.error('Error in getTimeEntries:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

export async function getUsers() {
  const connection = await getConnection();
  try {
    console.log('Executing getUsers query');
    const [rows] = await connection.query(`
      SELECT * FROM tt_users 
      WHERE status = 1 AND group_id = 1
      ORDER BY name
    `);
    console.log('getUsers query executed successfully');
    return rows;
  } catch (error) {
    console.error('Error in getUsers:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

export async function getProjects() {
  const connection = await getConnection();
  try {
    console.log('Executing getProjects query');
    const [rows] = await connection.query(`
      SELECT * FROM tt_projects 
      WHERE status = 1 
      ORDER BY name
    `);
    console.log('getProjects query executed successfully');
    return rows;
  } catch (error) {
    console.error('Error in getProjects:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

export async function getTasks() {
  const connection = await getConnection();
  try {
    console.log('Executing getTasks query');
    const [rows] = await connection.query(`
      SELECT * FROM tt_tasks 
      WHERE status = 1 
      ORDER BY name
    `);
    console.log('getTasks query executed successfully');
    return rows;
  } catch (error) {
    console.error('Error in getTasks:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

export async function getClients() {
  const connection = await getConnection();
  try {
    console.log('Executing getClients query');
    const [rows] = await connection.query(`
      SELECT * FROM tt_clients 
      WHERE status = 1 
      ORDER BY name
    `);
    console.log('getClients query executed successfully');
    return rows;
  } catch (error) {
    console.error('Error in getClients:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

export async function getProjectsByClient(clientId: number) {
  const connection = await getConnection();
  try {
    const [rows] = await connection.query(`
      SELECT p.* FROM tt_projects p
      INNER JOIN tt_client_project_binds b ON p.id = b.project_id
      WHERE b.client_id = ? AND p.status = 1
      ORDER BY p.name
    `, [clientId]);
    return rows;
  } catch (error) {
    console.error('Error in getProjectsByClient:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

export async function testConnection() {
  const connection = await getConnection();
  try {
    console.log('Testing database connection...');
    const [rows] = await connection.query('SELECT 1 as test');
    console.log('Connection test successful:', rows);
    return true;
  } catch (error) {
    console.error('Connection test failed:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

export async function getDateRange() {
  const connection = await getConnection();
  try {
    console.log('Getting date range from database...');
    const [rows] = await connection.query(`
      SELECT 
        DATE(MIN(date)) as min_date,
        DATE(MAX(date)) as max_date
      FROM tt_log 
      WHERE status = 1
    `);
    console.log('Date range query executed successfully:', rows);
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('Error in getDateRange:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

export async function getTeamSummaryData(dateFrom: string, dateTo: string) {
  const connection = await getConnection();
  try {
    console.log('Getting team summary data for period:', dateFrom, 'to', dateTo);
    
    // Get all users
    const [users] = await connection.query(`
      SELECT id, login, name FROM tt_users 
      WHERE status = 1 AND group_id = 1
      ORDER BY name
    `);
    
    // Get leave project ID
    const [leaveProjects] = await connection.query(`
      SELECT id FROM tt_projects 
      WHERE name LIKE '%Leave%' OR name LIKE '%Out of Office%' 
      LIMIT 1
    `);
    const leaveProjectId = Array.isArray(leaveProjects) && leaveProjects.length > 0 ? (leaveProjects[0] as {id: number}).id : null;
    
    // Get public holiday project ID
    const [holidayProjects] = await connection.query(`
      SELECT id FROM tt_projects 
      WHERE name LIKE '%Public Holiday%' OR name LIKE '%Holiday%' 
      LIMIT 1
    `);
    const holidayProjectId = Array.isArray(holidayProjects) && holidayProjects.length > 0 ? (holidayProjects[0] as {id: number}).id : null;
    
    // Get all clients
    const [clients] = await connection.query(`
      SELECT id, name FROM tt_clients 
      WHERE status = 1 
      ORDER BY name
    `);
    
    // Get time entries for the period
    const [timeEntries] = await connection.query(`
      SELECT 
        l.user_id,
        l.client_id,
        l.project_id,
        l.duration,
        l.billable,
        u.name as user_name,
        u.login as user_login,
        c.name as client_name
      FROM tt_log l
      LEFT JOIN tt_users u ON l.user_id = u.id
      LEFT JOIN tt_clients c ON l.client_id = c.id
      WHERE l.status = 1 
        AND l.date >= ? 
        AND l.date <= ?
      ORDER BY u.name, l.date
    `, [dateFrom, dateTo]);
    
    // Calculate working days in the period
    const startDate = new Date(dateFrom);
    const endDate = new Date(dateTo);
    let workingDays = 0;
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      // Skip weekends (0 = Sunday, 6 = Saturday)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workingDays++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return {
      users: Array.isArray(users) ? users : [],
      clients: Array.isArray(clients) ? clients : [],
      timeEntries: Array.isArray(timeEntries) ? timeEntries : [],
      leaveProjectId,
      holidayProjectId,
      workingDays
    };
  } catch (error) {
    console.error('Error in getTeamSummaryData:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

export async function getFilteredTimeEntries(filters: {
  user_id?: number;
  project_id?: number | number[];
  task_id?: number;
  client_id?: number;
  billable?: number;
  date_from?: string;
  date_to?: string;
}) {
  const connection = await getConnection();
  try {
    console.log('Executing getFilteredTimeEntries with filters:', filters);
    let whereClause = 'WHERE l.status = 1';
    if (filters.user_id) {
      whereClause += ` AND l.user_id = ${Number(filters.user_id)}`;
    }
    if (filters.project_id) {
      if (Array.isArray(filters.project_id)) {
        whereClause += ` AND l.project_id IN (${filters.project_id.map(Number).join(',')})`;
      } else {
        whereClause += ` AND l.project_id = ${Number(filters.project_id)}`;
      }
    }
    if (filters.task_id) {
      whereClause += ` AND l.task_id = ${Number(filters.task_id)}`;
    }
    if (filters.client_id) {
      whereClause += ` AND l.client_id = ${Number(filters.client_id)}`;
    }
    if (filters.billable === 1) {
      whereClause += ' AND l.billable = 1';
    }
    if (filters.date_from) {
      whereClause += ` AND l.date >= '${filters.date_from}'`;
    }
    if (filters.date_to) {
      whereClause += ` AND l.date <= '${filters.date_to}'`;
    }
    console.log('Building SQL query with direct string interpolation');
    const [rows] = await connection.query(`
      SELECT 
        l.*,
        DATE(l.date) as date,
        u.name as user_name,
        u.login as user_login,
        p.name as project_name,
        t.name as task_name,
        c.name as client_name,
        cf.value as task_number
      FROM tt_log l
      LEFT JOIN tt_users u ON l.user_id = u.id
      LEFT JOIN tt_projects p ON l.project_id = p.id
      LEFT JOIN tt_tasks t ON l.task_id = t.id
      LEFT JOIN tt_clients c ON l.client_id = c.id
      LEFT JOIN tt_custom_field_log cf ON cf.log_id = l.id AND cf.field_id = 2 AND cf.status = 1
      ${whereClause}
      ORDER BY l.date ASC, l.created ASC
    `);
    console.log('getFilteredTimeEntries query executed successfully');
    return rows;
  } catch (error) {
    console.error('Error in getFilteredTimeEntries:', error);
    throw error;
  } finally {
    await connection.end();
  }
} 