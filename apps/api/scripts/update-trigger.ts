import { Pool } from 'pg';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query(`
      CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
      RETURNS TRIGGER AS $$
      BEGIN
          IF TG_OP = 'DELETE' AND current_setting('app.allow_organization_deletion', TRUE) = 'true' THEN
              RETURN OLD;
          END IF;
          RAISE EXCEPTION 'AuditLog records are immutable and cannot be updated or deleted.';
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('Successfully updated prevent_audit_log_mutation function');
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
