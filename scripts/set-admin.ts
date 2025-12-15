import 'dotenv/config';
import { db, profiles } from '../src/db';
import { eq } from 'drizzle-orm';

async function setAdmin() {
  try {
    const [user] = await db
      .update(profiles)
      .set({ isAdmin: true })
      .where(eq(profiles.email, 'tdaniel@botmakers.ai'))
      .returning();

    if (user) {
      console.log('Admin set for:', user.email, '- isAdmin:', user.isAdmin);
    } else {
      console.log('User not found with email: daniel@botmakers.ai');
    }
  } catch (error) {
    console.error('Error:', error);
  }
  process.exit(0);
}

setAdmin();
