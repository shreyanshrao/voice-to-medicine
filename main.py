from flask import Flask, request, jsonify, render_template
import os
import datetime

app = Flask(__name__)
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_audio():
    audio_file = request.files['audio']
    filename = f"voice_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.mp3"
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    audio_file.save(filepath)

    print(f"✅ Audio saved to: {filepath}")
    return jsonify({"status": "saved", "filename": filename})

if __name__ == '__main__':
    app.run(debug=True)
