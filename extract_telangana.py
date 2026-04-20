import geopandas as gpd
import json
import os

gdf = gpd.read_file('temp_shp/India_AC.shp')
ap = gdf[gdf['ST_NAME'] == 'ANDHRA PRADESH']
ts = ap[(ap['AC_NO'] >= 1) & (ap['AC_NO'] <= 119)].copy()

# Update state info for Telangana
ts['ST_CODE'] = '36'  # Telangana state code
ts['ST_NAME'] = 'TELANGANA'

# Map old 10 districts to new 33 districts based on 2016 reorganization
district_map = {
    1: 'KUMURAMBHEEM ASIFABAD', 2: 'MANCHERIAL', 3: 'MANCHERIAL', 4: 'MANCHERIAL',
    5: 'KUMURAMBHEEM ASIFABAD', 6: 'ADILABAD', 7: 'ADILABAD', 8: 'ADILABAD',
    9: 'NIRMAL', 10: 'NIRMAL',
    11: 'NIZAMABAD', 12: 'NIZAMABAD', 13: 'KAMAREDDY', 14: 'KAMAREDDY',
    15: 'KAMAREDDY', 16: 'KAMAREDDY', 17: 'NIZAMABAD', 18: 'NIZAMABAD', 19: 'NIZAMABAD',
    20: 'JAGTIAL', 21: 'JAGTIAL', 22: 'JAGTIAL',
    23: 'PEDDAPALLI', 24: 'PEDDAPALLI', 25: 'PEDDAPALLI',
    26: 'KARIMNAGAR', 27: 'KARIMNAGAR', 28: 'RAJANNA SIRCILLA', 29: 'RAJANNA SIRCILLA',
    30: 'KARIMNAGAR', 31: 'KARIMNAGAR', 32: 'SIDDIPET',
    33: 'SIDDIPET', 34: 'MEDAK', 35: 'SANGAREDDY', 36: 'SANGAREDDY',
    37: 'MEDAK', 38: 'SANGAREDDY', 39: 'SANGAREDDY', 40: 'SANGAREDDY',
    41: 'SIDDIPET', 42: 'SIDDIPET',
    43: 'MEDCHAL-MALKAJGIRI', 44: 'MEDCHAL-MALKAJGIRI', 45: 'MEDCHAL-MALKAJGIRI',
    46: 'MEDCHAL-MALKAJGIRI', 47: 'MEDCHAL-MALKAJGIRI',
    48: 'RANGAREDDY', 49: 'RANGAREDDY', 50: 'RANGAREDDY', 51: 'RANGAREDDY',
    52: 'RANGAREDDY', 53: 'RANGAREDDY',
    54: 'VIKARABAD', 55: 'VIKARABAD', 56: 'VIKARABAD',
    57: 'HYDERABAD', 58: 'HYDERABAD', 59: 'HYDERABAD', 60: 'HYDERABAD',
    61: 'HYDERABAD', 62: 'HYDERABAD', 63: 'HYDERABAD', 64: 'HYDERABAD',
    65: 'HYDERABAD', 66: 'HYDERABAD', 67: 'HYDERABAD', 68: 'HYDERABAD',
    69: 'HYDERABAD', 70: 'HYDERABAD', 71: 'HYDERABAD',
    72: 'VIKARABAD', 73: 'NARAYANPET', 74: 'MAHABUBNAGAR', 75: 'MAHABUBNAGAR',
    76: 'MAHABUBNAGAR', 77: 'NARAYANPET', 78: 'WANAPARTHY',
    79: 'JOGULAMBA GADWAL', 80: 'JOGULAMBA GADWAL',
    81: 'NAGARKURNOOL', 82: 'NAGARKURNOOL', 83: 'NAGARKURNOOL',
    84: 'RANGAREDDY', 85: 'NAGARKURNOOL',
    86: 'NALGONDA', 87: 'NALGONDA', 88: 'NALGONDA',
    89: 'SURYAPET', 90: 'SURYAPET', 91: 'SURYAPET',
    92: 'NALGONDA', 93: 'NALGONDA',
    94: 'YADADRI BHUVANAGIRI', 95: 'NALGONDA', 96: 'SURYAPET',
    97: 'YADADRI BHUVANAGIRI',
    98: 'JANGAON', 99: 'JANGAON', 100: 'JANGAON',
    101: 'MAHABUBABAD', 102: 'MAHABUBABAD', 103: 'MAHABUBABAD',
    104: 'WARANGAL', 105: 'WARANGAL', 106: 'WARANGAL', 107: 'WARANGAL',
    108: 'JAYASHANKAR BHUPALAPALLY', 109: 'JAYASHANKAR BHUPALAPALLY',
    110: 'BHADRADRI KOTHAGUDEM', 111: 'BHADRADRI KOTHAGUDEM',
    112: 'KHAMMAM', 113: 'KHAMMAM', 114: 'KHAMMAM', 115: 'KHAMMAM', 116: 'KHAMMAM',
    117: 'BHADRADRI KOTHAGUDEM', 118: 'BHADRADRI KOTHAGUDEM', 119: 'BHADRADRI KOTHAGUDEM',
}

# Update district names
for ac_no, dist_name in district_map.items():
    mask = ts['AC_NO'] == ac_no
    ts.loc[mask, 'DIST_NAME'] = dist_name

# Convert to GeoJSON
geojson = json.loads(ts.to_json())

# Clean up properties - ensure proper types
for f in geojson['features']:
    p = f['properties']
    for key in ['AC_NO', 'PC_NO', 'PC_ID', 'OBJECTID']:
        if p.get(key) is not None:
            p[key] = int(p[key])

# Write to file (compact, single line like the Punjab file)
output = 'frontend/public/telangana_ac.geojson'
with open(output, 'w') as fp:
    json.dump(geojson, fp, separators=(',', ':'))

size = os.path.getsize(output)
print(f'Written {len(geojson["features"])} features to {output}')
print(f'File size: {size:,} bytes')

# Verify Mahabubnagar PC ACs
mah = [feat for feat in geojson['features'] if feat['properties']['PC_NAME'] == 'MAHBUBNAGAR']
print(f'\nMahabubnagar PC ACs: {len(mah)}')
for feat in sorted(mah, key=lambda x: x['properties']['AC_NO']):
    p = feat['properties']
    print(f'  AC {p["AC_NO"]}: {p["AC_NAME"]} ({p["DIST_NAME"]})')

# Verify coord range
all_coords = []
for feat in geojson['features']:
    geom = feat['geometry']
    if geom['type'] == 'Polygon':
        for ring in geom['coordinates']:
            all_coords.extend(ring)
    elif geom['type'] == 'MultiPolygon':
        for poly in geom['coordinates']:
            for ring in poly:
                all_coords.extend(ring)

lons = [c[0] for c in all_coords]
lats = [c[1] for c in all_coords]
print(f'\nCoord range: lon [{min(lons):.2f}, {max(lons):.2f}], lat [{min(lats):.2f}, {max(lats):.2f}]')
