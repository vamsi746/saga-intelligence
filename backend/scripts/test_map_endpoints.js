const mongoose = require("mongoose");
require("dotenv").config();

async function test() {
  const dbUri = process.env.MONGODB_URI;
  const dbName = process.env.DB_NAME || "apsagaclone";
  await mongoose.connect(dbUri, { dbName });
  console.log("Connected to DB:", dbName);

  const Grievance = require("../src/models/Grievance");
  
  // Simulate getMapGrievances scope=mahabubnagar
  const since = new Date();
  since.setDate(since.getDate() - 30);
  
  const mahPattern = /mahabubnagar|mahbubnagar/i;
  const capitalPattern = /hyderabad|telangana/i;
  
  const count = await Grievance.countDocuments({
    is_active: true,
    post_date: { $gte: since },
    $or: [
      { "detected_location.city": mahPattern },
      { "detected_location.district": mahPattern },
      { "detected_location.constituency": mahPattern },
      { "detected_location.city": capitalPattern },
      { "detected_location.district": capitalPattern },
      { "detected_location.keyword_matched": capitalPattern }
    ]
  });
  console.log("\nMahabubnagar scope match count (incl Hyderabad):", count);

  // Simulate scope=all for hyderabad keyword
  const hydAgg = await Grievance.aggregate([
    { $match: { is_active: true, post_date: { $gte: since } } },
    { $addFields: {
      _match: { $or: [
        { $regexMatch: { input: { $ifNull: ["$detected_location.city", ""] }, regex: "(^|[^a-z0-9])hyderabad([^a-z0-9]|$)", options: "i" } },
        { $regexMatch: { input: { $ifNull: ["$detected_location.district", ""] }, regex: "(^|[^a-z0-9])hyderabad([^a-z0-9]|$)", options: "i" } },
        { $regexMatch: { input: { $ifNull: ["$detected_location.constituency", ""] }, regex: "(^|[^a-z0-9])hyderabad([^a-z0-9]|$)", options: "i" } },
        { $regexMatch: { input: { $ifNull: ["$detected_location.keyword_matched", ""] }, regex: "(^|[^a-z0-9])hyderabad([^a-z0-9]|$)", options: "i" } }
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
  ]);
  console.log("Hyderabad scope=all result:", JSON.stringify(hydAgg));
  
  // Check telangana keyword match
  const telAgg = await Grievance.aggregate([
    { $match: { is_active: true, post_date: { $gte: since } } },
    { $addFields: {
      _match: { $or: [
        { $regexMatch: { input: { $ifNull: ["$detected_location.city", ""] }, regex: "(^|[^a-z0-9])telangana([^a-z0-9]|$)", options: "i" } },
        { $regexMatch: { input: { $ifNull: ["$detected_location.district", ""] }, regex: "(^|[^a-z0-9])telangana([^a-z0-9]|$)", options: "i" } },
        { $regexMatch: { input: { $ifNull: ["$detected_location.keyword_matched", ""] }, regex: "(^|[^a-z0-9])telangana([^a-z0-9]|$)", options: "i" } }
      ]},
      _hasLoc: { $or: [
        { $gt: [{ $strLenCP: { $trim: { input: { $ifNull: ["$detected_location.city", ""] } } } }, 0] },
        { $gt: [{ $strLenCP: { $trim: { input: { $ifNull: ["$detected_location.district", ""] } } } }, 0] }
      ]}
    }},
    { $match: { $expr: { $and: ["$_hasLoc", "$_match"] } } },
    { $group: { _id: null, count: { $sum: 1 } }}
  ]);
  console.log("Telangana keyword match:", JSON.stringify(telAgg));

  // District distribution after backfill
  const byDist = await Grievance.aggregate([
    { $match: { is_active: true, "detected_location.district": { $exists: true, $nin: [null, ""] } } },
    { $group: { _id: { $toLower: "$detected_location.district" }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);
  console.log("\nDistrict distribution after backfill:");
  byDist.forEach(r => console.log("  ", r._id, ":", r.count));

  await mongoose.disconnect();
}
test().catch(e => { console.error(e); process.exit(1); });
