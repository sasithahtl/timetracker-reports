export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  charset: string;
  timezone: string;
  dateStrings: boolean;
}

const getDatabaseConfig = (): DatabaseConfig => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    return {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'sbosdevlk_timetracker',
      password: process.env.DB_PASSWORD || 'Xi4Kkc.Ya;[VGqWA',
      database: process.env.DB_NAME || 'sbosdevlk_timetracker',
      charset: 'utf8mb4',
      timezone: '+00:00',
      dateStrings: true
    };
  }
  
  // Development configuration
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'sbosdevlk_timetracker',
    charset: 'utf8mb4',
    timezone: '+00:00',
    dateStrings: true
  };
};

export const dbConfig = getDatabaseConfig(); 