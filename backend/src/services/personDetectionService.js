const { ALL_LEADERS } = require('../config/politicalData');

/**
 * Person Detection Service
 * Identifies political leaders (CM, Ministers, MLAs) in text content and metadata.
 * spacing-aware, casing-aware, and character-aware.
 */

const normalizeText = (text) => {
    if (!text) return '';
    return text.toLowerCase().trim();
};

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Generates a spacing-aware regex for a name.
 * Example: "Revanth Reddy" -> /revanth\s*reddy/i
 */
const getNameRegex = (name) => {
    const parts = name.split(/\s+/).filter(Boolean);
    const pattern = parts.map(p => escapeRegex(p)).join('\\s*');
    return new RegExp(`(^|[^a-z0-9_])(${pattern})(?=$|[^a-z0-9_])`, 'i');
};

/**
 * Detects persons in the given text and metadata.
 * @param {string} text - The content text to scan.
 * @param {object} metadata - Metadata like mentions/handles.
 */
const detectPersons = async (text, metadata = {}) => {
    const results = [];
    const lowerText = normalizeText(text);
    const mentions = (metadata.mentions || []).map(m => normalizeText(m));
    const taggedAccount = normalizeText(metadata.taggedAccount || '');

    for (const leader of ALL_LEADERS) {
        let matchFound = false;
        let matchType = '';

        // 1. Check by Handles (Mentions or Tagged Account)
        const leaderHandles = (leader.handles || []).map(h => normalizeText(h));
        const isMentioned = mentions.some(m => leaderHandles.includes(m) || leaderHandles.includes(`@${m}`));
        const isTagged = leaderHandles.includes(taggedAccount) || leaderHandles.includes(`@${taggedAccount}`);

        if (isMentioned || isTagged) {
            matchFound = true;
            matchType = 'mention';
        }

        // 2. Check by Name in Text (if not already matched by mention)
        if (!matchFound && lowerText) {
            // Full Name match (spacing aware)
            const fullNameRegex = getNameRegex(leader.name);
            if (fullNameRegex.test(text)) {
                matchFound = true;
                matchType = 'text_match';
            }

            // Short Name match (spacing aware) - only if shortName is distinct enough
            if (!matchFound && leader.shortName && leader.shortName.length > 5) {
                const shortNameRegex = getNameRegex(leader.shortName);
                if (shortNameRegex.test(text)) {
                    matchFound = true;
                    matchType = 'text_match';
                }
            }
            
            // Check for Role + Name combinations (e.g. "CM Revanth")
            if (!matchFound && leader.role && leader.shortName) {
                const roleShort = leader.role === 'Chief Minister' ? 'CM' : 
                                  leader.role === 'Deputy Chief Minister' ? 'Deputy CM' : 
                                  leader.role === 'Cabinet Minister' ? 'Minister' : leader.role;
                
                const rolePattern = `(${escapeRegex(roleShort)}|${escapeRegex(leader.role)})\\s*${escapeRegex(leader.shortName)}`;
                const roleRegex = new RegExp(`(^|[^a-z0-9_])${rolePattern}`, 'i');
                if (roleRegex.test(text)) {
                    matchFound = true;
                    matchType = 'text_match';
                }
            }
        }

        if (matchFound) {
            results.push({
                person_id: leader.id,
                name: leader.name,
                role: leader.role,
                district: leader.district,
                constituency: leader.constituency,
                match_type: matchType
            });
        }
    }

    return results;
};

module.exports = {
    detectPersons
};
