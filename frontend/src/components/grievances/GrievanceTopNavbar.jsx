import React, { useState } from 'react';
import {
    ChevronDown, X as XIcon, Globe, Plus, MapPin
} from 'lucide-react';
import { Button } from '../ui/button';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator
} from '../ui/dropdown-menu';
import { cn } from '../../lib/utils';

/* ═══════════════════════════════════════════════════════════════ */
/*                  PLATFORM ICONS & COMPONENTS                   */
/* ═══════════════════════════════════════════════════════════════ */

// X (Twitter) Logo
const XLogo = ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
);

// Facebook Logo
const FacebookLogo = ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
);

// YouTube Logo
const YouTubeLogo = ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
);

/* ═══════════════════════════════════════════════════════════════ */
/*                  MAIN NAVBAR COMPONENT                         */
/* ═══════════════════════════════════════════════════════════════ */

export const GrievanceTopNavbar = ({
    activePlatform = 'all',
    onPlatformChange,
    selectedHandle = null,
    onHandleChange,
    sources = [],
    onAddSource,
    locationFilter = null,
    onLocationChange,
    uniqueLocations = [],
}) => {
    const [isHandleDropdownOpen, setIsHandleDropdownOpen] = useState(false);
    const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);

    // Platform tabs
    const PLATFORMS = [
        { id: 'all', label: 'All', icon: null, color: 'text-slate-600' },
        { id: 'x', label: 'X', icon: XLogo, color: 'text-black' },
        { id: 'facebook', label: 'Facebook', icon: FacebookLogo, color: 'text-[#1877F2]' },
        { id: 'youtube', label: 'YouTube', icon: YouTubeLogo, color: 'text-[#FF0000]' },
    ];

    const selectedHandleData = sources.find(h => h.handle === selectedHandle || h.id === selectedHandle);

    return (
        <div className="w-full bg-white border-b border-slate-200">
            <div className="w-full px-3 sm:px-4 lg:px-6 py-3">
                <div className="flex w-full flex-col gap-3 xl:flex-row xl:items-center xl:gap-4">
                    <div className="min-w-0 flex-1">
                        <div className="overflow-x-auto scrollbar-hide">
                            <div className="flex min-w-max items-center gap-2 border-b border-slate-100 pb-2 xl:min-w-0">
                                {PLATFORMS.map((platform) => {
                                    const isActive = activePlatform === platform.id;
                                    const Icon = platform.icon;

                                    return (
                                        <button
                                            key={platform.id}
                                            onClick={() => onPlatformChange?.(platform.id)}
                                            className={cn(
                                                'flex min-w-[92px] items-center justify-center gap-2 px-4 py-3 text-sm sm:text-base font-semibold transition-all duration-200 relative whitespace-nowrap rounded-lg active:scale-95 active:translate-y-[1px]',
                                                'hover:bg-slate-50',
                                                isActive
                                                    ? 'text-slate-900 font-semibold border-b-2 border-blue-500'
                                                    : 'text-slate-600 hover:text-slate-900'
                                            )}
                                        >
                                            {Icon ? (
                                                <Icon className={cn('h-4 w-4 sm:h-5 sm:w-5', platform.color)} />
                                            ) : (
                                                <Globe className="h-4 w-4 sm:h-5 sm:w-5 text-slate-600" />
                                            )}
                                            <span>{platform.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="flex w-full flex-wrap items-center gap-2 xl:w-auto xl:flex-nowrap xl:justify-end">
                        <div className="min-w-0 flex-1 sm:flex-none">
                            <DropdownMenu open={isLocationDropdownOpen} onOpenChange={setIsLocationDropdownOpen}>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className={cn(
                                            'flex w-full sm:w-auto max-w-full items-center justify-between gap-2 font-medium',
                                            locationFilter ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : ''
                                        )}
                                    >
                                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                                        <span className="truncate max-w-[160px]">
                                            {locationFilter || 'Location'}
                                        </span>
                                        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56 max-h-72 overflow-y-auto">
                                    <DropdownMenuLabel className="text-slate-700 font-semibold">
                                        Filter by Location
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator />

                                    {locationFilter && (
                                        <>
                                            <DropdownMenuItem
                                                onClick={() => {
                                                    onLocationChange?.(null);
                                                    setIsLocationDropdownOpen(false);
                                                }}
                                                className="cursor-pointer text-slate-600 hover:bg-slate-100"
                                            >
                                                <span className="flex items-center gap-2">
                                                    <XIcon className="h-3.5 w-3.5" />
                                                    Clear Selection
                                                </span>
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                        </>
                                    )}

                                    {uniqueLocations.length > 0 ? (
                                        uniqueLocations.map((loc) => (
                                            <DropdownMenuItem
                                                key={loc.city}
                                                onClick={() => {
                                                    onLocationChange?.(loc.city);
                                                    setIsLocationDropdownOpen(false);
                                                }}
                                                className={cn(
                                                    'cursor-pointer transition-colors',
                                                    locationFilter === loc.city
                                                        ? 'bg-emerald-50 text-emerald-700 font-semibold'
                                                        : 'text-slate-700 hover:bg-slate-100'
                                                )}
                                            >
                                                <div className="flex items-center justify-between w-full gap-2">
                                                    <span className="flex min-w-0 items-center gap-2">
                                                        <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                                                        <span className="truncate">{loc.city}</span>
                                                    </span>
                                                    <span className={cn(
                                                        'text-xs font-medium ml-2 shrink-0',
                                                        locationFilter === loc.city ? 'text-emerald-600' : 'text-slate-400'
                                                    )}>
                                                        {loc.count}
                                                    </span>
                                                </div>
                                            </DropdownMenuItem>
                                        ))
                                    ) : (
                                        <div className="px-3 py-2 text-xs text-slate-400 text-center">
                                            No locations detected
                                        </div>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        {activePlatform === 'all' && (
                            <div className="min-w-0 flex-1 sm:flex-none">
                                <DropdownMenu open={isHandleDropdownOpen} onOpenChange={setIsHandleDropdownOpen}>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className={cn(
                                                'flex w-full sm:w-auto max-w-full items-center justify-between gap-2 font-medium',
                                                selectedHandle ? 'bg-blue-50 text-blue-700 border-blue-300' : ''
                                            )}
                                        >
                                            <span className="truncate max-w-[180px]">
                                                {selectedHandleData?.display_name || selectedHandleData?.handle || 'Select Handle'}
                                            </span>
                                            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-56">
                                        <DropdownMenuLabel className="text-slate-700 font-semibold">
                                            Filter by Account
                                        </DropdownMenuLabel>
                                        <DropdownMenuSeparator />

                                        {selectedHandle && (
                                            <>
                                                <DropdownMenuItem
                                                    onClick={() => {
                                                        onHandleChange?.(null);
                                                        setIsHandleDropdownOpen(false);
                                                    }}
                                                    className="cursor-pointer text-slate-600 hover:bg-slate-100"
                                                >
                                                    <span className="flex items-center gap-2">
                                                        <XIcon className="h-3.5 w-3.5" />
                                                        Clear Selection
                                                    </span>
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                            </>
                                        )}

                                        {sources.map((source) => (
                                            <DropdownMenuItem
                                                key={source.id || source.handle}
                                                onClick={() => {
                                                    onHandleChange?.(source.handle);
                                                    setIsHandleDropdownOpen(false);
                                                }}
                                                className={cn(
                                                    'cursor-pointer transition-colors',
                                                    selectedHandle === source.handle
                                                        ? 'bg-blue-50 text-blue-700 font-semibold'
                                                        : 'text-slate-700 hover:bg-slate-100'
                                                )}
                                            >
                                                <div className="flex min-w-0 flex-col gap-1">
                                                    <span className="truncate font-medium">{source.display_name || source.handle}</span>
                                                    <span className="truncate text-xs text-slate-500">@{source.handle}</span>
                                                </div>
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        )}

                        {activePlatform !== 'whatsapp' && (
                            <div className="flex-1 sm:flex-none">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={onAddSource}
                                    className="w-full sm:w-auto gap-2 font-medium text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    Add Account
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

};

export default GrievanceTopNavbar;
