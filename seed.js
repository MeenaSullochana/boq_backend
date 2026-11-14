import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from './models/User.js';

dotenv.config();

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected');

  const adminEmail = 'admin@orangeinterior.in';
  let admin = await User.findOne({ email: adminEmail });
  if (!admin) {
    admin = await User.create({
      name: 'Super Admin',
      email: adminEmail,
      password: 'Admin@123',
      role: 'superadmin',
      phone: '9790888861',
    });
    console.log('Created superadmin:', adminEmail, '/ Admin@123');
  } else {
    console.log('Superadmin already exists');
  }

  let staff = await User.findOne({ email: 'staff@orangeinterior.in' });
  if (!staff) {
    staff = await User.create({
      name: 'Staff User',
      email: 'staff@orangeinterior.in',
      password: 'Staff@123',
      role: 'staff',
    });
    console.log('Created staff: staff@orangeinterior.in / Staff@123');
  } else {
    console.log('Staff already exists');
  }

  console.log('Seed complete (login users only)');
  await mongoose.disconnect();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
