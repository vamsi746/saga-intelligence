# Location Extraction Service

Standalone API that extracts Indian location information from text (tweets, posts, grievances).

## Quick Start

```bash
cd location_service
pip install -r requirements.txt
python app.py
```

Server runs at **http://localhost:5002**

## API

### POST /api/extract-location

Extract location from a single text.

```json
// Request
{ "text": "someone killed elephant at tirumala" }

// Response
{
  "location_found": true,
  "city": "Tirupati",
  "keyword_matched": "tirumala",
  "lat": 13.628,
  "lng": 79.419,
  "confidence": "keyword_match"
}
```

### POST /api/extract-locations-batch

Extract locations from multiple texts at once.

```json
// Request
{
  "items": [
    { "id": "abc123", "text": "traffic jam near charminar" },
    { "id": "def456", "text": "nice weather today" }
  ]
}

// Response
{
  "results": [
    { "id": "abc123", "location_found": true, "city": "Hyderabad", "keyword_matched": "charminar", "lat": 17.385, "lng": 78.486, "confidence": "keyword_match" },
    { "id": "def456", "location_found": false, "city": null, "keyword_matched": null, "lat": null, "lng": null, "confidence": null }
  ]
}
```
