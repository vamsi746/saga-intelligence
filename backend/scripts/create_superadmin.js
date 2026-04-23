// Script to create a new super admin user
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../src/models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/saga-intelligence';

async function createSuperAdmin(email, password, fullName) {
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

  const existing = await User.findOne({ email });
  if (existing) {
    console.error('User with this email already exists.');
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = new User({
    email,
    password: hashedPassword,
    full_name: fullName,
    role: 'superadmin',
    is_active: true
  });

  await user.save();
  console.log('Super admin created:', user.email);
  await mongoose.disconnect();
}

// Usage: node create_superadmin.js email password "Full Name"
if (require.main === module) {
  const [,, email, password, ...nameParts] = process.argv;
  const fullName = nameParts.join(' ');
  if (!email || !password || !fullName) {
    console.error('Usage: node create_superadmin.js <email> <password> "Full Name"');
    process.exit(1);
  }
  createSuperAdmin(email, password, fullName);
}
