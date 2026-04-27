import React, { useMemo } from 'react';
import { MapPin, Users, TrendingUp } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { getMinisterInitials } from '../../data/telanganaMinistersData';

// Andhra Pradesh major districts with approximate SVG coordinates
// Viewport: 0 0 400 380 (W x H)
const AP_DISTRICTS = [
  // Northern AP
  { name: 'Srikakulam',      d: 'M 300 30 L 345 25 L 360 55 L 330 70 L 295 60 Z',       fill: '#fde68a' },
  { name: 'Vizianagaram',    d: 'M 270 45 L 300 30 L 295 60 L 265 75 L 255 60 Z',        fill: '#fde68a' },
  { name: 'Visakhapatnam',   d: 'M 255 60 L 295 60 L 330 70 L 335 105 L 290 115 L 250 95 Z', fill: '#fde68a' },
  { name: 'East Godavari',   d: 'M 220 90 L 255 80 L 290 115 L 285 145 L 245 150 L 215 125 Z', fill: '#fde68a' },
  { name: 'West Godavari',   d: 'M 175 110 L 220 90 L 215 125 L 200 155 L 165 145 L 155 125 Z', fill: '#fed7aa' },
  // Central AP
  { name: 'Krishna',         d: 'M 155 125 L 200 120 L 215 155 L 200 185 L 155 180 L 145 155 Z', fill: '#fed7aa' },
  { name: 'Guntur',          d: 'M 145 155 L 200 150 L 210 185 L 200 215 L 155 220 L 135 195 Z', fill: '#fdba74', highlight: true, label: 'Mangalagiri', labelPos: [165, 190] },
  { name: 'Prakasam',        d: 'M 130 215 L 200 210 L 205 250 L 185 270 L 145 265 L 120 245 Z', fill: '#fde68a' },
  // Southern AP
  { name: 'Nellore',         d: 'M 140 260 L 195 255 L 200 295 L 185 320 L 150 315 L 130 290 Z', fill: '#fde68a' },
  { name: 'Chittoor',        d: 'M 100 290 L 145 285 L 155 320 L 155 355 L 115 360 L 90 335 Z', fill: '#fdba74', highlight: true, label: 'Kuppam', labelPos: [108, 330] },
  { name: 'Kadapa',          d: 'M 100 235 L 145 230 L 150 270 L 135 295 L 95 285 L 85 260 Z', fill: '#fde68a' },
  // Western AP
  { name: 'Kurnool',         d: 'M 65 195 L 120 190 L 130 235 L 105 255 L 60 240 L 50 215 Z',  fill: '#fde68a' },
  { name: 'Anantapur',       d: 'M 55 240 L 105 235 L 110 280 L 100 305 L 55 295 L 42 270 Z',  fill: '#fde68a' },
];

// AP rivers (Godavari and Krishna approximate paths)
const AP_RIVERS = [
  'M 175 110 Q 215 115 250 115',  // Godavari delta
  'M 155 130 Q 185 140 220 140',  // Krishna upper
  'M 145 160 Q 180 165 215 170',  // Krishna lower
];

const POLITICIAN_PINS = [
  {
    id: 'cbn',
    name: 'CBN',
    fullName: 'Chandrababu Naidu',
    constituency: 'Kuppam',
    x: 108, y: 325,
    color: '#d97706',
    image: '/MLA_Images/TDP/cbn.jpeg',
  },
  {
    id: 'lokesh',
    name: 'Lokesh',
    fullName: 'Nara Lokesh',
    constituency: 'Mangalagiri',
    x: 175, y: 185,
    color: '#f59e0b',
    image: '/MLA_Images/TDP/lokesh.webp',
  },
];

const AP_STATS = [
  { label: 'Districts', value: '26' },
  { label: 'Assembly Seats', value: '175' },
  { label: 'State', value: 'Andhra Pradesh' },
];

