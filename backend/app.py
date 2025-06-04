from flask import Flask, request, jsonify
from flask_cors import CORS
from utils import get_candidate_questions_with_ai, evaluate_answer_with_ai
import os
from dotenv import load_dotenv
import requests # Import the requests library for making HTTP calls

load_dotenv()

app = Flask(__name__)
CORS(app) # Enable Cross-Origin Resource Sharing for development

interview_history = [] # Initialize an empty list to store the history (for this session)

# Load API keys from environment variables
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
PERPLEXITY_API_KEY = os.getenv("PERPLEXITY_API_KEY") # Still needed for utils.py
D_ID_API_KEY = os.getenv("D_ID_API_KEY")

# Basic validation for API keys
if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY environment variable not set.")
if not PERPLEXITY_API_KEY:
    raise RuntimeError("PERPLEXITY_API_KEY environment variable not set.")
if not D_ID_API_KEY:
    raise RuntimeError("D_ID_API_KEY environment variable not set.")

# =============================================================================
# Interview Specific Endpoints
# =============================================================================

@app.route('/get_questions', methods=['POST'])
def get_questions():
    data = request.get_json()
    job_title = data.get('job_title')
    company = data.get('company')
    if not job_title or not company:
        return jsonify({'error': 'Job title and company are required'}), 400

    questions = get_candidate_questions_with_ai(job_title, company)
    return jsonify({'questions': questions})

@app.route('/evaluate_answer', methods=['POST'])
def evaluate_answer():
    global interview_history # To access the session's history
    data = request.get_json()
    question = data.get('question')
    answer = data.get('answer')
    if not question or not answer:
        return jsonify({'error': 'Question and answer are required'}), 400

    evaluation = evaluate_answer_with_ai(question, answer)

    # Store this turn in the history
    interview_history.append({"question": question, "answer": answer, "feedback": evaluation})

    return jsonify({'evaluation': evaluation})

@app.route('/get_final_evaluation', methods=['POST'])
def get_final_evaluation():
    # interview_history is accessed directly from global scope for final evaluation
    # No need for global keyword if just reading, but if appending/modifying, it's good practice.
    if not interview_history:
        return jsonify({'error': 'No interview history available'}), 400

    # Prepare the prompt for OpenAI
    history_text = ""
    for item in interview_history:
        history_text += f"Question: {item['question']}\nAnswer: {item['answer']}\nFeedback: {item['feedback']}\n\n"

    prompt = f"""
Please provide a final evaluation of this mock interview based on the following interaction:

{history_text}

Consider the candidate's answers, the feedback given, and provide an overall assessment of their performance, including strengths and areas for improvement.
"""

    import openai # Import openai here as it's only used in this function and utils
    
    try:
        client = openai.OpenAI(api_key=OPENAI_API_KEY)
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=300,
        )
        final_evaluation = response.choices[0].message.content.strip()
        return jsonify({'final_evaluation': final_evaluation})
    except Exception as e:
        print(f"[Error] OpenAI API error (final evaluation): {e}")
        return jsonify({'error': 'Failed to get final evaluation from AI.'}), 500

# =============================================================================
# D-ID Proxy Endpoints
# =============================================================================

D_ID_HEADERS = {
    'Authorization': f'Basic {D_ID_API_KEY}',
    'Content-Type': 'application/json',
}

@app.route('/create_did_stream', methods=['POST'])
def create_did_stream():
    data = request.get_json()
    source_url = data.get('source_url', 'https://d-id-public-bucket.s3.us-west-2.amazonaws.com/alice.jpg')

    payload = {
        'source_url': source_url,
    }

    try:
        did_response = requests.post('https://api.d-id.com/talks/streams', json=payload, headers=D_ID_HEADERS)
        did_response.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)
        return jsonify(did_response.json())
    except requests.exceptions.RequestException as e:
        print(f"[Error] D-ID stream creation failed: {e}")
        return jsonify({'error': f'Failed to create D-ID stream: {str(e)}'}), 500

