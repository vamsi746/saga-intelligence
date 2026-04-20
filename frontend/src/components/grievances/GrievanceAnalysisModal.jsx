import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ExternalLink } from 'lucide-react';

/**
 * Grievance Analysis Modal — matches Alert ReasonModal layout exactly.
 */
const GrievanceAnalysisModal = ({ open, onClose, grievance }) => {
    const [isContentExpanded, setIsContentExpanded] = useState(false);

    if (!grievance) return null;

    const analysis = grievance.analysis || {};
    const rawRiskLevel = (() => {
        const raw = (analysis.risk_level || 'low').toLowerCase();
        return raw === 'critical' ? 'high' : raw;
    })();
    const sentiment = (analysis.sentiment || 'neutral').toLowerCase();
    const riskScore = analysis.risk_score || 0;
    const category = analysis.category || '';
    const grievanceType = analysis.grievance_type || '';
    const displayGrievanceType = (() => {
        const normalized = String(grievanceType || '').trim().toLowerCase();
        if (normalized === 'government praise' || normalized === 'govt praise' || normalized === 'general praise') {
            return 'General Complaint';
        }
        return grievanceType;
    })();
    const grievanceTopicReasoning = analysis.grievance_topic_reasoning || analysis.llm_analysis?.grievance_reasoning || '';
    const violatedPolicies = analysis.violated_policies || [];
    const legalSections = analysis.legal_sections || [];
    const reasons = analysis.reasons || [];
    const llmAnalysis = analysis.llm_analysis || {};
    const explanation = analysis.explanation || '';
    const contentText = grievance.content?.full_text || grievance.content?.text || '';

    // Use same sentiment field as the card badge (which maps neutral to Medium)
    const riskLabel = sentiment === 'negative' ? 'Negative'
        : sentiment === 'neutral' ? 'Medium' : 'Positive';

    const safeReasons = Array.isArray(reasons)
        ? reasons.filter(r => r && typeof r === 'string' && r.trim().length > 0)
        : [];

    // Align score with risk level & sentiment (heuristic fallback for 0% scores)
    const finalScore = (() => {
        let s = riskScore;
        // If score is missing or 0, provide heuristic based on risk level or sentiment
        if (!s || s === 0) {
            if (rawRiskLevel === 'high') s = 75;
            else if (sentiment === 'negative') s = 75;
            else if (rawRiskLevel === 'medium' || sentiment === 'neutral') s = 45;
            else s = 15;
        }

        if (rawRiskLevel === 'low' && s > 40) s = 35;
        if (rawRiskLevel === 'high' && s < 70) s = 75;
        return s;
    })();

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-lg font-semibold border-b pb-3">
                        Alert Analysis Details
                    </DialogTitle>
                </DialogHeader>

                <div className="mt-4">
                    <table className="w-full text-sm border-collapse">
                        <tbody>
                            {/* Risk Level */}
                            <tr className="border-b">
                                <td className="py-3 pr-4 font-medium text-gray-600 dark:text-gray-400">Risk Level</td>
                                <td className="py-3">
                                    <Badge className={
                                        sentiment === 'negative' ? 'bg-red-100 text-red-700 hover:bg-red-200 border-red-200' :
                                            sentiment === 'neutral' ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200' :
                                                'bg-green-100 text-green-700 hover:bg-green-200 border-green-200'
                                    }>
                                        {riskLabel.toUpperCase()}
                                    </Badge>
                                </td>
                            </tr>

                            {/* Risk Score */}
                            <tr className="border-b">
                                <td className="py-3 pr-4 font-medium text-gray-600 dark:text-gray-400">Risk Score</td>
                                <td className="py-3 font-semibold text-lg">
                                    {finalScore}%
                                </td>
                            </tr>

                            {/* Category */}
                            <tr className="border-b">
                                <td className="py-3 pr-4 font-medium text-gray-600 dark:text-gray-400 align-top">Category</td>
                                <td className="py-3">
                                    {category ? (
                                        <Badge variant="outline" className="text-indigo-700 dark:text-indigo-400 border-indigo-200 bg-indigo-50 dark:bg-indigo-900/10">
                                            {category}
                                        </Badge>
                                    ) : (
                                        <span className="text-gray-400 italic">Uncategorized</span>
                                    )}
                                </td>
                            </tr>

                            {/* Grievance Topic */}
                            <tr className="border-b">
                                <td className="py-3 pr-4 font-medium text-gray-600 dark:text-gray-400 align-top">Grievance Topic</td>
                                <td className="py-3">
                                    {displayGrievanceType && displayGrievanceType !== 'Normal' && displayGrievanceType !== 'Not a Grievance' ? (
                                        <div>
                                            <Badge variant="outline" className="text-teal-700 dark:text-teal-400 border-teal-200 bg-teal-50 dark:bg-teal-900/10">
                                                {displayGrievanceType}
                                            </Badge>
                                            {grievanceTopicReasoning && (
                                                <p className="text-xs text-gray-500 mt-1.5">{grievanceTopicReasoning}</p>
                                            )}
                                        </div>
                                    ) : (
                                        <span className="text-gray-400 italic">{displayGrievanceType || 'Not classified'}</span>
                                    )}
                                </td>
                            </tr>

                            {/* Indian Laws Violated */}
                            <tr className="border-b">
                                <td className="py-3 pr-4 font-medium text-gray-600 dark:text-gray-400 align-top">Indian Laws Violated</td>
                                <td className="py-3">
                                    {legalSections.length > 0 ? (
                                        <div className="space-y-2">
                                            {legalSections.map((law, idx) => (
                                                <div key={idx}>
                                                    <span className="font-semibold">{law.act || 'BNS 2023'} Section {law.section || law.code}</span>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{law.description || law.title}</p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="text-gray-400 italic">None detected</span>
                                    )}
                                </td>
                            </tr>

                            {/* Platform Policies Violated */}
                            <tr className="border-b">
                                <td className="py-3 pr-4 font-medium text-gray-600 dark:text-gray-400 align-top">Platform Policies Violated</td>
                                <td className="py-3">
                                    {violatedPolicies.length > 0 ? (
                                        <div className="space-y-3">
                                            {['x', 'youtube', 'meta'].map(platformGroup => {
                                                let policies = [];
                                                let platformName = '';

                                                if (platformGroup === 'x') {
                                                    policies = violatedPolicies.filter(p => (p.platform || '').toLowerCase() === 'x');
                                                    platformName = 'X (Twitter)';
                                                } else if (platformGroup === 'youtube') {
                                                    policies = violatedPolicies.filter(p => (p.platform || '').toLowerCase() === 'youtube');
                                                    platformName = 'YouTube';
                                                } else if (platformGroup === 'meta') {
                                                    policies = violatedPolicies.filter(p => ['facebook', 'instagram'].includes((p.platform || '').toLowerCase()));
                                                    platformName = 'Meta';
                                                    const uniqueNames = new Set();
                                                    policies = policies.filter(p => {
                                                        const name = p.name || p.policy_name || p.policy_id || String(p);
                                                        if (uniqueNames.has(name)) return false;
                                                        uniqueNames.add(name);
                                                        return true;
                                                    });
                                                }

                                                if (policies.length === 0) return null;

                                                return (
                                                    <div key={platformGroup}>
                                                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{platformName}</div>
                                                        <div className="space-y-1">
                                                            {policies.map((p, idx) => (
                                                                <div key={idx} className="text-sm border-l-2 border-gray-200 pl-2">
                                                                    {p.name || p.policy_name || p.policy_id || String(p)}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {violatedPolicies.some(p => !['x', 'youtube', 'facebook', 'instagram'].includes((p.platform || '').toLowerCase())) && (
                                                <div>
                                                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Other</div>
                                                    <div className="space-y-1">
                                                        {violatedPolicies.filter(p => !['x', 'youtube', 'facebook', 'instagram'].includes((p.platform || '').toLowerCase())).map((p, idx) => (
                                                            <div key={idx} className="text-sm border-l-2 border-gray-200 pl-2">
                                                                {p.name || p.policy_name || p.policy_id || String(p)}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <span className="text-gray-400 italic">None detected</span>
                                    )}
                                </td>
                            </tr>

                            {/* Expert Logic */}
                            <tr className="border-b">
                                <td className="py-3 pr-4 font-medium text-gray-600 dark:text-gray-400 align-top">Expert Logic</td>
                                <td className="py-3">
                                    <div className="space-y-2 text-gray-700 dark:text-gray-300">
                                        {(llmAnalysis?.reasoning || explanation) ? (
                                            <div>{llmAnalysis?.reasoning || explanation}</div>
                                        ) : (
                                            <ul className="list-disc pl-4 space-y-1">
                                                {safeReasons.length > 0 ? safeReasons.map((r, i) => (
                                                    <li key={i}>{r}</li>
                                                )) : (
                                                    <li>Potential risk detected by internal analysis.</li>
                                                )}
                                            </ul>
                                        )}
                                    </div>
                                </td>
                            </tr>

                            {/* Subject Content */}
                            <tr className="border-b">
                                <td className="py-3 pr-4 font-medium text-gray-600 dark:text-gray-400 align-top">Subject Content</td>
                                <td className="py-3">
                                    <div className={`whitespace-pre-wrap ${isContentExpanded ? '' : 'line-clamp-3'}`}>
                                        {contentText || 'No content preview available'}
                                    </div>
                                    {((contentText).length > 100 || ((contentText).match(/\n/g) || []).length >= 2) && (
                                        <button
                                            onClick={() => setIsContentExpanded(!isContentExpanded)}
                                            className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-1 hover:underline"
                                        >
                                            {isContentExpanded ? 'View Less' : 'View More'}
                                        </button>
                                    )}
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Action Buttons */}
                    <div className="mt-6 flex flex-col gap-2 border-t pt-4">
                        {(grievance.tweet_url || grievance.url) && (
                            <Button asChild className="w-full">
                                <a href={grievance.tweet_url || grievance.url} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    Review Original Source
                                </a>
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default GrievanceAnalysisModal;
