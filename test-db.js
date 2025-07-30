import mysql from 'mysql2/promise';

const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'password',
  database: 'sbosdevlk_timetracker',
  charset: 'utf8mb4'
};

async function testDatabase() {
  let connection;
  try {
    console.log('Testing database connection...');
    console.log('Config:', { host: dbConfig.host, port: dbConfig.port, user: dbConfig.user, database: dbConfig.database });
    
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Database connection successful');
    
    // Test simple query
    const [testRows] = await connection.query('SELECT 1 as test');
    console.log('✅ Simple query test:', testRows);
    
    // Test if tables exist
    const [tables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = '${dbConfig.database}' 
      AND TABLE_NAME LIKE 'tt_%'
    `);
    console.log('✅ Available tables:', tables.map(t => t.TABLE_NAME));
    
    // Test tt_log table
    const [logCount] = await connection.query('SELECT COUNT(*) as count FROM tt_log WHERE status = 1');
    console.log('✅ tt_log table count:', logCount[0].count);
    
    // Test the actual query that's failing
    const [timeEntries] = await connection.query(`
      SELECT 
        l.*,
        u.name as user_name,
        u.login as user_login,
        p.name as project_name,
        t.name as task_name,
        c.name as client_name
      FROM tt_log l
      LEFT JOIN tt_users u ON l.user_id = u.id
      LEFT JOIN tt_projects p ON l.project_id = p.id
      LEFT JOIN tt_tasks t ON l.task_id = t.id
      LEFT JOIN tt_clients c ON l.client_id = c.id
      WHERE l.status = 1
      ORDER BY l.date DESC, l.created DESC
      LIMIT 10 OFFSET 0
    `);
    console.log('✅ Time entries query successful, returned', timeEntries.length, 'rows');
    
  } catch (error) {
    console.error('❌ Database test failed:', error);
    console.error('Error details:', {
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed');
    }
  }
}

testDatabase(); 