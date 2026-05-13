import bcrypt from 'bcryptjs';
import { db } from './client';

async function seed() {
  const adminHash = await bcrypt.hash('admin123', 10);
  const sellerHash = await bcrypt.hash('seller123', 10);

  await db.query(`
    INSERT INTO users (email, password_hash, name, role)
    VALUES
      ('admin@kvy.io', $1, 'Admin User', 'admin'),
      ('seller@example.com', $2, 'Seller One', 'seller'),
      ('seller2@example.com', $2, 'Seller Two', 'seller')
    ON CONFLICT (email) DO NOTHING
  `, [adminHash, sellerHash]);

  console.log('Seed complete');
  console.log('  admin@kvy.io / admin123');
  console.log('  seller@example.com / seller123');
  console.log('  seller2@example.com / seller123');

  await db.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