@app.route('/did_stream_ice', methods=['POST'])
def did_stream_ice():
    data = request.get_json()
    stream_id = data.get('stream_id')
    session_id = data.get('session_id')
    candidate = data.get('candidate')

    if not all([stream_id, session_id, candidate]):
        return jsonify({'error': 'Missing stream_id, session_id, or candidate'}), 400

    payload = {
        'session_id': session_id,
        'candidate': candidate,
    }

    try:
        did_response = requests.post(f'https://api.d-id.com/talks/streams/{stream_id}/ice', json=payload, headers=D_ID_HEADERS)
        did_response.raise_for_status()
        return jsonify(did_response.json())
    except requests.exceptions.RequestException as e:
        # Enhanced logging for ICE candidate errors
        print(f"[Error] D-ID ICE candidate failed: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"D-ID ICE candidate response status: {e.response.status_code}")
            print(f"D-ID ICE candidate response body: {e.response.text}")
        return jsonify({'error': f'Failed to send D-ID ICE candidate: {str(e)}'}), 500

@app.route('/did_stream_sdp', methods=['POST'])
def did_stream_sdp():
    data = request.get_json()
    stream_id = data.get('stream_id')
    session_id = data.get('session_id')
    answer = data.get('answer')

    if not all([stream_id, session_id, answer]):
        return jsonify({'error': 'Missing stream_id, session_id, or answer'}), 400

    payload = {
        'session_id': session_id,
        'answer': answer,
    }

    try:
        did_response = requests.post(f'https://api.d-id.com/talks/streams/{stream_id}/sdp', json=payload, headers=D_ID_HEADERS)
        did_response.raise_for_status()
        return jsonify(did_response.json())
    except requests.exceptions.RequestException as e:
        print(f"[Error] D-ID SDP failed: {e}")
        return jsonify({'error': f'Failed to send D-ID SDP: {str(e)}'}), 500

@app.route('/did_stream_talk', methods=['POST'])
def did_stream_talk():
    data = request.get_json()
    stream_id = data.get('stream_id')
    session_id = data.get('session_id')
    text = data.get('text') # The actual text to speak

    if not all([stream_id, session_id, text]):
        return jsonify({'error': 'Missing stream_id, session_id, or text'}), 400

    payload = {
        'session_id': session_id,
        'script': {
            'type': 'text',
            'input': text,
            'provider': {
                'type': 'microsoft', # Or 'amazon', 'google', etc.
                'voice_id': 'en-US-JennyNeural', # A common English voice
            },
        },
        # Removed 'driver_url' and 'mouth_open' as they are not expected for this endpoint
    }

    try:
        did_response = requests.post(f'https://api.d-id.com/talks/streams/{stream_id}', json=payload, headers=D_ID_HEADERS)
        did_response.raise_for_status()
        return jsonify(did_response.json())
    except requests.exceptions.RequestException as e:
        print(f"[Error] D-ID talk failed: {e}")
        return jsonify({'error': f'Failed to send text to D-ID: {str(e)}'}), 500

@app.route('/did_stream_stop', methods=['POST'])
def did_stream_stop():
    data = request.get_json()
    stream_id = data.get('stream_id')
    session_id = data.get('session_id')

    if not all([stream_id, session_id]):
        return jsonify({'error': 'Missing stream_id or session_id'}), 400

    payload = {
        'session_id': session_id
    }

    try:
        did_response = requests.post(f'https://api.d-id.com/talks/streams/{stream_id}/stop', json=payload, headers=D_ID_HEADERS)
        did_response.raise_for_status()
        return jsonify(did_response.json())
    except requests.exceptions.RequestException as e:
        print(f"[Error] D-ID stop failed: {e}")
        return jsonify({'error': f'Failed to stop D-ID talk: {str(e)}'}), 500

@app.route('/did_stream_destroy', methods=['POST'])
def did_stream_destroy():
    data = request.get_json()
    stream_id = data.get('stream_id')
    session_id = data.get('session_id')

    if not all([stream_id, session_id]):
        return jsonify({'error': 'Missing stream_id or session_id'}), 400

    payload = {
        'session_id': session_id
    }

    try:
        did_response = requests.delete(f'https://api.d-id.com/talks/streams/{stream_id}', json=payload, headers=D_ID_HEADERS)
        did_response.raise_for_status() # Delete returns 204 No Content on success
        return jsonify({'status': 'Stream destroyed'}), 200
    except requests.exceptions.RequestException as e:
        print(f"[Error] D-ID destroy failed: {e}")
        return jsonify({'error': f'Failed to destroy D-ID stream: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(debug=True)