export const AndhraPradeshMapWidget = ({ politicians = [], onPoliticianClick }) => {
  const mentionCounts = useMemo(() => {
    const counts = {};
    politicians.forEach(p => { counts[p.id] = p._mentionCount || 0; });
    return counts;
  }, [politicians]);

  return (
    <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50/30 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-amber-100 bg-amber-50/80">
        <div className="flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5 text-amber-600" />
          <span className="text-[11px] font-bold text-slate-800">Andhra Pradesh</span>
          <span className="text-[9px] text-slate-400 bg-white/70 px-1.5 py-0.5 rounded-full border border-amber-100">
            AP Monitor
          </span>
        </div>
        <div className="flex items-center gap-2">
          {AP_STATS.map(s => (
            <div key={s.label} className="text-center">
              <div className="text-[10px] font-bold text-amber-700">{s.value}</div>
              <div className="text-[8px] text-slate-400">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-0">
        {/* SVG Map */}
        <div className="relative flex-shrink-0">
          <svg
            viewBox="30 20 340 355"
            width="220"
            height="220"
            className="block"
            style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.1))' }}
          >
            {/* District fills */}
            {AP_DISTRICTS.map(d => (
              <g key={d.name}>
                <path
                  d={d.d}
                  fill={d.highlight ? '#f97316' : d.fill}
                  stroke="#e8c88a"
                  strokeWidth="0.8"
                  opacity={d.highlight ? 0.85 : 0.75}
                />
                {d.highlight && d.label && (
                  <text
                    x={d.labelPos[0]}
                    y={d.labelPos[1]}
                    fontSize="6"
                    fontWeight="700"
                    fill="#7c2d12"
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    {d.label}
                  </text>
                )}
              </g>
            ))}

            {/* Rivers */}
            {AP_RIVERS.map((path, i) => (
              <path key={i} d={path} fill="none" stroke="#93c5fd" strokeWidth="1.2" opacity="0.6" />
            ))}

            {/* Politician pins */}
            {POLITICIAN_PINS.map(pin => (
              <g
                key={pin.id}
                style={{ cursor: onPoliticianClick ? 'pointer' : 'default' }}
                onClick={() => onPoliticianClick?.(pin.id)}
              >
                {/* Pin shadow */}
                <circle cx={pin.x} cy={pin.y + 1} r="8" fill="rgba(0,0,0,0.15)" />
                {/* Pin circle */}
                <circle cx={pin.x} cy={pin.y} r="8" fill={pin.color} stroke="white" strokeWidth="1.5" />
                {/* Pin initial */}
                <text
                  x={pin.x}
                  y={pin.y}
                  fontSize="6"
                  fontWeight="800"
                  fill="white"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {pin.name[0]}
                </text>
                {/* Constituency label */}
                <text
                  x={pin.x}
                  y={pin.y - 12}
                  fontSize="5"
                  fontWeight="600"
                  fill={pin.color}
                  textAnchor="middle"
                  stroke="white"
                  strokeWidth="2"
                  paintOrder="stroke"
                >
                  {pin.constituency}
                </text>
              </g>
            ))}

            {/* State label */}
            <text x="190" y="195" fontSize="8" fill="#92400e" fontWeight="700" textAnchor="middle" opacity="0.5">
              ANDHRA
            </text>
            <text x="190" y="205" fontSize="8" fill="#92400e" fontWeight="700" textAnchor="middle" opacity="0.5">
              PRADESH
            </text>

            {/* Bay of Bengal label */}
            <text x="340" y="130" fontSize="6" fill="#60a5fa" fontWeight="600" textAnchor="middle" opacity="0.7"
              transform="rotate(90, 340, 130)">
              Bay of Bengal
            </text>
          </svg>
        </div>

        {/* Right panel — politician cards */}
        <div className="flex-1 p-2 flex flex-col gap-2 justify-center">
          {POLITICIAN_PINS.map(pin => {
            const wp = politicians.find(p => p.id === (pin.id === 'cbn' ? 'chandra-babu-naidu' : 'nara-lokesh'));
            return (
              <div
                key={pin.id}
                className="flex items-center gap-2 rounded-lg border bg-white/80 p-2 shadow-sm"
                style={{ borderColor: `${pin.color}40` }}
              >
                <Avatar className="h-9 w-9 ring-2 flex-shrink-0" style={{ '--tw-ring-color': pin.color }}>
                  <AvatarImage src={pin.image} alt={pin.fullName} className="object-cover object-top" />
                  <AvatarFallback className="text-white text-xs font-bold" style={{ background: pin.color }}>
                    {getMinisterInitials(pin.fullName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[11px] font-bold text-slate-900 leading-tight">{pin.fullName}</span>
                    {wp?.roleTag && (
                      <span
                        className="text-[8px] font-bold text-white px-1.5 py-0.5 rounded-full"
                        style={{ background: pin.color }}
                      >
                        {wp.roleTag}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <MapPin className="h-2.5 w-2.5 text-amber-500 flex-shrink-0" />
                    <span className="text-[9px] text-slate-500">{pin.constituency}</span>
                  </div>
                </div>
                {mentionCounts[wp?.id] > 0 && (
                  <div className="text-right flex-shrink-0">
                    <div className="text-[11px] font-bold text-amber-700">{mentionCounts[wp.id]}</div>
                    <div className="text-[8px] text-slate-400">mentions</div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Legend */}
          <div className="flex items-center gap-3 mt-1 px-1">
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-orange-500 inline-block" />
              <span className="text-[8px] text-slate-400">Constituency</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-1.5 w-3 bg-blue-300 rounded inline-block opacity-60" />
              <span className="text-[8px] text-slate-400">Rivers</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AndhraPradeshMapWidget;
