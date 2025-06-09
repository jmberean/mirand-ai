import os
from openai import OpenAI
from dotenv import load_dotenv
import time
import random

load_dotenv()

# API Keys
PERPLEXITY_API_KEY = os.getenv("PERPLEXITY_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not PERPLEXITY_API_KEY:
    raise RuntimeError("Please set the PERPLEXITY_API_KEY environment variable.")

if not OPENAI_API_KEY:
    raise RuntimeError("Please set the OPENAI_API_KEY environment variable.")

# Initialize clients
perplexity_client = OpenAI(api_key=PERPLEXITY_API_KEY, base_url="https://api.perplexity.ai")
openai_client = OpenAI(api_key=OPENAI_API_KEY)

# Fallback questions by category
FALLBACK_QUESTIONS = {
    'general': [
        "Tell me about yourself and your background.",
        "Why are you interested in this role?",
        "What are your greatest strengths?",
        "Describe a challenging situation you've faced and how you handled it.",
        "Where do you see yourself in 5 years?"
    ],
    'technical': [
        "Walk me through your approach to solving a complex technical problem.",
        "How do you stay updated with the latest technologies in your field?",
        "Describe a project you're particularly proud of.",
        "How do you handle debugging and troubleshooting?",
        "What's your experience with [relevant technology/framework]?"
    ],
    'behavioral': [
        "Tell me about a time when you had to work with a difficult team member.",
        "Describe a situation where you had to meet a tight deadline.",
        "Give me an example of when you went above and beyond in your role.",
        "How do you handle constructive criticism?",
        "Tell me about a time when you failed and what you learned from it."
    ],
    'leadership': [
        "Describe your leadership style.",
        "Tell me about a time when you had to motivate a team.",
        "How do you handle conflicts within your team?",
        "Give me an example of when you had to make a difficult decision.",
        "How do you prioritize tasks and manage your time?"
    ]
}

def get_candidate_questions_with_ai(job_title, company, max_questions=4):
    """
    Fetches interview questions using the Perplexity API with enhanced fallback logic.
    """
    # Clean inputs
    job_title = job_title.strip() if job_title else ""
    company = company.strip() if company else ""
    
    if not job_title:
        print("[Warning] No job title provided, using general questions")
        return get_fallback_questions('general', max_questions)
    
    # Construct enhanced prompt
    company_part = f" at {company}" if company else ""
    prompt = f"""
Generate {max_questions} specific interview questions for a {job_title} position{company_part}.

Requirements:
- Mix of behavioral, technical, and situational questions
- Questions should be relevant to the {job_title} role
- Include at least one technical/skills-based question
- Include at least one behavioral question
- Make questions specific and actionable
- Format each question starting with a hyphen (-)

Focus on questions that would realistically be asked in an interview for this role.
"""

    try:
        print(f"[Info] Requesting questions for {job_title}{company_part} from Perplexity...")
        
        response = perplexity_client.chat.completions.create(
            model="sonar-pro",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=500
        )
        
        answer = response.choices[0].message.content
        print(f"[Info] Received response from Perplexity: {len(answer)} characters")
        
        # Enhanced parsing to extract questions
        questions = parse_questions_from_response(answer)
        
        if questions and len(questions) >= 2:
            # Ensure we have a good mix of question types
            questions = ensure_question_diversity(questions, job_title)
            print(f"[Success] Extracted {len(questions)} questions from Perplexity")
            return questions[:max_questions]
        else:
            print("[Warning] Insufficient questions from Perplexity, using fallbacks")
            return get_fallback_questions_for_role(job_title, max_questions)
            
    except Exception as e:
        print(f"[Error] Perplexity API query failed: {e}")
        return get_fallback_questions_for_role(job_title, max_questions)

def parse_questions_from_response(response_text):
    """
    Enhanced parsing to extract questions from AI response.
    """
    questions = []
    lines = response_text.split('\n')
    
    for line in lines:
        line = line.strip()
        
        # Look for lines starting with common question indicators
        question_indicators = ['-', '•', '*', '1.', '2.', '3.', '4.', '5.']
        
        if any(line.startswith(indicator) for indicator in question_indicators):
            # Clean the question
            question = line
            for indicator in question_indicators:
                if question.startswith(indicator):
                    question = question[len(indicator):].strip()
                    break
            
            # Ensure it ends with a question mark
            if question and not question.endswith('?'):
                question += '?'
            
            # Filter out very short or non-question lines
            if len(question) > 10 and ('?' in question or 'tell' in question.lower() or 'describe' in question.lower() or 'how' in question.lower() or 'what' in question.lower() or 'why' in question.lower()):
                questions.append(question)
    
    return questions

def ensure_question_diversity(questions, job_title):
    """
    Ensure we have a good mix of behavioral and technical questions.
    """
    if len(questions) < 3:
        return questions
    
    # Categorize existing questions
    behavioral_keywords = ['tell me about', 'describe a time', 'give me an example', 'how did you handle']
    technical_keywords = ['how would you', 'what is', 'explain', 'design', 'implement', 'technical', 'code', 'system']
    
    has_behavioral = any(any(keyword in q.lower() for keyword in behavioral_keywords) for q in questions)
    has_technical = any(any(keyword in q.lower() for keyword in technical_keywords) for q in questions)
    
    # Add missing question types if needed
    if not has_behavioral and len(questions) < 4:
        behavioral_q = get_fallback_questions('behavioral', 1)[0]
        questions.append(behavioral_q)
    
    if not has_technical and 'engineer' in job_title.lower() and len(questions) < 4:
        technical_q = get_fallback_questions('technical', 1)[0]
        questions.append(technical_q)
    
    return questions

def get_fallback_questions_for_role(job_title, max_questions):
    """
    Get role-specific fallback questions based on job title.
    """
    job_title_lower = job_title.lower()
    
    # Determine question categories based on role
    if any(keyword in job_title_lower for keyword in ['engineer', 'developer', 'programmer', 'architect']):
        categories = ['technical', 'behavioral', 'general']
    elif any(keyword in job_title_lower for keyword in ['manager', 'lead', 'director', 'supervisor']):
        categories = ['leadership', 'behavioral', 'general']
    elif any(keyword in job_title_lower for keyword in ['analyst', 'scientist', 'researcher']):
        categories = ['technical', 'behavioral', 'general']
    else:
        categories = ['general', 'behavioral']
    
    # Mix questions from different categories
    questions = []
    questions_per_category = max_questions // len(categories)
    remainder = max_questions % len(categories)
    
    for i, category in enumerate(categories):
        count = questions_per_category + (1 if i < remainder else 0)
        questions.extend(get_fallback_questions(category, count))
    
    # Customize the first question to be role-specific
    if questions:
        questions[0] = f"Tell me about yourself and why you're interested in the {job_title} role."
    
    return questions[:max_questions]

def get_fallback_questions(category, count):
    """
    Get fallback questions from a specific category.
    """
    if category not in FALLBACK_QUESTIONS:
        category = 'general'
    
    available_questions = FALLBACK_QUESTIONS[category].copy()
    random.shuffle(available_questions)
    
    return available_questions[:count] if count <= len(available_questions) else available_questions

def evaluate_answer_with_ai(question, answer):
    """
    Enhanced answer evaluation using OpenAI with better prompting.
    """
    if not question or not answer:
        return "Please provide both a question and an answer for evaluation."
    
    # Enhanced prompt for better evaluation
    prompt = f"""
You are an experienced interviewer providing constructive feedback on a candidate's response.

QUESTION: "{question}"
CANDIDATE'S ANSWER: "{answer}"

Please provide:
1. Brief constructive feedback (1-2 sentences) focusing on:
   - Clarity and structure of the response
   - Specific examples and details provided
   - Relevance to the question asked

2. If appropriate, suggest ONE follow-up question to dive deeper into their response.

Keep feedback encouraging but honest. Focus on actionable improvements.

Format your response as feedback first, then if you have a follow-up question, start it with "Follow-up: "
"""

    try:
        response = openai_client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=200,
        )
        
        evaluation = response.choices[0].message.content.strip()
        
        # Add some variety to avoid repetitive feedback
        if len(evaluation) < 50:  # If response is too short, add encouragement
            evaluation += " Keep providing specific examples to strengthen your responses."
        
        return evaluation
        
    except Exception as e:
        print(f"[Error] OpenAI API error (evaluate answer): {e}")
        return generate_fallback_evaluation(question, answer)

