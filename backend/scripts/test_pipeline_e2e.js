/**
 * Generic E2E Pipeline Tester
 * Run: node scripts/test_pipeline_e2e.js "Your Text Here" "@OptionalHandle"
 */
require('dotenv').config({ path: './.env' });
const mongoose = require('mongoose');
const { upsertGrievanceFromTemp } = require('../src/services/tempContentProcessor');
const Grievance = require('../src/models/Grievance');

const args = process.argv.slice(2);
const inputText = args[0] || `Fake news! Who the hell are these people??????`;
const inputHandle = args[1] || '@random_user';

const TEST_CONTENT = {
    platform: 'x',
    source_identifier: inputHandle,
    source_display_name: 'Test User',
    raw_data: {
        id: 'test_tweet_' + Date.now(),
        id_str: 'test_tweet_' + Date.now(),
        full_text: inputText,
        created_at: new Date().toISOString(),
        user: {
            screen_name: inputHandle.replace('@', ''),
            name: 'Test User',
            verified: false,
            followers_count: 100
        },
        entities: {
            user_mentions: [],
            hashtags: []
        }
    }
};

async function runTest() {
    try {
        console.log('--- STARTING GENERIC E2E TEST ---');
        console.log(`Text: "${inputText}"`);
        console.log(`Handle: ${inputHandle}`);
        
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        
        const grievance = await upsertGrievanceFromTemp(TEST_CONTENT);
        console.log(`\nCreated Grievance ID: ${grievance.id}`);
        
        console.log('Waiting 10 seconds for analysis pipeline...');
        await new Promise(r => setTimeout(r, 10000));

        const result = await Grievance.findOne({ id: grievance.id });
        
        console.log('\n[PASS A] Sentiment & Category:');
        console.log(`  Sentiment: ${result.analysis.sentiment}`);
        console.log(`  Category: ${result.analysis.category}`);
        console.log(`  Topic: ${result.analysis.grievance_type}`);
        console.log(`  Risk: ${result.analysis.risk_level} (${result.analysis.risk_score})`);
        console.log(`  Target Party: ${result.analysis.target_party || 'N/A'}`);
        console.log(`  Stance: ${result.analysis.stance || 'N/A'}`);
        console.log(`  Reasoning: ${result.analysis.reasoning || 'N/A'}`);

        console.log('\n[PASS B.1] Linked Persons:');
        if (result.linked_persons && result.linked_persons.length > 0) {
            result.linked_persons.forEach(p => {
                console.log(`  - ${p.name} (${p.role}) [Match: ${p.match_type}]`);
            });
        } else {
            console.log('  No persons linked (Correct for this content).');
        }

        console.log('\n[PASS C] Location:');
        console.log(`  City: ${result.detected_location.city}`);
        console.log(`  District: ${result.detected_location.district}`);
        console.log(`  Source: ${result.detected_location.source}`);

        process.exit(0);
    } catch (error) {
        console.error('Test Failed:', error);
        process.exit(1);
    }
}

runTest();
