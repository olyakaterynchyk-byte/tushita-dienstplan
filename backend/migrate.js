require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

async function runMigration() {
  const connectionString = 'postgres://postgres:LiebeMark0107!@db.ympgphuvjwvrhggegrzc.supabase.co:5432/postgres';
  
  console.log('Connecting to database...');
  const client = new Client({ connectionString });
  await client.connect();

  console.log('Reading schema...');
  const sqlPath = path.join(__dirname, '../supabase/migrations/001_initial_schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Executing schema...');
  try {
    await client.query(sql);
    console.log('Schema executed successfully!');
  } catch (err) {
    console.error('Error executing schema:', err.message);
  } finally {
    await client.end();
  }

  console.log('Setting up admin user...');
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data, error } = await supabase.auth.admin.createUser({
    email: 'office@tushita.eu',
    password: 'LiebeMark0107!',
    email_confirm: true,
    user_metadata: {
      firstname: 'Admin',
      lastname: '',
      role: 'admin',
      area: 'both'
    }
  });

  if (error) {
    if (error.message.includes('already registered')) {
      console.log('Admin user already exists.');
    } else {
      console.error('Error creating admin user:', error.message);
    }
  } else {
    console.log('Admin user created successfully!');
  }
}

runMigration().catch(console.error);