def generate_fallback_evaluation(question, answer):
    """
    Generate fallback evaluation when AI is unavailable.
    """
    # Simple heuristic-based evaluation
    word_count = len(answer.split())
    
    if word_count < 20:
        return "Your answer is quite brief. Try to provide more specific details and examples to give a fuller picture of your experience. Consider using the STAR method (Situation, Task, Action, Result) for behavioral questions."
    elif word_count > 200:
        return "You provided a comprehensive answer with good detail. Make sure to stay focused on the key points that directly answer the question. Consider organizing your response with clear main points."
    else:
        return "Good response with appropriate detail. To strengthen your answer further, consider adding a specific example or outcome that demonstrates your skills. This helps the interviewer better understand your capabilities."

def test_api_connections():
    """
    Test both API connections and return status.
    """
    status = {
        'perplexity': False,
        'openai': False,
        'errors': []
    }
    
    # Test Perplexity
    try:
        response = perplexity_client.chat.completions.create(
            model="sonar-pro",
            messages=[{"role": "user", "content": "Test connection"}],
            max_tokens=10
        )
        status['perplexity'] = True
        print("[Success] Perplexity API connection working")
    except Exception as e:
        status['errors'].append(f"Perplexity: {str(e)}")
        print(f"[Error] Perplexity API connection failed: {e}")
    
    # Test OpenAI
    try:
        response = openai_client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": "Test connection"}],
            max_tokens=10
        )
        status['openai'] = True
        print("[Success] OpenAI API connection working")
    except Exception as e:
        status['errors'].append(f"OpenAI: {str(e)}")
        print(f"[Error] OpenAI API connection failed: {e}")
    
    return status

if __name__ == '__main__':
    # Test the utilities
    print("🧪 Testing AI Mock Interview Utilities...")
    
    # Test API connections
    api_status = test_api_connections()
    print(f"API Status: {api_status}")
    
    # Test question generation
    print("\n📝 Testing Question Generation...")
    job_title = "Senior Data Scientist"
    company = "Netflix"
    
    questions = get_candidate_questions_with_ai(job_title, company)
    print(f"\n✅ Generated {len(questions)} questions for {job_title} at {company}:")
    for i, q in enumerate(questions, 1):
        print(f"{i}. {q}")
    
    # Test answer evaluation
    if questions:
        print(f"\n🔍 Testing Answer Evaluation...")
        test_question = questions[0]
        test_answer = "In my previous role at a tech startup, I led a team of 3 data scientists to develop a recommendation engine that increased user engagement by 25%. I used Python, machine learning algorithms, and worked closely with the product team to understand requirements."
        
        evaluation = evaluate_answer_with_ai(test_question, test_answer)
        print(f"\nQuestion: {test_question}")
        print(f"Test Answer: {test_answer}")
        print(f"Evaluation: {evaluation}")
    
    print("\n✅ Utility testing complete!")