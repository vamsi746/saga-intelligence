from flask import Flask, request, jsonify, send_file
from pytubefix import YouTube
import re
import tempfile
import os
from .clean_downloads import clean_downloads_folder

app = Flask(__name__)

@app.route('/download-direct/<resolution>', methods=['POST'])
def download_direct_by_resolution(resolution):
    data = request.get_json()
    url = data.get('url')

    if not url:
        return jsonify({"error": "Missing 'url' parameter in the request body."}), 400

    pattern = r"^(https?://)?(www\.)?youtube\.com/watch\?v=[\w-]+(&\S*)?$"
    clean_downloads_folder("./temp/downloads")
    if not re.match(pattern, url):
        return jsonify({"error": "Invalid YouTube URL."}), 400

    try:
        yt = YouTube(url)
        stream = yt.streams.filter(progressive=True, file_extension='mp4', resolution=resolution).first()
        if not stream:
            return jsonify({"error": "Video with the specified resolution not found."}), 404
        with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as tmp_file:
            temp_path = tmp_file.name
        stream.download(output_path=os.path.dirname(temp_path), filename=os.path.basename(temp_path))
        response = send_file(temp_path, as_attachment=True, download_name=f"{yt.title}.mp4")
        @response.call_on_close
        def cleanup():
            try:
                os.remove(temp_path)
                print(f"Deleted temp file: {temp_path}")
            except Exception as e:
                print(f"Error deleting temp file {temp_path}: {e}")
        return response
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/video_info', methods=['POST'])
def video_info():
    data = request.get_json()
    url = data.get('url')
    
    if not url:
        return jsonify({"error": "Missing 'url' parameter in the request body."}), 400

    if not is_valid_youtube_url(url):
        return jsonify({"error": "Invalid YouTube URL."}), 400
    
    video_info, error_message = get_video_info(url)
    
    if video_info:
        return jsonify(video_info), 200
    else:
        return jsonify({"error": error_message}), 500


@app.route('/available_resolutions', methods=['POST'])
def available_resolutions():
    data = request.get_json()
    url = data.get('url')
    
    if not url:
        return jsonify({"error": "Missing 'url' parameter in the request body."}), 400

    if not is_valid_youtube_url(url):
        return jsonify({"error": "Invalid YouTube URL."}), 400
    
    try:
        yt = YouTube(url)
        progressive_resolutions = list(set([
            stream.resolution 
            for stream in yt.streams.filter(progressive=True, file_extension='mp4')
            if stream.resolution
        ]))
        all_resolutions = list(set([
            stream.resolution 
            for stream in yt.streams.filter(file_extension='mp4')
            if stream.resolution
        ]))
        return jsonify({
            "progressive": sorted(progressive_resolutions),
            "all": sorted(all_resolutions)
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500