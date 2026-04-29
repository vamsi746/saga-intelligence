# Here are your Instructions
cd /Users/bluecloudsoftech/Desktop/AI_ML/Saga_TG/saga-intelligence/backend
node -e "
const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const r = await mongoose.connection.collection('grievances').deleteMany({ platform: 'rss' });
  console.log('Deleted:', r.deletedCount);
  process.exit(0);
});
"
