from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from utils import get_candidate_questions_with_ai, evaluate_answer_with_ai, get_natural_followup
import os
from dotenv import load_dotenv
import requests
import json
import time

load_dotenv()

app = Flask(__name__)
CORS(app)

# Enhanced interview session storage (in production, use Redis or database)
interview_sessions = {}

# Load API keys from environment variables
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
PERPLEXITY_API_KEY = os.getenv("PERPLEXITY_API_KEY")
D_ID_API_KEY = os.getenv("D_ID_API_KEY")

# API key validation
if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY environment variable not set.")
if not PERPLEXITY_API_KEY:
    raise RuntimeError("PERPLEXITY_API_KEY environment variable not set.")
if not D_ID_API_KEY:
    raise RuntimeError("D_ID_API_KEY environment variable not set.")

# =============================================================================
# Enhanced Interview Endpoints for Natural Conversation
# =============================================================================

@app.route('/start_conversation_session', methods=['POST'])
def start_conversation_session():
    """Initialize a new conversation session with enhanced state tracking."""
    data = request.get_json()
    job_title = data.get('job_title')
    company = data.get('company', '')
    session_id = data.get('session_id', f"session_{int(time.time())}")
    
    if not job_title:
        return jsonify({'error': 'Job title is required'}), 400

    try:
        # Get interview questions
        questions = get_candidate_questions_with_ai(job_title, company)
        
        if not questions:
            return jsonify({'error': 'Could not generate interview questions'}), 500
        
        # Initialize session state
        interview_sessions[session_id] = {
            'job_title': job_title,
            'company': company,
            'questions': questions,
            'current_question_index': 0,
            'conversation_history': [],
            'start_time': time.time(),
            'is_active': True,
            'conversation_flow': 'introduction'  # introduction, questioning, feedback, conclusion
        }
        
        return jsonify({
            'session_id': session_id,
            'questions': questions,
            'current_question': questions[0] if questions else None,
            'total_questions': len(questions)
        })
        
    except Exception as e:
        print(f"[Error] Session start failed: {e}")
        return jsonify({'error': 'Failed to start conversation session'}), 500

@app.route('/process_natural_response', methods=['POST'])
def process_natural_response():
    """Process user response in natural conversation flow."""
    data = request.get_json()
    session_id = data.get('session_id')
    user_response = data.get('response', '').strip()
    response_type = data.get('type', 'answer')  # answer, interruption, clarification
    
    if not session_id or session_id not in interview_sessions:
        return jsonify({'error': 'Invalid session'}), 400
    
    if not user_response:
        return jsonify({'error': 'Empty response'}), 400
    
    session = interview_sessions[session_id]
    
    if not session['is_active']:
        return jsonify({'error': 'Session has ended'}), 400
    
    try:
        current_question = session['questions'][session['current_question_index']]
        
        # Enhanced answer evaluation with conversation context
        evaluation = evaluate_answer_with_ai(
            current_question, 
            user_response, 
            conversation_history=session['conversation_history']
        )
        
        # Store the interaction
        interaction = {
            'question': current_question,
            'answer': user_response,
            'feedback': evaluation,
            'timestamp': time.time(),
            'question_index': session['current_question_index']
        }
        session['conversation_history'].append(interaction)
        
        # Determine next action
        session['current_question_index'] += 1
        
        if session['current_question_index'] >= len(session['questions']):
            # Interview complete
            session['is_active'] = False
            session['conversation_flow'] = 'conclusion'
            
            # Get final evaluation
            final_evaluation = get_final_conversation_evaluation(session_id)
            
            return jsonify({
                'status': 'complete',
                'feedback': evaluation,
                'final_evaluation': final_evaluation,
                'next_action': 'conclude',
                'conversation_flow': 'conclusion'
            })
        else:
            # Continue to next question
            next_question = session['questions'][session['current_question_index']]
            session['conversation_flow'] = 'questioning'
            
            # Generate natural transition
            natural_transition = get_natural_followup(evaluation, next_question)
            
            return jsonify({
                'status': 'continue',
                'feedback': evaluation,
                'next_question': next_question,
                'natural_transition': natural_transition,
                'progress': {
                    'current': session['current_question_index'] + 1,
                    'total': len(session['questions'])
                },
                'conversation_flow': 'questioning'
            })
            
    except Exception as e:
        print(f"[Error] Response processing failed: {e}")
        return jsonify({'error': 'Failed to process response'}), 500

