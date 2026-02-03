// Use postgres.js for local development, @vercel/postgres for production
import postgres from 'postgres';

// Create connection
const connectionString = process.env.POSTGRES_URL || 'postgresql://postgres:postgres@localhost:5433/classroom_dev';

// Initialize postgres client
const sql = postgres(connectionString, {
  // Disable SSL for local development
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
});

// Export the sql instance for use in API routes
export { sql };

// Note: Schema initialization is handled via scripts/init-postgres.sql
// Run it manually with: docker exec -i classroom-postgres psql -U postgres -d classroom_dev < scripts/init-postgres.sql

export default sql;
