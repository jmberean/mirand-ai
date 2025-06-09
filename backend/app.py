from flask import Flask, request, jsonify
from flask_cors import CORS
from utils import get_candidate_questions_with_ai, evaluate_answer_with_ai
import os
from dotenv import load_dotenv
import requests
import json
import time
from datetime import datetime, timedelta
from collections import defaultdict
import openai

load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable Cross-Origin Resource Sharing for development

# Load API keys from environment variables
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
PERPLEXITY_API_KEY = os.getenv("PERPLEXITY_API_KEY")
D_ID_API_KEY = os.getenv("D_ID_API_KEY")

# Basic validation for API keys
if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY environment variable not set.")
if not PERPLEXITY_API_KEY:
    raise RuntimeError("PERPLEXITY_API_KEY environment variable not set.")
if not D_ID_API_KEY:
    raise RuntimeError("D_ID_API_KEY environment variable not set.")

# =============================================================================
# ENHANCED SESSION MANAGEMENT
# =============================================================================

class InterviewSession:
    def __init__(self):
        self.history = []
        self.start_time = datetime.now()
        self.question_types = []
        self.follow_up_count = 0
        self.user_performance = {
            'response_times': [],
            'question_depths': [],
            'strong_areas': [],
            'improvement_areas': []
        }
    
    def add_interaction(self, question, answer, feedback, metadata=None):
        interaction = {
            'question': question,
            'answer': answer,
            'feedback': feedback,
            'timestamp': datetime.now().isoformat(),
            'metadata': metadata or {}
        }
        self.history.append(interaction)
        
        # Track performance metrics
        if metadata:
            if 'response_time_seconds' in metadata:
                self.user_performance['response_times'].append(metadata['response_time_seconds'])
            if 'follow_up_depth' in metadata:
                self.user_performance['question_depths'].append(metadata['follow_up_depth'])

# Enhanced session storage with cleanup
active_sessions = {}
current_session = InterviewSession()  # Default session for backward compatibility

# Rate limiting
request_counts = defaultdict(list)

def rate_limit_check(client_ip, max_requests=20, window_minutes=1):
    """Simple rate limiting to prevent API abuse"""
    now = time.time()
    window_start = now - (window_minutes * 60)
    
    # Clean old requests
    request_counts[client_ip] = [req_time for req_time in request_counts[client_ip] 
                                if req_time > window_start]
    
    # Check limit
    if len(request_counts[client_ip]) >= max_requests:
        return False
    
    # Add current request
    request_counts[client_ip].append(now)
    return True

def cleanup_old_sessions():
    """Remove sessions older than 2 hours"""
    cutoff = datetime.now() - timedelta(hours=2)
    old_sessions = [sid for sid, session in active_sessions.items() 
                   if session.start_time < cutoff]
    for sid in old_sessions:
        del active_sessions[sid]

# =============================================================================
# INTERVIEW SPECIFIC ENDPOINTS
# =============================================================================

@app.route('/get_questions', methods=['POST'])
def get_questions():
    if not rate_limit_check(request.remote_addr):
        return jsonify({'error': 'Rate limit exceeded'}), 429
        
    data = request.get_json()
    job_title = data.get('job_title')
    company = data.get('company')
    if not job_title:
        return jsonify({'error': 'Job title is required'}), 400

    try:
        questions = get_candidate_questions_with_ai(job_title, company)
        if not questions:
            # Fallback questions if API fails
            questions = [
                f"Tell me about yourself and why you're interested in the {job_title} role.",
                f"What experience do you have that makes you a good fit for this {job_title} position?",
                "Describe a challenging project you've worked on and how you handled it.",
                "Where do you see yourself in 5 years?"
            ]
        return jsonify({'questions': questions})
    except Exception as e:
        print(f"[Error] Failed to get questions: {e}")
        return jsonify({'error': 'Failed to retrieve interview questions'}), 500

