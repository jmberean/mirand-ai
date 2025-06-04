from flask import Flask, request, jsonify
from flask_cors import CORS
from utils import get_candidate_questions_with_ai, evaluate_answer_with_ai
import os
from dotenv import load_dotenv
load_dotenv()

app = Flask(__name__)
CORS(app) # Enable Cross-Origin Resource Sharing for development

interview_history = [] # Initialize an empty list to store the history (for this session)

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

    # We also need to return the evaluation to the frontend as before
    return jsonify({'evaluation': evaluation})

@app.route('/get_final_evaluation', methods=['POST'])
def get_final_evaluation():
    global interview_history # To access the session's history
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

    import openai
    openai_api_key = os.getenv("OPENAI_API_KEY")
    if not openai_api_key:
        return jsonify({'error': 'OpenAI API key not set'}), 500

    try:
        client = openai.OpenAI(api_key=openai_api_key)
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
        return jsonify({'error': 'Failed to get final evaluation'}), 500

if __name__ == '__main__':
    interview_history = [] # Re-initialize here for direct runs
    app.run(debug=True)