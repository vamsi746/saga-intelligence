const mongoose = require("mongoose");
require("dotenv").config();

async function check() {
  const dbUri = process.env.MONGODB_URI;
  const dbName = process.env.DB_NAME || "apsagaclone";
  await mongoose.connect(dbUri, { dbName });
  console.log("Connected to DB:", dbName);
  
  const db = mongoose.connection.db;
  const col = db.collection("grievances");

  const total = await col.countDocuments({ is_active: true });
  console.log("Total active grievances:", total);

  const withLoc = await col.countDocuments({
    is_active: true,
    "detected_location.city": { $exists: true, $nin: [null, ""] }
  });
  console.log("With detected_location.city:", withLoc);

  const byCityRaw = await col.aggregate([
    { $match: { is_active: true, "detected_location.city": { $exists: true, $nin: [null, ""] } } },
    { $group: { _id: { $toLower: "$detected_location.city" }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 20 }
  ]).toArray();
  console.log("\nTop cities:");
  byCityRaw.forEach(r => console.log("  ", r._id, ":", r.count));

  const byDist = await col.aggregate([
    { $match: { is_active: true, "detected_location.district": { $exists: true, $nin: [null, ""] } } },
    { $group: { _id: { $toLower: "$detected_location.district" }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 20 }
  ]).toArray();
  console.log("\nTop districts:");
  byDist.forEach(r => console.log("  ", r._id, ":", r.count));

  const byConst = await col.aggregate([
    { $match: { is_active: true, "detected_location.constituency": { $exists: true, $nin: [null, ""] } } },
    { $group: { _id: { $toLower: "$detected_location.constituency" }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 20 }
  ]).toArray();
  console.log("\nTop constituencies:");
  byConst.forEach(r => console.log("  ", r._id, ":", r.count));

  const bySource = await col.aggregate([
    { $match: { is_active: true, "detected_location.source": { $exists: true, $nin: [null, ""] } } },
    { $group: { _id: "$detected_location.source", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 15 }
  ]).toArray();
  console.log("\nTop location sources:");
  bySource.forEach(r => console.log("  ", r._id, ":", r.count));

  // Grievances with Hyderabad but no mahabubnagar mapping
  const hydCount = await col.countDocuments({
    is_active: true,
    "detected_location.city": /hyderabad/i
  });
  console.log("\nHyderabad city count:", hydCount);

  const telanganaCount = await col.countDocuments({
    is_active: true,
    "detected_location.city": /telangana/i
  });
  console.log("Telangana city count:", telanganaCount);

  // Sample some Hyderabad ones
  const hydSamples = await col.find({
    is_active: true,
    "detected_location.city": /hyderabad/i
  }).limit(5).project({
    id: 1,
    detected_location: 1,
    "analysis.sentiment": 1
  }).toArray();
  console.log("\nHyderabad samples:");
  hydSamples.forEach(r => console.log(JSON.stringify(r.detected_location)));

  // No location at all
  const noLoc = await col.countDocuments({
    is_active: true,
    $or: [
      { "detected_location.city": { $exists: false } },
      { "detected_location.city": null },
      { "detected_location.city": "" }
    ]
  });
  console.log("\nNo detected_location.city:", noLoc);

  // Round-robin
  const rrCount = await col.countDocuments({
    is_active: true,
    "detected_location.source": /round_robin/i
  });
  console.log("Round-robin assigned:", rrCount);

  // Check what the map endpoint would return for 'hyderabad'
  const hydMapAgg = await col.aggregate([
    { $match: { is_active: true, post_date: { $gte: new Date(Date.now() - 30*24*60*60*1000) } } },
    { $addFields: {
      _match: { $or: [
        { $regexMatch: { input: { $ifNull: ["$detected_location.city", ""] }, regex: "(^|[^a-z0-9])hyderabad([^a-z0-9]|$)", options: "i" } },
        { $regexMatch: { input: { $ifNull: ["$detected_location.district", ""] }, regex: "(^|[^a-z0-9])hyderabad([^a-z0-9]|$)", options: "i" } },
        { $regexMatch: { input: { $ifNull: ["$detected_location.constituency", ""] }, regex: "(^|[^a-z0-9])hyderabad([^a-z0-9]|$)", options: "i" } }
      ]},
      _hasLoc: { $or: [
        { $gt: [{ $strLenCP: { $trim: { input: { $ifNull: ["$detected_location.city", ""] } } } }, 0] },
        { $gt: [{ $strLenCP: { $trim: { input: { $ifNull: ["$detected_location.district", ""] } } } }, 0] }
      ]}
    }},
    { $match: { $expr: { $and: ["$_hasLoc", "$_match"] } } },
    { $group: {
      _id: null,
      count: { $sum: 1 },
      positive: { $sum: { $cond: [{ $eq: ["$analysis.sentiment", "positive"] }, 1, 0] } },
      negative: { $sum: { $cond: [{ $eq: ["$analysis.sentiment", "negative"] }, 1, 0] } },
      neutral: { $sum: { $cond: [{ $eq: ["$analysis.sentiment", "neutral"] }, 1, 0] } }
    }}
  ]).toArray();
  console.log("\nMap endpoint would return for 'hyderabad':", JSON.stringify(hydMapAgg));

  await mongoose.disconnect();
}
check().catch(e => { console.error(e); process.exit(1); });
