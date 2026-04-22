import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { Separator } from './ui/separator';
import { Youtube, Twitter, Instagram, Facebook, Globe, FileText, Sparkles, CheckCircle, ChevronDown, ChevronUp, MinusCircle, PlusCircle, XCircle, MessageCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';

const AddSourceModal = ({ open, onClose, onSuccess, initialData = null, onDirtyChange }) => {
    const emptyPoiData = {
        realName: '',
        aliasNames: [],
        mobileNumbers: [],
        emailIds: [],
        currentAddress: '',
        psLimits: '',
        districtCommisionerate: '',
        lastUsedIp: '',
        softwareHardwareIdentifiers: '',
        firNo: '',
        firDetails: [],
        linkedIncidents: '',
        briefSummary: '',
        whatsappNumbers: [],
        socialMedia: [],
        previouslyDeletedProfiles: { x: [], facebook: [], instagram: [], youtube: [], dark_web: [], web_articles: [], whatsapp: [] },
        escalatedToIntermediariesCount: ''
    };

    const [formData, setFormData] = useState({
        platform: 'youtube',
        identifier: '',
        display_name: '',
        category: 'others',
        is_active: true,
        priority: 'medium',
        poiData: emptyPoiData
    });
    const [loading, setLoading] = useState(false);
    const [initialState, setInitialState] = useState(null);
    const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

    useEffect(() => {
        if (open) {
            const data = initialData ? {
                platform: initialData.platform || 'youtube',
                identifier: initialData.identifier || '',
                display_name: initialData.display_name || '',
                category: initialData.category || 'others',
                is_active: initialData.is_active !== undefined ? initialData.is_active : true,
                priority: initialData.priority || 'medium',
                poiData: { ...emptyPoiData, ...(initialData.poiData || {}) }
            } : {
                platform: 'youtube',
                identifier: '',
                display_name: '',
                category: 'others',
                is_active: true,
                priority: 'medium',
                poiData: emptyPoiData
            };
            setFormData(data);
            setInitialState(data);
        }
    }, [initialData, open]);

    const hasUnsavedChanges = () => {
        if (!initialState) return false;
        return JSON.stringify(formData) !== JSON.stringify(initialState);
    };

    useEffect(() => {
        if (onDirtyChange) {
            onDirtyChange(hasUnsavedChanges());
        }
    }, [formData, initialState, onDirtyChange]);

    const handleCloseAttempt = (isOpen) => {
        // Only trigger discard check if the dialog is being CLOSED (isOpen === false)
        if (isOpen === false) {
            if (hasUnsavedChanges()) {
                setShowDiscardConfirm(true);
            } else {
                onClose();
            }
        }
    };

    const confirmDiscard = () => {
        setShowDiscardConfirm(false);
        onClose();
    };

    const handlePoiChange = (field, value) => {
        setFormData(prev => {
            const nextPoi = { ...prev.poiData, [field]: value };

            // If realName is changing, sync it with socialMedia displayNames if they are empty or still matching the old realName
            if (field === 'realName') {
                const oldRealName = prev.poiData.realName || '';
                const currentSM = prev.poiData.socialMedia || [];

                nextPoi.socialMedia = currentSM.map(sm => {
                    const currentDN = sm.displayName || '';
                    if (currentDN === '' || currentDN === oldRealName) {
                        return { ...sm, displayName: value };
                    }
                    return sm;
                });
            }

            return { ...prev, poiData: nextPoi };
        });
    };
    const handlePoiArrayChange = (field, idx, value) => {
        setFormData(prev => {
            const arr = [...(prev.poiData[field] || [])];
            arr[idx] = value;
            return { ...prev, poiData: { ...prev.poiData, [field]: arr } };
        });
    };
    const addPoiArrayItem = (field) => {
        setFormData(prev => ({ ...prev, poiData: { ...prev.poiData, [field]: [...(prev.poiData[field] || []), ''] } }));
    };
    const removePoiArrayItem = (field, idx) => {
        setFormData(prev => ({ ...prev, poiData: { ...prev.poiData, [field]: (prev.poiData[field] || []).filter((_, i) => i !== idx) } }));
    };
    const handleFirCountChange = (val) => {
        const count = parseInt(val) || 0;
        const current = formData.poiData.firDetails || [];
        setFormData(prev => {
            let newFirDetails = [...current];
            if (count > current.length) {
                const newRows = Array.from({ length: count - current.length }, () => ({ firNo: '', psLimits: '', districtCommisionerate: '' }));
                newFirDetails = [...current, ...newRows];
            } else {
                newFirDetails = current.slice(0, count);
            }
            return { ...prev, poiData: { ...prev.poiData, firDetails: newFirDetails } };
        });
    };
    const handleFirDetailChange = (idx, field, value) => {
        setFormData(prev => {
            const arr = [...(prev.poiData.firDetails || [])];
            arr[idx] = { ...arr[idx], [field]: value };
            return { ...prev, poiData: { ...prev.poiData, firDetails: arr } };
        });
    };
    const addFirRow = () => {
        setFormData(prev => ({ ...prev, poiData: { ...prev.poiData, firDetails: [...(prev.poiData.firDetails || []), { firNo: '', psLimits: '', districtCommisionerate: '' }] } }));
    };
    const removeFirRow = (idx) => {
        setFormData(prev => ({ ...prev, poiData: { ...prev.poiData, firDetails: (prev.poiData.firDetails || []).filter((_, i) => i !== idx) } }));
    };

    const handleDeletedProfileChange = (key, idx, value) => {
        setFormData(prev => {
            const current = prev.poiData.previouslyDeletedProfiles?.[key] || [];
            const newArr = [...current];
            newArr[idx] = value;
            return { ...prev, poiData: { ...prev.poiData, previouslyDeletedProfiles: { ...prev.poiData.previouslyDeletedProfiles, [key]: newArr } } };
        });
    };

    const addDeletedProfile = (key) => {
        setFormData(prev => ({
            ...prev, poiData: { ...prev.poiData, previouslyDeletedProfiles: { ...prev.poiData.previouslyDeletedProfiles, [key]: [...(prev.poiData.previouslyDeletedProfiles?.[key] || []), ''] } }
        }));
    };

    const removeDeletedProfile = (key, idx) => {
        setFormData(prev => ({
            ...prev, poiData: { ...prev.poiData, previouslyDeletedProfiles: { ...prev.poiData.previouslyDeletedProfiles, [key]: (prev.poiData.previouslyDeletedProfiles?.[key] || []).filter((_, i) => i !== idx) } }
        }));
    };

    const XIcon = <svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-900" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>;

    const renderSocialTable = (platform, icon, label, color) => {
        const allSM = formData.poiData.socialMedia || [];
        const entries = allSM.map((s, i) => ({ ...s, _i: i })).filter(s => s.platform === platform);

        const updateSM = (gi, field, value) => {
            const arr = [...allSM];
            arr[gi] = { ...arr[gi], [field]: value };
            handlePoiChange('socialMedia', arr);
        };
        const removeRow = (gi) => handlePoiChange('socialMedia', allSM.filter((_, i) => i !== gi));
        const addRow = () => handlePoiChange('socialMedia', [...allSM, {
            platform,
            handle: '',
            displayName: f.realName || '',
            category: 'others',
            priority: 'medium',
            isActive: true,
            followerCount: '',
            createdDate: ''
        }]);

        return (
            <div className="space-y-2 pb-2">
                <div className="flex items-center gap-2 mb-1">
                    {icon}
                    <span className="text-[13px] font-semibold text-slate-600">{label}</span>
                    <span className="text-[11px] text-slate-400">({entries.length})</span>
                </div>
                {entries.length > 0 ? (
                    <div className="space-y-3">
                        {entries.map((h, index) => (
                            <div key={h._i} className="border border-slate-200 bg-white rounded-lg p-3 relative shadow-sm">
                                <button type="button" onClick={() => removeRow(h._i)} className="absolute top-2 right-2 text-slate-400 hover:text-red-500 transition-colors"><XCircle className="w-4 h-4" /></button>
                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Monitoring Profile #{index + 1}</span>
                                <div className="grid grid-cols-2 gap-3 mt-2">
                                    <div className="space-y-1">
                                        <Label className="text-[11px] text-slate-500">Identifier / Handle <span className="text-red-500">*</span></Label>
                                        <Input value={h.handle || ''} onChange={e => updateSM(h._i, 'handle', e.target.value)} className="h-7 text-xs" placeholder="@handle" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[11px] text-slate-500">Display Name <span className="text-red-500">*</span></Label>
                                        <Input value={h.displayName || ''} onChange={e => updateSM(h._i, 'displayName', e.target.value)} className="h-7 text-xs" placeholder="Recognizable Name" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[11px] text-slate-500">Category</Label>
                                        <Select value={h.category || 'others'} onValueChange={(v) => updateSM(h._i, 'category', v)}>
                                            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Category" /></SelectTrigger>
                                            <SelectContent>
                                                {categories.map(c => <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[11px] text-slate-500">Priority</Label>
                                        <Select value={h.priority || 'medium'} onValueChange={(v) => updateSM(h._i, 'priority', v)}>
                                            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Priority" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="high" className="text-xs">High</SelectItem>
                                                <SelectItem value="medium" className="text-xs">Medium</SelectItem>
                                                <SelectItem value="low" className="text-xs">Low</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[11px] text-slate-500">Followers (Optional)</Label>
                                        <Input value={h.followerCount || ''} onChange={e => updateSM(h._i, 'followerCount', e.target.value)} className="h-7 text-xs" placeholder="10K" />
                                    </div>
                                    <div className="space-y-1 flex flex-col justify-end">
                                        <div className="flex items-center justify-between border border-slate-200 px-2 py-1 rounded h-7">
                                            <span className={`text-[11px] font-medium ${h.isActive !== false ? 'text-blue-600' : 'text-slate-400'}`}>
                                                {h.isActive !== false ? 'Active' : 'Paused'}
                                            </span>
                                            <Switch checked={h.isActive !== false} onCheckedChange={(v) => updateSM(h._i, 'isActive', v)} className="scale-75 origin-right" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        <button type="button" onClick={addRow} className={`flex items-center gap-1 text-[11px] font-semibold ${color} hover:text-blue-700 mt-2`}><PlusCircle className="w-3.5 h-3.5" /> Add another {label}</button>
                    </div>
                ) : (
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="text-[12px] text-slate-400 italic">No {label.toLowerCase()} linked</span>
                        <button type="button" onClick={addRow} className={`flex items-center gap-1 text-[11px] font-semibold ${color} hover:text-blue-700`}><PlusCircle className="w-3.5 h-3.5" /> Add Profile</button>
                    </div>
                )}
            </div>
        );
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();

        const allSM = formData.poiData.socialMedia || [];
        if (allSM.length === 0) {
            toast.error('Please add at least one Social Media profile to monitor');
            return;
        }

        const isEdit = initialData && (initialData.id || initialData._id);
        setLoading(true);
        try {
            const firstSM = allSM[0];
            const submissionData = {
                ...formData,
                platform: firstSM.platform,
                identifier: firstSM.handle,
                display_name: firstSM.displayName || firstSM.handle,
                category: (firstSM.category || 'others').toLowerCase(),
                priority: firstSM.priority || 'medium',
                is_active: firstSM.isActive !== false,
                poiData: {
                    ...formData.poiData,
                    socialMedia: allSM.map((sm, idx) => idx === 0 ? { ...sm, _isPrimary: true } : sm)
                }
            };

            if (isEdit) {
                const sourceId = initialData.id || initialData._id;
                await api.put(`/sources/${sourceId}`, submissionData);
                toast.success('Source updated successfully', {
                    icon: <CheckCircle className="h-4 w-4 text-emerald-500" />
                });
            } else {
                const response = await api.post('/sources', submissionData);
                const createdSource = response.data; // Get the created source from response

                toast.success('Source added to monitoring list', {
                    icon: <Sparkles className="h-4 w-4 text-amber-500" />
                });

                // Call onSuccess callback with created source before closing
                if (onSuccess) onSuccess(createdSource);
            }
            // Small delay to ensure callback is processed before modal closes
            if (!isEdit) {
                setTimeout(() => {
                    onClose();
                }, 100);
            } else {
                if (onSuccess) onSuccess();
                onClose();
            }
        } catch (error) {
            console.error('Submission error:', error);
            const errorMessage = error.response?.data?.message || error.message;

            if (errorMessage.includes('profile already exist in sources')) {
                // Try to fetch the existing source
                try {
                    const sourcesResponse = await api.get('/sources', {
                        params: {
                            platform: formData.platform,
                            identifier: formData.identifier
                        }
                    });
                    const existingSource = sourcesResponse.data?.data?.find(s =>
                        s.platform === formData.platform && s.identifier === formData.identifier
                    );

                    toast.success('Profile is already being monitored', {
                        description: 'This source is already in your monitoring list.'
                    });

                    if (onSuccess) onSuccess(existingSource);
                } catch (fetchError) {
                    console.error('Failed to fetch existing source:', fetchError);
                    if (onSuccess) onSuccess();
                }
                setTimeout(() => {
                    onClose();
                }, 100);
            } else {
                toast.error('Failed to add source', {
                    description: errorMessage
                });
            }
        } finally {
            setLoading(false);
        }
    };

    const platforms = [
        { value: 'youtube', label: 'YouTube', icon: Youtube },
        { value: 'x', label: 'X (Twitter)', icon: Twitter },
        { value: 'instagram', label: 'Instagram', icon: Instagram },
        { value: 'facebook', label: 'Facebook', icon: Facebook },
        { value: 'dark_web', label: 'Dark Web Search Link', icon: Globe },
        { value: 'web_articles', label: 'Web Articles', icon: FileText },
    ];

    const categories = [
        { value: 'political', label: 'Political' },
        { value: 'communal', label: 'Communal' },
        { value: 'trouble_makers', label: 'Trouble Makers' },
        { value: 'defamation', label: 'Defamation' },
        { value: 'narcotics', label: 'Narcotics' },
        { value: 'history_sheeters', label: 'History Sheeters' },
        { value: 'others', label: 'Others' }
    ];

    const f = formData.poiData;

    return (
        <>
            <Dialog open={open} onOpenChange={handleCloseAttempt}>
                <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="px-6 py-4 border-b border-border bg-muted/20 shrink-0">
                        <DialogTitle className="text-xl font-semibold">
                            {initialData ? 'Edit Profile & Sources' : 'Add Profile & Sources'}
                        </DialogTitle>
                        <DialogDescription>
                            {initialData ? 'Update POI profile and linked social media handles.' : 'Create a POI profile and link social media handles to monitor them together.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">
                        <form id="add-source-form" onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-1 bg-white p-4 rounded-lg border border-slate-200">
                                {/* Real Name */}
                                <div className="flex items-center min-h-[36px]">
                                    <div className="w-1/3 shrink-0"><span className="text-[13px] font-semibold text-slate-500">Real Name</span></div>
                                    <div className="w-2/3 flex items-center">
                                        <span className="text-[13px] text-slate-400 mr-2">:</span>
                                        <input type="text" value={f.realName || ''} onChange={e => handlePoiChange('realName', e.target.value)} className="w-full bg-transparent border-b border-slate-200 text-[14px] text-slate-700 focus:border-blue-500 outline-none pb-0.5" placeholder="Enter full name" />
                                    </div>
                                </div>
                                <div className="h-px bg-slate-100 mb-1" />

                                {/* Alias Names */}
                                <div className="flex items-start min-h-[36px]">
                                    <div className="w-1/3 shrink-0 pt-1"><span className="text-[13px] font-semibold text-slate-500 flex flex-col">Alias Names <span className="text-[10px] font-normal italic text-slate-400 leading-tight">(in real world / social media)</span></span></div>
                                    <div className="w-2/3 flex items-start">
                                        <span className="text-[13px] text-slate-400 mr-2 pt-1">:</span>
                                        <div className="flex-1 space-y-1.5 pt-1">
                                            {(f.aliasNames || []).map((alias, idx) => (
                                                <div key={idx} className="flex items-center gap-2">
                                                    <input type="text" value={alias} onChange={e => handlePoiArrayChange('aliasNames', idx, e.target.value)} className="flex-1 bg-transparent border-b border-slate-200 text-[14px] text-slate-700 focus:border-blue-500 outline-none pb-0.5" />
                                                    <button type="button" onClick={() => removePoiArrayItem('aliasNames', idx)} className="text-red-400 hover:text-red-600"><XCircle className="w-4 h-4" /></button>
                                                </div>
                                            ))}
                                            <button type="button" onClick={() => addPoiArrayItem('aliasNames')} className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 mt-1"><PlusCircle className="w-3.5 h-3.5" /> Add Alias</button>
                                        </div>
                                    </div>
                                </div>
                                <div className="h-px bg-slate-100" />

                                {/* Mobile Number */}
                                <div className="flex items-start min-h-[36px]">
                                    <div className="w-1/3 shrink-0 pt-1"><span className="text-[13px] font-semibold text-slate-500">Mobile Number</span></div>
                                    <div className="w-2/3 flex items-start">
                                        <span className="text-[13px] text-slate-400 mr-2 pt-1">:</span>
                                        <div className="flex-1 space-y-1.5 pt-1">
                                            {(f.mobileNumbers || []).map((num, idx) => (
                                                <div key={idx} className="flex items-center gap-2">
                                                    <input type="text" value={num} onChange={e => handlePoiArrayChange('mobileNumbers', idx, e.target.value)} className="flex-1 bg-transparent border-b border-slate-200 text-[14px] text-slate-700 focus:border-blue-500 outline-none pb-0.5" />
                                                    <button type="button" onClick={() => removePoiArrayItem('mobileNumbers', idx)} className="text-red-400 hover:text-red-600"><MinusCircle className="w-4 h-4" /></button>
                                                </div>
                                            ))}
                                            <button type="button" onClick={() => addPoiArrayItem('mobileNumbers')} className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 mt-1"><PlusCircle className="w-3.5 h-3.5" /> Add Number</button>
                                        </div>
                                    </div>
                                </div>
                                <div className="h-px bg-slate-100" />

                                {/* Email IDs */}
                                <div className="flex items-start min-h-[36px]">
                                    <div className="w-1/3 shrink-0 pt-1"><span className="text-[13px] font-semibold text-slate-500">Email IDs</span></div>
                                    <div className="w-2/3 flex items-start">
                                        <span className="text-[13px] text-slate-400 mr-2 pt-1">:</span>
                                        <div className="flex-1 space-y-1.5 pt-1">
                                            {(f.emailIds || []).map((email, idx) => (
                                                <div key={idx} className="flex items-center gap-2">
                                                    <input type="text" value={email} onChange={e => handlePoiArrayChange('emailIds', idx, e.target.value)} className="flex-1 bg-transparent border-b border-slate-200 text-[14px] text-slate-700 focus:border-blue-500 outline-none pb-0.5" />
                                                    <button type="button" onClick={() => removePoiArrayItem('emailIds', idx)} className="text-red-400 hover:text-red-600"><MinusCircle className="w-4 h-4" /></button>
                                                </div>
                                            ))}
                                            <button type="button" onClick={() => addPoiArrayItem('emailIds')} className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 mt-1"><PlusCircle className="w-3.5 h-3.5" /> Add Email</button>
                                        </div>
                                    </div>
                                </div>
                                <div className="h-px bg-slate-100" />

                                {/* Current Address */}
                                <div className="flex items-start min-h-[36px]">
                                    <div className="w-1/3 shrink-0 pt-1"><span className="text-[13px] font-semibold text-slate-500">Current Address</span></div>
                                    <div className="w-2/3 flex items-start">
                                        <span className="text-[13px] text-slate-400 mr-2 pt-1">:</span>
                                        <div className="flex-1 pt-1">
                                            <textarea value={f.currentAddress || ''} onChange={e => handlePoiChange('currentAddress', e.target.value)} rows={3} className="w-full bg-transparent border-b border-slate-200 text-[14px] text-slate-700 focus:border-blue-500 outline-none resize-none custom-scrollbar" />
                                        </div>
                                    </div>
                                </div>
                                <div className="h-px bg-slate-100" />

                                {/* PS Limits */}
                                <div className="flex items-center min-h-[36px]">
                                    <div className="w-1/3 shrink-0"><span className="text-[13px] font-semibold text-slate-500">PS Limits</span></div>
                                    <div className="w-2/3 flex items-center">
                                        <span className="text-[13px] text-slate-400 mr-2">:</span>
                                        <input type="text" value={f.psLimits || ''} onChange={e => handlePoiChange('psLimits', e.target.value)} className="w-full bg-transparent border-b border-slate-200 text-[14px] text-slate-700 focus:border-blue-500 outline-none pb-0.5" />
                                    </div>
                                </div>
                                <div className="h-px bg-slate-100" />

                                {/* District / Commissionerate */}
                                <div className="flex items-center min-h-[36px]">
                                    <div className="w-1/3 shrink-0"><span className="text-[13px] font-semibold text-slate-500">District / Commissionerate</span></div>
                                    <div className="w-2/3 flex items-center">
                                        <span className="text-[13px] text-slate-400 mr-2">:</span>
                                        <input type="text" value={f.districtCommisionerate || ''} onChange={e => handlePoiChange('districtCommisionerate', e.target.value)} className="w-full bg-transparent border-b border-slate-200 text-[14px] text-slate-700 focus:border-blue-500 outline-none pb-0.5" />
                                    </div>
                                </div>
                                <div className="h-px bg-slate-100" />

                                {/* Last Used IP */}
                                <div className="flex items-center min-h-[36px]">
                                    <div className="w-1/3 shrink-0"><span className="text-[13px] font-semibold text-slate-500">Last Used IP</span></div>
                                    <div className="w-2/3 flex items-center">
                                        <span className="text-[13px] text-slate-400 mr-2">:</span>
                                        <input type="text" value={f.lastUsedIp || ''} onChange={e => handlePoiChange('lastUsedIp', e.target.value)} className="w-full bg-transparent border-b border-slate-200 text-[14px] text-slate-700 font-mono focus:border-blue-500 outline-none pb-0.5" />
                                    </div>
                                </div>
                                <div className="h-px bg-slate-100" />

                                {/* Software / Hardware Identifiers */}
                                <div className="flex items-start min-h-[36px]">
                                    <div className="w-1/3 shrink-0 pt-1"><span className="text-[13px] font-semibold text-slate-500">Software / Hardware Identifiers</span></div>
                                    <div className="w-2/3 flex items-start">
                                        <span className="text-[13px] text-slate-400 mr-2 pt-1">:</span>
                                        <div className="flex-1 pt-1">
                                            <textarea value={f.softwareHardwareIdentifiers || ''} onChange={e => handlePoiChange('softwareHardwareIdentifiers', e.target.value)} rows={3} className="w-full bg-transparent border-b border-slate-200 text-[14px] text-slate-700 focus:border-blue-500 outline-none resize-none custom-scrollbar" />
                                        </div>
                                    </div>
                                </div>
                                <div className="h-px bg-slate-100" />

                                {/* Total FIRs Against */}
                                <div className="flex items-center min-h-[36px]">
                                    <div className="w-1/3 shrink-0"><span className="text-[13px] font-semibold text-slate-500">Total FIRs Against</span></div>
                                    <div className="w-2/3 flex items-center">
                                        <span className="text-[13px] text-slate-400 mr-2">:</span>
                                        <input type="number" min="0" value={(f.firDetails || []).length || ''} onChange={e => handleFirCountChange(e.target.value)} className="w-20 bg-transparent border-b border-slate-200 text-[14px] font-semibold text-slate-700 focus:border-blue-500 outline-none pb-0.5" />
                                    </div>
                                </div>

                                {/* FIR Details Table */}
                                {(f.firDetails && f.firDetails.length > 0) && (
                                    <div className="mt-2 border border-slate-200 rounded-lg overflow-hidden">
                                        <table className="w-full table-fixed border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-200">
                                                    <th className="w-10 py-2 px-2 text-[11px] font-bold text-slate-500 uppercase tracking-wide text-center">#</th>
                                                    <th className="w-[20%] py-2 px-2 text-[11px] font-bold text-slate-500 uppercase tracking-wide text-left border-l border-slate-200">FIR No</th>
                                                    <th className="w-[30%] py-2 px-2 text-[11px] font-bold text-slate-500 uppercase tracking-wide text-left border-l border-slate-200">PS Limits</th>
                                                    <th className="w-[30%] py-2 px-2 text-[11px] font-bold text-slate-500 uppercase tracking-wide text-left border-l border-slate-200">District / Commissionerate</th>
                                                    <th className="w-8" />
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {f.firDetails.map((fir, idx) => (
                                                    <tr key={idx} className={`border-b border-slate-100 last:border-b-0 ${idx % 2 === 1 ? 'bg-slate-50/50' : ''}`}>
                                                        <td className="py-1.5 px-2 align-top text-center text-[12px] text-slate-400 font-medium">{idx + 1}</td>
                                                        <td className="py-1.5 px-2 border-l border-slate-200 align-top">
                                                            <input type="text" value={fir.firNo} onChange={e => handleFirDetailChange(idx, 'firNo', e.target.value)} className="w-full bg-transparent text-[12px] text-slate-700 outline-none" />
                                                        </td>
                                                        <td className="py-1.5 px-2 border-l border-slate-200 align-top">
                                                            <input type="text" value={fir.psLimits} onChange={e => handleFirDetailChange(idx, 'psLimits', e.target.value)} className="w-full bg-transparent text-[12px] text-slate-700 outline-none" />
                                                        </td>
                                                        <td className="py-1.5 px-2 border-l border-slate-200 align-top">
                                                            <input type="text" value={fir.districtCommisionerate} onChange={e => handleFirDetailChange(idx, 'districtCommisionerate', e.target.value)} className="w-full bg-transparent text-[12px] text-slate-700 outline-none" />
                                                        </td>
                                                        <td className="w-8 py-1.5 text-center align-top border-l border-slate-200">
                                                            <button type="button" onClick={() => removeFirRow(idx)} className="text-red-400 hover:text-red-600"><MinusCircle className="w-3.5 h-3.5" /></button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        <div className="py-1.5 px-3 border-t border-slate-200 bg-slate-50/30">
                                            <button type="button" onClick={addFirRow} className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700"><PlusCircle className="w-3.5 h-3.5" /> Add Row</button>
                                        </div>
                                    </div>
                                )}
                                <div className="h-px bg-slate-100 mt-4 mb-2" />

                                {/* Linked Incidents */}
                                <div className="flex items-start min-h-[36px]">
                                    <div className="w-1/3 shrink-0 pt-1"><span className="text-[13px] font-semibold text-slate-500">Linked Incidents</span></div>
                                    <div className="w-2/3 flex items-start">
                                        <span className="text-[13px] text-slate-400 mr-2 pt-1">:</span>
                                        <div className="flex-1 pt-1">
                                            <textarea value={f.linkedIncidents || ''} onChange={e => handlePoiChange('linkedIncidents', e.target.value)} rows={3} className="w-full bg-transparent border-b border-slate-200 text-[14px] text-slate-700 focus:border-blue-500 outline-none resize-none custom-scrollbar" />
                                        </div>
                                    </div>
                                </div>
                                <div className="h-px bg-slate-100" />

                                {/* Escalations */}
                                <div className="flex items-center min-h-[36px]">
                                    <div className="w-1/3 shrink-0"><span className="text-[13px] font-semibold text-slate-500">No of times escalated to Intermediaries</span></div>
                                    <div className="w-2/3 flex items-center">
                                        <span className="text-[13px] text-slate-400 mr-2">:</span>
                                        <input type="text" value="" disabled readOnly className="w-full bg-transparent text-[13px] font-medium italic text-slate-400 focus:outline-none pb-0.5" placeholder="Auto-fetched on escalations" />
                                    </div>
                                </div>
                                <div className="h-px bg-slate-100" />

                                {/* Social Media Profiles Table */}
                                <div className="pt-2 space-y-4">
                                    <div className="text-[13px] font-bold text-slate-500 tracking-wider">Social Media Profiles</div>
                                    {renderSocialTable('x', <Twitter className="w-4 h-4 text-slate-900" />, 'X Profile', 'text-sky-600')}
                                    {renderSocialTable('facebook', <Facebook className="w-4 h-4 text-blue-600" />, 'Facebook Profile', 'text-blue-600')}
                                    {renderSocialTable('instagram', <Instagram className="w-4 h-4 text-pink-500" />, 'Instagram Profile', 'text-pink-600')}
                                    {renderSocialTable('youtube', <Youtube className="w-4 h-4 text-red-500" />, 'YouTube Profile', 'text-red-600')}
                                    {renderSocialTable('dark_web', <Globe className="w-4 h-4 text-violet-600" />, 'Dark Web Search Link', 'text-violet-600')}
                                    {renderSocialTable('web_articles', <FileText className="w-4 h-4 text-emerald-600" />, 'Web Articles', 'text-emerald-600')}
                                </div>
                                <div className="h-px bg-slate-100 mt-4 mb-2" />

                                {/* WhatsApp Numbers */}
                                <div className="flex items-start min-h-[36px]">
                                    <div className="w-1/3 shrink-0 pt-1 flex items-center gap-1.5">
                                        <MessageCircle className="w-3.5 h-3.5 text-green-500" />
                                        <span className="text-[13px] font-semibold text-slate-500">WhatsApp</span>
                                    </div>
                                    <div className="w-2/3 flex items-start">
                                        <span className="text-[13px] text-slate-400 mr-2 pt-1">:</span>
                                        <div className="flex-1 space-y-1.5 pt-1">
                                            {(f.whatsappNumbers || []).map((num, idx) => (
                                                <div key={idx} className="flex items-center gap-2">
                                                    <input type="text" value={num} onChange={e => handlePoiArrayChange('whatsappNumbers', idx, e.target.value)} className="flex-1 bg-transparent border-b border-slate-200 text-[14px] text-slate-700 focus:border-green-500 outline-none pb-0.5" placeholder="98745632145" />
                                                    <button type="button" onClick={() => removePoiArrayItem('whatsappNumbers', idx)} className="text-red-400 hover:text-red-600"><MinusCircle className="w-4 h-4" /></button>
                                                </div>
                                            ))}
                                            <button type="button" onClick={() => addPoiArrayItem('whatsappNumbers')} className="flex items-center gap-1 text-[11px] font-semibold text-green-600 hover:text-green-700 mt-1"><PlusCircle className="w-3.5 h-3.5" /> Add Number</button>
                                        </div>
                                    </div>
                                </div>
                                <div className="h-px bg-slate-100 mt-4 mb-2" />

                                {/* Previously Deleted Profiles */}
                                <div className="pt-2">
                                    <div className="text-[13px] font-bold text-slate-500 tracking-wider mb-2">Previously Deleted Profiles</div>
                                    {[
                                        { key: 'x', label: 'X Profiles' },
                                        { key: 'facebook', label: 'Face Book' },
                                        { key: 'instagram', label: 'Instagram' },
                                        { key: 'youtube', label: 'Youtube' },
                                        { key: 'dark_web', label: 'Dark Web Search Link' },
                                        { key: 'web_articles', label: 'Web Articles' },
                                        { key: 'whatsapp', label: 'Whatsapp' }
                                    ].map(({ key, label }) => {
                                        const profiles = f.previouslyDeletedProfiles?.[key] || [];
                                        return (
                                            <div key={key} className="flex items-start min-h-[36px] mb-1">
                                                <div className="w-1/3 shrink-0 pt-1"><span className="text-[13px] font-semibold text-slate-500">{label}</span></div>
                                                <div className="w-2/3 flex items-start">
                                                    <span className="text-[13px] text-slate-400 mr-2 pt-1">:</span>
                                                    <div className="flex-1 space-y-1 pt-1">
                                                        {(profiles.length > 0 ? profiles : ['']).map((val, idx) => (
                                                            <div key={idx} className="flex items-center gap-1">
                                                                <input type="text" value={val} onChange={e => handleDeletedProfileChange(key, idx, e.target.value)} className="flex-1 bg-transparent border-b border-slate-200 text-[14px] text-slate-700 focus:border-blue-500 outline-none pb-0.5" placeholder="Unknown" />
                                                                {profiles.length > 1 && (
                                                                    <button type="button" onClick={() => removeDeletedProfile(key, idx)} className="text-red-400 hover:text-red-600"><MinusCircle className="w-3.5 h-3.5" /></button>
                                                                )}
                                                            </div>
                                                        ))}
                                                        <button type="button" onClick={() => addDeletedProfile(key)} className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 mt-1"><PlusCircle className="w-3.5 h-3.5" /> Add Field</button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </form>
                    </div>

                    <DialogFooter className="px-6 py-4 border-t border-border bg-muted/20 shrink-0">
                        <div className="flex gap-3 w-full">
                            <Button type="button" variant="outline" className="flex-1" onClick={() => handleCloseAttempt(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" form="add-source-form" className="flex-1" disabled={loading}>
                                {loading ? (initialData ? 'Updating...' : 'Adding...') : (initialData ? 'Update Source' : 'Add Source')}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Discard Confirmation Dialog */}
            <Dialog open={showDiscardConfirm} onOpenChange={setShowDiscardConfirm}>
                <DialogContent className="sm:max-w-md bg-white border-none shadow-2xl rounded-xl p-6">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-amber-600">
                            <AlertTriangle className="h-5 w-5" />
                            Discard Changes?
                        </DialogTitle>
                        <DialogDescription className="text-slate-500 pt-2 text-[14px] leading-relaxed font-medium">
                            You've entered information for a new profile. Are you sure you want to discard these details? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-2 mt-6">
                        <Button
                            onClick={confirmDiscard}
                            className="w-full bg-amber-600 hover:bg-amber-700 text-white border-none font-bold h-11 rounded-xl shadow-md active:scale-[0.98] transition-all"
                        >
                            Discard Changes
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={() => setShowDiscardConfirm(false)}
                            className="w-full text-slate-600 hover:bg-slate-100 font-bold h-11 rounded-xl border border-slate-200"
                        >
                            Keep Editing
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default AddSourceModal;