@app.route('/evaluate_answer', methods=['POST'])
def enhanced_evaluate_answer():
    global current_session
    
    if not rate_limit_check(request.remote_addr):
        return jsonify({'error': 'Rate limit exceeded'}), 429
    
    data = request.get_json()
    question = data.get('question')
    answer = data.get('answer')
    question_index = data.get('question_index', 0)
    follow_up_depth = data.get('follow_up_depth', 0)
    response_time = data.get('response_time_seconds')
    
    if not question or not answer:
        return jsonify({'error': 'Question and answer are required'}), 400

    try:
        # Enhanced evaluation with follow-up logic
        evaluation_result = evaluate_with_followup_logic(
            question, answer, question_index, follow_up_depth, response_time, current_session
        )
        
        # Store interaction in session
        metadata = {
            'question_index': question_index,
            'follow_up_depth': follow_up_depth,
            'response_time_seconds': response_time
        }
        
        current_session.add_interaction(
            question, answer, evaluation_result['evaluation'], metadata
        )
        
        return jsonify(evaluation_result)
        
    except Exception as e:
        print(f"[Error] Enhanced evaluation failed: {e}")
        return jsonify({
            'evaluation': 'Thank you for your response. Could you provide more specific details about your experience?',
            'needs_follow_up': True,
            'follow_up_question': 'Can you give me a specific example from your experience?',
            'reasoning': 'Fallback due to evaluation error'
        }), 200

def evaluate_with_followup_logic(question, answer, question_index, follow_up_depth, response_time, session):
    """Enhanced evaluation with intelligent follow-up decision making"""
    
    client = openai.OpenAI(api_key=OPENAI_API_KEY)
    
    # Build context from session history
    context = build_evaluation_context(session, question_index, follow_up_depth)
    
    # Enhanced prompt with follow-up logic
    prompt = f"""
You are an experienced interviewer conducting a mock interview. Analyze the candidate's response and provide feedback.

CONTEXT:
- Question #{question_index + 1}, Follow-up depth: {follow_up_depth}
- Response time: {response_time}s (if available)
- Previous interactions: {len(session.history)}

CURRENT INTERACTION:
Question: "{question}"
Candidate's Answer: "{answer}"

{context}

TASKS:
1. Evaluate the answer quality (1-2 sentences of constructive feedback)
2. Determine if a follow-up question would be valuable
3. If follow-up needed, suggest a specific follow-up question

FOLLOW-UP CRITERIA:
- Ask follow-up if answer lacks specific examples or details
- Ask follow-up if answer raises interesting points worth exploring
- Ask follow-up if answer seems incomplete or vague
- DON'T ask follow-up if answer is comprehensive and detailed
- DON'T ask follow-up if we're already at depth 2+ for this main question
- DON'T ask follow-up if similar ground was covered in previous questions

RESPONSE FORMAT:
{{
    "evaluation": "Your constructive feedback here",
    "needs_follow_up": true/false,
    "follow_up_question": "Specific follow-up question if needed",
    "reasoning": "Brief reason for follow-up decision"
}}

Respond only with valid JSON.
"""

    try:
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=400,
        )
        
        result_text = response.choices[0].message.content.strip()
        
        # Try to parse JSON response
        try:
            result = json.loads(result_text)
            
            # Validate required fields
            if 'evaluation' not in result:
                raise ValueError("Missing evaluation field")
                
            # Ensure boolean type for needs_follow_up
            result['needs_follow_up'] = bool(result.get('needs_follow_up', False))
            
            # Clean up follow_up_question if not needed
            if not result['needs_follow_up']:
                result['follow_up_question'] = None
                
            return result
            
        except json.JSONDecodeError:
            # Fallback: extract evaluation from text
            return {
                'evaluation': result_text,
                'needs_follow_up': False,
                'follow_up_question': None,
                'reasoning': 'JSON parsing failed, using text response'
            }
            
    except Exception as e:
        print(f"[Error] OpenAI evaluation failed: {e}")
        return {
            'evaluation': "Thank you for your response. I'd like to hear more about your experience with this topic.",
            'needs_follow_up': True,
            'follow_up_question': "Could you provide a specific example from your experience?",
            'reasoning': 'Fallback due to API error'
        }

