# Database Configuration

This directory contains environment-specific database configurations for the PDF Generator App.

## Configuration Files

- `database.ts` - Main database configuration with environment detection
- `README.md` - This documentation file

## Environment Variables

The application uses the following environment variables for database configuration:

| Variable | Description | Default (Dev) | Default (Prod) |
|----------|-------------|---------------|----------------|
| `DB_HOST` | Database host | `localhost` | `localhost` |
| `DB_PORT` | Database port | `3306` | `3306` |
| `DB_USER` | Database username | `root` | `sbosdevlk_timetracker` |
| `DB_PASSWORD` | Database password | `password` | `Xi4Kkc.Ya;[VGqWA` |
| `DB_NAME` | Database name | `sbosdevlk_timetracker` | `sbosdevlk_timetracker` |

## Setup Instructions

1. Copy `env.example` to `.env.local` in the project root
2. Update the values in `.env.local` for your local development environment
3. For production, set the environment variables in your deployment platform

## Environment Detection

The configuration automatically detects the environment:
- **Development**: Uses development defaults when `NODE_ENV` is not 'production'
- **Production**: Uses production defaults when `NODE_ENV` is 'production'

## Usage

```typescript
import { dbConfig } from './lib/config/database';

// The configuration is automatically loaded based on environment
console.log(dbConfig.host); // Will show appropriate host for current environment
``` 