@app.route('/get_conversation_state', methods=['GET'])
def get_conversation_state():
    """Get current conversation state for a session."""
    session_id = request.args.get('session_id')
    
    if not session_id or session_id not in interview_sessions:
        return jsonify({'error': 'Invalid session'}), 400
    
    session = interview_sessions[session_id]
    
    return jsonify({
        'session_id': session_id,
        'is_active': session['is_active'],
        'conversation_flow': session['conversation_flow'],
        'current_question_index': session['current_question_index'],
        'total_questions': len(session['questions']),
        'current_question': session['questions'][session['current_question_index']] if session['current_question_index'] < len(session['questions']) else None,
        'conversation_history': session['conversation_history']
    })

def get_final_conversation_evaluation(session_id):
    """Generate final evaluation for the conversation."""
    if session_id not in interview_sessions:
        return "Session not found"
    
    session = interview_sessions[session_id]
    history = session['conversation_history']
    
    if not history:
        return "No conversation history available"
    
    # Prepare detailed history for final evaluation
    history_text = ""
    for i, interaction in enumerate(history, 1):
        history_text += f"Question {i}: {interaction['question']}\n"
        history_text += f"Answer: {interaction['answer']}\n"
        history_text += f"Feedback: {interaction['feedback']}\n\n"
    
    prompt = f"""
Please provide a comprehensive final evaluation of this natural conversation mock interview for a {session['job_title']} position{' at ' + session['company'] if session['company'] else ''}:

{history_text}

Provide an evaluation covering:
1. Overall communication skills and clarity
2. Technical competency demonstrated
3. Cultural fit and enthusiasm
4. Areas of strength
5. Areas for improvement
6. Overall recommendation and next steps

Keep the tone conversational and constructive, as this was a natural conversation interview.
"""

    try:
        import openai
        client = openai.OpenAI(api_key=OPENAI_API_KEY)
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=400,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"[Error] Final evaluation failed: {e}")
        return "Unable to generate final evaluation at this time."

# =============================================================================
# Legacy Interview Endpoints (for backward compatibility)
# =============================================================================

@app.route('/get_questions', methods=['POST'])
def get_questions():
    """Legacy endpoint - redirects to conversation session."""
    data = request.get_json()
    job_title = data.get('job_title')
    company = data.get('company')
    
    if not job_title or not company:
        return jsonify({'error': 'Job title and company are required'}), 400

    questions = get_candidate_questions_with_ai(job_title, company)
    return jsonify({'questions': questions})

@app.route('/evaluate_answer', methods=['POST'])
def evaluate_answer():
    """Legacy endpoint with enhanced evaluation."""
    data = request.get_json()
    question = data.get('question')
    answer = data.get('answer')
    
    if not question or not answer:
        return jsonify({'error': 'Question and answer are required'}), 400

    evaluation = evaluate_answer_with_ai(question, answer)
    return jsonify({'evaluation': evaluation})

@app.route('/get_final_evaluation', methods=['POST'])
def get_final_evaluation():
    """Legacy endpoint for final evaluation."""
    data = request.get_json()
    history = data.get('history', [])
    
    if not history:
        return jsonify({'error': 'No interview history available'}), 400

    # Convert to session format for compatibility
    session_id = f"temp_{int(time.time())}"
    interview_sessions[session_id] = {
        'job_title': 'Unknown Position',
        'company': '',
        'conversation_history': history,
        'is_active': False
    }
    
    final_evaluation = get_final_conversation_evaluation(session_id)
    
    # Clean up temporary session
    del interview_sessions[session_id]
    
    return jsonify({'final_evaluation': final_evaluation})

# =============================================================================
# Enhanced D-ID Streaming Endpoints
# =============================================================================

D_ID_HEADERS = {
    'Authorization': f'Basic {D_ID_API_KEY}',
    'Content-Type': 'application/json',
}

