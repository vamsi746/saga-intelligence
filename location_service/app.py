"""
Location Extraction API — Flask server that exposes the location model
as REST endpoints for the grievance module to call.

Mirrors the exact same 3-step cascade as TweetPulse India (fetch_tweets.py):
  Step 1: User profile location field  (highest confidence)
  Step 2: Post/tweet text content       (keyword scan)
  Step 3: Hashtags → user bio           (fallback)
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
from location_model import extract_location, extract_location_multi, INDIA_CITY_COORDS

app = Flask(__name__)
CORS(app, origins="*")  # Allow cross-origin calls from the React frontend


@app.route('/api/extract-location', methods=['POST'])
def api_extract_location():
    """
    Extract location from a post/tweet — uses the same 3-step cascade as TweetPulse India.

    Simple mode (text only):
        { "text": "someone killed elephant at tirumala" }

    Full mode (same cascade as TweetPulse India fetch_tweets.py):
        {
            "text": "someone killed elephant at tirumala",
            "user_location": "Bengaluru, India",
            "user_bio": "Activist from Karnataka",
            "hashtags": "#SaveWildlife #Tirumala"
        }

    Response:
        {
            "location_found": true,
            "city": "Tirupati",
            "keyword_matched": "tirumala",
            "lat": 13.628,
            "lng": 79.419,
            "confidence": "keyword_match",
            "source": "text"
        }
    """
    data = request.get_json(silent=True) or {}
    text = data.get('text', '')
    user_location = data.get('user_location', '')
    user_bio = data.get('user_bio', '')
    hashtags = data.get('hashtags', '')

    if not text and not user_location and not user_bio and not hashtags:
        return jsonify({
            'error': 'No text fields provided',
            'location_found': False,
            'city': None,
            'keyword_matched': None,
            'lat': None,
            'lng': None,
            'confidence': None,
            'source': None,
        }), 400

    # Use multi-field extraction (same 3-step cascade as TweetPulse India)
    result = extract_location_multi(
        text=text,
        user_location=user_location,
        user_bio=user_bio,
        hashtags=hashtags,
    )
    return jsonify(result)


@app.route('/api/extract-locations-batch', methods=['POST'])
def api_extract_locations_batch():
    """
    Extract locations from multiple grievance/tweet items in one call.
    Uses the 3-step cascade for each item.

    Request:
        {
            "items": [
                {
                    "id": "abc123",
                    "text": "traffic jam near charminar",
                    "user_location": "Hyderabad, India",
                    "user_bio": "",
                    "hashtags": ""
                },
                {
                    "id": "def456",
                    "text": "nice weather today"
                }
            ]
        }

    Response:
        {
            "results": [
                { "id": "abc123", "location_found": true, "city": "Hyderabad", "source": "user_location", ... },
                { "id": "def456", "location_found": false, ... }
            ]
        }
    """
    data = request.get_json(silent=True) or {}
    items = data.get('items', [])

    if not items:
        return jsonify({'error': 'Missing "items" array', 'results': []}), 400

    results = []
    for item in items:
        item_id = item.get('id', '')
        result = extract_location_multi(
            text=item.get('text', ''),
            user_location=item.get('user_location', ''),
            user_bio=item.get('user_bio', ''),
            hashtags=item.get('hashtags', ''),
        )
        result['id'] = item_id
        results.append(result)

    return jsonify({'results': results})


@app.route('/api/cities', methods=['GET'])
def api_cities():
    """Return all known cities with coordinates."""
    cities = []
    for city, (lat, lng) in INDIA_CITY_COORDS.items():
        cities.append({'city': city, 'lat': lat, 'lng': lng})
    return jsonify(cities)


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({'status': 'ok', 'service': 'location-extraction'})


if __name__ == '__main__':
    print("=" * 60)
    print("  Location Extraction Service running at http://localhost:5002")
    print("=" * 60)
    print(f"  Loaded {len(INDIA_CITY_COORDS)} cities")
    from location_model import LOCATION_KEYWORDS
    print(f"  Loaded {len(LOCATION_KEYWORDS)} location keywords")
    print()
    print("  3-Step Cascade (same as TweetPulse India):")
    print("    1. User profile location field")
    print("    2. Post/tweet text content")
    print("    3. Hashtags -> user bio (fallback)")
    print()
    app.run(host='0.0.0.0', port=5002, debug=True)