def build_evaluation_context(session, current_question_index, current_depth):
    """Build context string from session history for better evaluation"""
    
    if len(session.history) == 0:
        return "This is the first interaction in the interview."
    
    context_parts = []
    
    # Add recent interactions summary
    recent_interactions = session.history[-3:]  # Last 3 interactions
    if recent_interactions:
        context_parts.append("RECENT INTERACTIONS:")
        for i, interaction in enumerate(recent_interactions, 1):
            context_parts.append(f"{i}. Q: {interaction['question'][:100]}...")
            context_parts.append(f"   A: {interaction['answer'][:100]}...")
    
    # Add performance insights
    if session.user_performance['response_times']:
        avg_response_time = sum(session.user_performance['response_times']) / len(session.user_performance['response_times'])
        context_parts.append(f"\nAVERAGE RESPONSE TIME: {avg_response_time:.1f}s")
    
    # Add question depth analysis
    depths = session.user_performance['question_depths']
    if depths:
        context_parts.append(f"FOLLOW-UP PATTERN: {depths} (current depth: {current_depth})")
    
    return "\n".join(context_parts)

@app.route('/get_final_evaluation', methods=['POST'])
def enhanced_final_evaluation():
    global current_session
    
    if not rate_limit_check(request.remote_addr):
        return jsonify({'error': 'Rate limit exceeded'}), 429
    
    data = request.get_json()
    total_duration = data.get('total_duration_minutes', 0)
    
    if len(current_session.history) == 0:
        return jsonify({'error': 'No interview history available'}), 400

    try:
        final_evaluation = generate_comprehensive_evaluation(current_session, total_duration)
        
        # Reset session for next interview
        current_session = InterviewSession()
        
        return jsonify({'final_evaluation': final_evaluation})
        
    except Exception as e:
        print(f"[Error] Final evaluation failed: {e}")
        return jsonify({
            'final_evaluation': 'Thank you for completing the mock interview. You demonstrated good communication skills and thoughtful responses. Continue practicing with specific examples and focus on structuring your answers clearly. Good luck with your upcoming interviews!'
        }), 200

def generate_comprehensive_evaluation(session, duration_minutes):
    """Generate comprehensive final evaluation based on entire session"""
    
    client = openai.OpenAI(api_key=OPENAI_API_KEY)
    
    # Prepare session summary
    session_summary = prepare_session_summary(session, duration_minutes)
    
    prompt = f"""
You are a senior interviewer providing final feedback for a mock interview session.

SESSION SUMMARY:
{session_summary}

PERFORMANCE ANALYSIS:
- Total questions answered: {len(session.history)}
- Interview duration: {duration_minutes} minutes
- Average response time: {calculate_avg_response_time(session):.1f}s
- Follow-up questions asked: {count_followups(session)}

Provide a comprehensive final evaluation including:

1. OVERALL PERFORMANCE (2-3 sentences)
   - General impression and interview readiness

2. KEY STRENGTHS (2-3 bullet points)
   - What the candidate did well
   - Strong responses or communication skills

3. AREAS FOR IMPROVEMENT (2-3 bullet points)
   - Specific areas to work on
   - Actionable suggestions

4. INTERVIEW READINESS SCORE (1-10 with brief justification)

5. NEXT STEPS (1-2 recommendations for further preparation)

Keep the tone constructive and encouraging while being specific and actionable.
"""

    try:
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=500,
        )
        
        return response.choices[0].message.content.strip()
        
    except Exception as e:
        print(f"[Error] Final evaluation generation failed: {e}")
        return "Thank you for completing the mock interview. You demonstrated good communication skills and thoughtful responses. Continue practicing with specific examples and focus on structuring your answers clearly. Good luck with your upcoming interviews!"

def prepare_session_summary(session, duration_minutes):
    """Prepare a concise summary of the interview session"""
    
    summary_parts = []
    
    for i, interaction in enumerate(session.history, 1):
        question_type = classify_question_type(interaction['question'])
        answer_length = len(interaction['answer'].split())
        
        summary_parts.append(f"""
Question {i} ({question_type}): {interaction['question'][:80]}...
Response ({answer_length} words): {interaction['answer'][:120]}...
Feedback: {interaction['feedback'][:100]}...
""")
    
    return "\n".join(summary_parts)

def classify_question_type(question):
    """Classify question type for better analysis"""
    question_lower = question.lower()
    
    behavioral_keywords = ['tell me about', 'describe a time', 'give me an example', 'how did you handle']
    technical_keywords = ['how would you', 'what is', 'explain', 'design', 'implement']
    culture_keywords = ['why do you want', 'what interests you', 'where do you see yourself']
    
    if any(keyword in question_lower for keyword in behavioral_keywords):
        return 'behavioral'
    elif any(keyword in question_lower for keyword in technical_keywords):
        return 'technical'
    elif any(keyword in question_lower for keyword in culture_keywords):
        return 'culture_fit'
    else:
        return 'general'