@app.route('/create_did_stream', methods=['POST'])
def create_did_stream():
    """Create D-ID stream with enhanced error handling."""
    data = request.get_json()
    source_url = data.get('source_url', 'https://d-id-public-bucket.s3.us-west-2.amazonaws.com/alice.jpg')

    payload = {
        'source_url': source_url,
        # Enhanced settings for natural conversation
        'config': {
            'stitch': True,  # Better video quality
            'mute': False,   # Ensure audio is enabled
        }
    }

    try:
        did_response = requests.post(
            'https://api.d-id.com/talks/streams', 
            json=payload, 
            headers=D_ID_HEADERS,
            timeout=30
        )
        did_response.raise_for_status()
        
        response_data = did_response.json()
        print(f"[Success] D-ID stream created: {response_data.get('id')}")
        
        return jsonify(response_data)
    except requests.exceptions.RequestException as e:
        print(f"[Error] D-ID stream creation failed: {e}")
        return jsonify({'error': f'Failed to create D-ID stream: {str(e)}'}), 500

@app.route('/did_stream_ice', methods=['POST'])
def did_stream_ice():
    """Handle ICE candidates with enhanced logging."""
    data = request.get_json()
    stream_id = data.get('stream_id')
    session_id = data.get('session_id')
    candidate = data.get('candidate')

    if not all([stream_id, session_id, candidate]):
        return jsonify({'error': 'Missing required parameters'}), 400

    payload = {
        'session_id': session_id,
        'candidate': candidate,
    }

    try:
        did_response = requests.post(
            f'https://api.d-id.com/talks/streams/{stream_id}/ice', 
            json=payload, 
            headers=D_ID_HEADERS,
            timeout=10
        )
        did_response.raise_for_status()
        return jsonify(did_response.json())
    except requests.exceptions.RequestException as e:
        print(f"[Error] D-ID ICE candidate failed: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"Response status: {e.response.status_code}")
            print(f"Response body: {e.response.text}")
        return jsonify({'error': f'ICE candidate failed: {str(e)}'}), 500

@app.route('/did_stream_sdp', methods=['POST'])
def did_stream_sdp():
    """Handle SDP exchange with timeout."""
    data = request.get_json()
    stream_id = data.get('stream_id')
    session_id = data.get('session_id')
    answer = data.get('answer')

    if not all([stream_id, session_id, answer]):
        return jsonify({'error': 'Missing required parameters'}), 400

    payload = {
        'session_id': session_id,
        'answer': answer,
    }

    try:
        did_response = requests.post(
            f'https://api.d-id.com/talks/streams/{stream_id}/sdp', 
            json=payload, 
            headers=D_ID_HEADERS,
            timeout=15
        )
        did_response.raise_for_status()
        return jsonify(did_response.json())
    except requests.exceptions.RequestException as e:
        print(f"[Error] D-ID SDP failed: {e}")
        return jsonify({'error': f'SDP exchange failed: {str(e)}'}), 500

# Add these fixes to your app.py did_stream_talk function

@app.route('/did_stream_talk', methods=['POST'])
def did_stream_talk():
    """Enhanced talk endpoint with better error handling."""
    data = request.get_json()
    stream_id = data.get('stream_id')
    session_id = data.get('session_id')
    text = data.get('text')

    if not all([stream_id, session_id, text]):
        return jsonify({'error': 'Missing required parameters'}), 400

    # LIMIT TEXT LENGTH - D-ID has limits
    if len(text) > 500:
        text = text[:500] + "..."
        print(f"[Warning] Text truncated to 500 characters")

    # Enhanced payload with simpler settings
    payload = {
        'session_id': session_id,
        'script': {
            'type': 'text',
            'input': text,
            'provider': {
                'type': 'microsoft',
                'voice_id': 'en-US-JennyNeural'
            }
        }
        # Remove complex config that might cause issues
    }

    try:
        print(f"[Info] Sending to D-ID: {text[:50]}...")
        print(f"[Info] Stream ID: {stream_id}")
        print(f"[Info] Session ID: {session_id}")
        
        did_response = requests.post(
            f'https://api.d-id.com/talks/streams/{stream_id}', 
            json=payload, 
            headers=D_ID_HEADERS,
            timeout=30  # Increased timeout
        )
        
        print(f"[Info] D-ID Response Status: {did_response.status_code}")
        print(f"[Info] D-ID Response Headers: {dict(did_response.headers)}")
        
        if not did_response.ok:
            error_text = did_response.text
            print(f"[Error] D-ID API Error: {error_text}")
            
            # Try to parse error details
            try:
                error_json = did_response.json()
                print(f"[Error] D-ID Error Details: {error_json}")
            except:
                print(f"[Error] Raw D-ID Error: {error_text}")
            
            return jsonify({
                'error': f'D-ID API Error: {did_response.status_code}',
                'details': error_text[:200]  # Limit error message
            }), 500
        
        response_data = did_response.json()
        print(f"[Success] D-ID Talk Success: {response_data}")
        return jsonify(response_data)
        
    except requests.exceptions.Timeout:
        print(f"[Error] D-ID API Timeout")
        return jsonify({'error': 'D-ID API timeout'}), 500
    except requests.exceptions.RequestException as e:
        print(f"[Error] D-ID Request Failed: {e}")
        return jsonify({'error': f'D-ID request failed: {str(e)}'}), 500
    except Exception as e:
        print(f"[Error] Unexpected error: {e}")
        return jsonify({'error': f'Unexpected error: {str(e)}'}), 500

@app.route('/did_stream_stop', methods=['POST'])
def did_stream_stop():
    """Stop D-ID stream with proper cleanup."""
    data = request.get_json()
    stream_id = data.get('stream_id')
    session_id = data.get('session_id')

    if not all([stream_id, session_id]):
        return jsonify({'error': 'Missing required parameters'}), 400

    payload = {'session_id': session_id}

    try:
        did_response = requests.post(
            f'https://api.d-id.com/talks/streams/{stream_id}/stop', 
            json=payload, 
            headers=D_ID_HEADERS,
            timeout=10
        )
        did_response.raise_for_status()
        return jsonify(did_response.json())
    except requests.exceptions.RequestException as e:
        print(f"[Error] D-ID stop failed: {e}")
        return jsonify({'error': f'Stop request failed: {str(e)}'}), 500

@app.route('/did_stream_destroy', methods=['POST'])
def did_stream_destroy():
    """Destroy D-ID stream with enhanced cleanup."""
    data = request.get_json()
    stream_id = data.get('stream_id')
    session_id = data.get('session_id')

    if not all([stream_id, session_id]):
        return jsonify({'error': 'Missing required parameters'}), 400

    payload = {'session_id': session_id}

    try:
        did_response = requests.delete(
            f'https://api.d-id.com/talks/streams/{stream_id}', 
            json=payload, 
            headers=D_ID_HEADERS,
            timeout=10
        )
        did_response.raise_for_status()
        
        print(f"[Success] D-ID stream destroyed: {stream_id}")
        return jsonify({'status': 'Stream destroyed successfully'}), 200
    except requests.exceptions.RequestException as e:
        print(f"[Error] D-ID destroy failed: {e}")
        return jsonify({'error': f'Destroy request failed: {str(e)}'}), 500

# =============================================================================
# Health and Status Endpoints
# =============================================================================

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'timestamp': time.time(),
        'active_sessions': len(interview_sessions),
        'services': {
            'openai': bool(OPENAI_API_KEY),
            'perplexity': bool(PERPLEXITY_API_KEY),
            'd_id': bool(D_ID_API_KEY)
        }
    })

@app.route('/cleanup_sessions', methods=['POST'])
def cleanup_sessions():
    """Clean up inactive sessions (call periodically)."""
    current_time = time.time()
    timeout = 3600  # 1 hour timeout
    
    inactive_sessions = [
        sid for sid, session in interview_sessions.items()
        if current_time - session.get('start_time', 0) > timeout
    ]
    
    for sid in inactive_sessions:
        del interview_sessions[sid]
    
    return jsonify({
        'cleaned_sessions': len(inactive_sessions),
        'active_sessions': len(interview_sessions)
    })

if __name__ == '__main__':
    print("🚀 Starting Enhanced AI Mock Interview Backend...")
    print(f"📊 OpenAI API: {'✅' if OPENAI_API_KEY else '❌'}")
    print(f"🔍 Perplexity API: {'✅' if PERPLEXITY_API_KEY else '❌'}")
    print(f"🎭 D-ID API: {'✅' if D_ID_API_KEY else '❌'}")
    app.run(debug=True, host='0.0.0.0', port=5000)