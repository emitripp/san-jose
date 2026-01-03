// Script to create initial admin user
// Run this once after setting up Supabase tables

const bcrypt = require('bcryptjs');

async function createAdminHash() {
    const password = 'admin123'; // Default password - CHANGE THIS!
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    console.log('\n========================================');
    console.log('ADMIN SETUP');
    console.log('========================================\n');
    console.log('Default Admin Credentials:');
    console.log('  Email: admin@legadosanjose.com');
    console.log('  Password: admin123');
    console.log('\n⚠️  IMPORTANT: Change this password after first login!\n');
    console.log('Password Hash (for Supabase):');
    console.log(hash);
    console.log('\n========================================');
    console.log('\nSQL to insert admin:');
    console.log(`
INSERT INTO admins (email, password_hash, name)
VALUES (
    'admin@legadosanjose.com',
    '${hash}',
    'Administrador'
) ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;
    `);
    console.log('========================================\n');
}

createAdminHash();
