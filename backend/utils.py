import os
from openai import OpenAI

PERPLEXITY_API_KEY = os.getenv("PERPLEXITY_API_KEY")

if not PERPLEXITY_API_KEY:
    raise RuntimeError("Please set the PERPLEXITY_API_KEY environment variable.")

perplexity_client = OpenAI(api_key=PERPLEXITY_API_KEY, base_url="https://api.perplexity.ai")

def get_candidate_questions_with_ai(job_title, company, max_questions=3):
    """Fetches interview questions using the Perplexity API."""
    prompt = f"What are some likely interview questions for a {job_title} role at {company}? Please provide up to {max_questions} questions, covering technical, behavioral, and culture-fit aspects. Format each question starting with a hyphen."
    try:
        response = perplexity_client.chat.completions.create(
            model="sonar-pro", # Or another suitable Perplexity model
            messages=[{"role": "user", "content": prompt}]
        )
        answer = response.choices[0].message.content

        # Split by lines and filter for lines starting with '-'
        potential_questions = [line.strip().lstrip('-').strip() for line in answer.split('\n') if line.strip().startswith('-')]
        return potential_questions[:max_questions]
    except Exception as e:
        print(f"[Error] Perplexity API query failed: {e}")
        return []

def evaluate_answer_with_ai(question, answer):
    """Asks OpenAI to evaluate the user's answer and suggest a follow-up."""
    import openai
    openai_api_key = os.getenv("OPENAI_API_KEY")
    if not openai_api_key:
        print("[Warning] OPENAI_API_KEY not set. Evaluation will likely fail.")
        return "Error: OpenAI API key not set."
    try:
        client = openai.OpenAI(api_key=openai_api_key)
        prompt = f"""
You are an AI interviewer. The question was: "{question}".
The candidate's answer was: "{answer}".

Provide brief, constructive feedback (1-2 sentences).
Then, decide if a relevant follow-up question is needed. If so, start it with "Follow-up: ".
"""
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=150,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"[Error] OpenAI API error (evaluate answer): {e}")
        return "Error evaluating answer."

if __name__ == '__main__':
    # Example usage (for testing utils)
    job_title = "Senior Data Scientist"
    company = "Netflix"
    questions = get_candidate_questions_with_ai(job_title, company)
    if questions:
        print(f"\nPotential Interview Questions (from Perplexity AI):")
        for i, q in enumerate(questions):
            print(f"{i+1}. {q}")
        if questions:
            first_question = questions[0]
            test_answer = "In my previous role..."
            evaluation = evaluate_answer_with_ai(first_question, test_answer)
            print(f"\nEvaluation of '{test_answer}' for '{first_question}':\n{evaluation}")
    else:
        print("No interview questions found.")