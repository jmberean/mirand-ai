import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

PERPLEXITY_API_KEY = os.getenv("PERPLEXITY_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not PERPLEXITY_API_KEY:
    raise RuntimeError("Please set the PERPLEXITY_API_KEY environment variable.")
if not OPENAI_API_KEY:
    raise RuntimeError("Please set the OPENAI_API_KEY environment variable.")

perplexity_client = OpenAI(api_key=PERPLEXITY_API_KEY, base_url="https://api.perplexity.ai")
openai_client = OpenAI(api_key=OPENAI_API_KEY)

def get_candidate_questions_with_ai(job_title, company='', max_questions=3):
    """Fetches interview questions using the Perplexity API."""
    company_context = f" at {company}" if company else ""
    
    prompt = f"What are some likely interview questions for a {job_title} role{company_context}? Please provide up to {max_questions} questions, covering technical, behavioral, and culture-fit aspects. Format each question starting with a hyphen."
    
    try:
        response = perplexity_client.chat.completions.create(
            model="sonar-pro",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=500
        )
        answer = response.choices[0].message.content

        # Split by lines and filter for lines starting with '-'
        potential_questions = []
        for line in answer.split('\n'):
            line = line.strip()
            if line.startswith('-'):
                question = line.lstrip('-').strip()
                if question and len(question) > 10:
                    potential_questions.append(question)
        
        return potential_questions[:max_questions] if potential_questions else get_fallback_questions(job_title, max_questions)
        
    except Exception as e:
        print(f"[Error] Perplexity API query failed: {e}")
        return get_fallback_questions(job_title, max_questions)

def get_fallback_questions(job_title, max_questions=3):
    """Provide fallback questions when API fails."""
    fallback_questions = {
        "software engineer": [
            "Tell me about a challenging technical problem you've solved recently.",
            "How do you approach debugging a complex issue?",
            "Describe a time when you had to collaborate with a difficult team member."
        ],
        "data scientist": [
            "Walk me through a data science project you're proud of.",
            "How do you handle missing or inconsistent data?",
            "Describe how you explain technical findings to non-technical stakeholders."
        ],
        "product manager": [
            "Tell me about a product feature that didn't go as planned.",
            "How do you prioritize features with limited resources?",
            "Describe a time when you made a decision with incomplete information."
        ]
    }
    
    # Try to find questions for the specific role
    role_key = job_title.lower()
    for key in fallback_questions:
        if key in role_key:
            return fallback_questions[key][:max_questions]
    
    # Generic fallback questions
    generic_questions = [
        "Tell me about yourself and what interests you about this role.",
        "Describe a challenging situation you faced at work and how you handled it.",
        "What are your greatest strengths and how do they apply to this position?"
    ]
    
    return generic_questions[:max_questions]

def evaluate_answer_with_ai(question, answer):
    """Asks OpenAI to evaluate the user's answer and suggest a follow-up."""
    try:
        prompt = f"""
You are an AI interviewer. The question was: "{question}".
The candidate's answer was: "{answer}".

Provide brief, constructive feedback (1-2 sentences).
Then, decide if a relevant follow-up question is needed. If so, start it with "Follow-up: ".
"""
        response = openai_client.chat.completions.create(
            model="gpt-4",  # Fixed model name
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=150,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"[Error] OpenAI API error (evaluate answer): {e}")
        return "Thank you for that response. Let's continue with the next question."

if __name__ == '__main__':
    # Test the functions
    job_title = "Senior Software Engineer"
    company = "Netflix"
    
    print(f"Testing question generation for {job_title} at {company}:")
    questions = get_candidate_questions_with_ai(job_title, company)
    
    for i, q in enumerate(questions, 1):
        print(f"{i}. {q}")
    
    if questions:
        print(f"\n🔍 Testing answer evaluation:")
        test_question = questions[0]
        test_answer = "In my previous role, I solved a complex distributed systems issue..."
        
        evaluation = evaluate_answer_with_ai(test_question, test_answer)
        print(f"Question: {test_question}")
        print(f"Answer: {test_answer}")
        print(f"Evaluation: {evaluation}")
    
    print("\n✅ Testing complete!")