def calculate_avg_response_time(session):
    """Calculate average response time"""
    times = session.user_performance['response_times']
    return sum(times) / len(times) if times else 0

def count_followups(session):
    """Count total follow-up questions asked"""
    return len([h for h in session.history if h['metadata'].get('follow_up_depth', 0) > 0])

# =============================================================================
# SESSION MANAGEMENT ENDPOINTS
# =============================================================================

@app.route('/start_session', methods=['POST'])
def start_new_session():
    global current_session
    cleanup_old_sessions()
    current_session = InterviewSession()
    return jsonify({'status': 'New session started', 'session_id': id(current_session)})

@app.route('/session_status', methods=['GET'])
def get_session_status():
    global current_session
    return jsonify({
        'interactions_count': len(current_session.history),
        'start_time': current_session.start_time.isoformat(),
        'duration_minutes': (datetime.now() - current_session.start_time).total_seconds() / 60,
        'follow_ups_asked': count_followups(current_session)
    })

# =============================================================================
# D-ID PROXY ENDPOINTS
# =============================================================================

D_ID_HEADERS = {
    'Authorization': f'Basic {D_ID_API_KEY}',
    'Content-Type': 'application/json',
}

@app.route('/create_did_stream', methods=['POST'])
def create_did_stream():
    if not rate_limit_check(request.remote_addr, max_requests=5):
        return jsonify({'error': 'Rate limit exceeded for D-ID operations'}), 429
        
    data = request.get_json()
    source_url = data.get('source_url', 'https://d-id-public-bucket.s3.us-west-2.amazonaws.com/alice.jpg')

    payload = {
        'source_url': source_url,
    }

    try:
        did_response = requests.post('https://api.d-id.com/talks/streams', json=payload, headers=D_ID_HEADERS)
        did_response.raise_for_status()
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
        print(f"[Error] D-ID ICE candidate failed: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"D-ID ICE response status: {e.response.status_code}")
            print(f"D-ID ICE response body: {e.response.text}")
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
    if not rate_limit_check(request.remote_addr, max_requests=10):
        return jsonify({'error': 'Rate limit exceeded for speech requests'}), 429
        
    data = request.get_json()
    stream_id = data.get('stream_id')
    session_id = data.get('session_id')
    text = data.get('text')

    if not all([stream_id, session_id, text]):
        return jsonify({'error': 'Missing stream_id, session_id, or text'}), 400

    # Limit text length to prevent abuse
    if len(text) > 1000:
        return jsonify({'error': 'Text too long (max 1000 characters)'}), 400

    payload = {
        'session_id': session_id,
        'script': {
            'type': 'text',
            'input': text,
            'provider': {
                'type': 'microsoft',
                'voice_id': 'en-US-JennyNeural',
            },
        },
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
        did_response.raise_for_status()
        return jsonify({'status': 'Stream destroyed'}), 200
    except requests.exceptions.RequestException as e:
        print(f"[Error] D-ID destroy failed: {e}")
        return jsonify({'error': f'Failed to destroy D-ID stream: {str(e)}'}), 500

# =============================================================================
# HEALTH CHECK AND UTILITY ENDPOINTS
# =============================================================================

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'active_sessions': len(active_sessions),
        'version': '2.0.0'
    })

@app.route('/api_status', methods=['GET'])
def api_status():
    """Check the status of external APIs"""
    status = {
        'openai': bool(OPENAI_API_KEY),
        'perplexity': bool(PERPLEXITY_API_KEY),
        'd_id': bool(D_ID_API_KEY),
    }
    
    # Test OpenAI connection
    try:
        client = openai.OpenAI(api_key=OPENAI_API_KEY)
        response = client.models.list()
        status['openai_connection'] = True
    except Exception:
        status['openai_connection'] = False
    
    return jsonify(status)

if __name__ == '__main__':
    # Clean up old sessions on startup
    cleanup_old_sessions()
    print("🚀 Starting Enhanced AI Mock Interview Backend...")
    print(f"📊 API Keys loaded: OpenAI={bool(OPENAI_API_KEY)}, Perplexity={bool(PERPLEXITY_API_KEY)}, D-ID={bool(D_ID_API_KEY)}")
    app.run(debug=True)