const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const keywordArticleSchema = new mongoose.Schema({
  id: { type: String, default: uuidv4, unique: true },
  keyword: { type: String, required: true, index: true },
  title: { type: String, required: true },
  source: { type: String, default: 'Unknown' },
  url: { type: String, required: true, unique: true },
  summary: { type: String, default: '' },
  publishedAt: { type: Date, index: true },
  relevanceScore: { type: Number, default: 0 },
  fetchedAt: { type: Date, default: Date.now, index: true }
});

keywordArticleSchema.index({ fetchedAt: -1 });
keywordArticleSchema.index({ keyword: 1, publishedAt: -1 });

module.exports = mongoose.model('KeywordArticle', keywordArticleSchema);
