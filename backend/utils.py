import os
from openai import OpenAI
from dotenv import load_dotenv
import re

load_dotenv()

PERPLEXITY_API_KEY = os.getenv("PERPLEXITY_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not PERPLEXITY_API_KEY:
    raise RuntimeError("Please set the PERPLEXITY_API_KEY environment variable.")

if not OPENAI_API_KEY:
    raise RuntimeError("Please set the OPENAI_API_KEY environment variable.")

perplexity_client = OpenAI(api_key=PERPLEXITY_API_KEY, base_url="https://api.perplexity.ai")
openai_client = OpenAI(api_key=OPENAI_API_KEY)

def get_candidate_questions_with_ai(job_title, company, max_questions=4):
    """
    Fetches interview questions using Perplexity API, optimized for natural conversation flow.
    Returns questions that build upon each other and allow for natural follow-ups.
    """
    company_context = f" at {company}" if company else ""
    
    prompt = f"""Generate exactly {max_questions} interview questions for a {job_title} position{company_context} that are designed for a natural conversation flow. 

Requirements:
- Questions should build upon each other naturally
- Mix of behavioral, technical, and situational questions
- Avoid yes/no questions - focus on open-ended questions that encourage detailed responses
- Questions should feel conversational, not robotic
- Each question should allow for natural follow-up discussions

Format each question with a hyphen (-) at the start. Make them sound like a human interviewer would ask them in a real conversation."""

    try:
        response = perplexity_client.chat.completions.create(
            model="sonar-pro",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=500
        )
        answer = response.choices[0].message.content

        # Extract questions that start with hyphens
        potential_questions = []
        for line in answer.split('\n'):
            line = line.strip()
            if line.startswith('-'):
                # Clean up the question
                question = line.lstrip('-').strip()
                # Remove numbering if present
                question = re.sub(r'^\d+\.?\s*', '', question)
                if question and len(question) > 10:  # Ensure it's a substantial question
                    potential_questions.append(question)
        
        # Return exactly the requested number of questions
        return potential_questions[:max_questions] if potential_questions else []
        
    except Exception as e:
        print(f"[Error] Perplexity API query failed: {e}")
        # Fallback questions for common roles
        return get_fallback_questions(job_title, max_questions)

def get_fallback_questions(job_title, max_questions=4):
    """Provide fallback questions when API fails."""
    fallback_questions = {
        "software engineer": [
            "Tell me about a challenging technical problem you've solved recently and walk me through your approach.",
            "How do you typically approach debugging a complex issue that you've never encountered before?",
            "Describe a time when you had to collaborate with a difficult team member on a project.",
            "What's a technology or framework you've been excited to learn recently, and why did it interest you?"
        ],
        "data scientist": [
            "Walk me through a data science project you're particularly proud of, from problem definition to implementation.",
            "How do you handle missing or inconsistent data in your analysis?",
            "Describe a time when your analysis led to a significant business decision or change.",
            "What's your approach to explaining complex technical findings to non-technical stakeholders?"
        ],
        "product manager": [
            "Tell me about a product feature you championed that didn't go as planned. What did you learn?",
            "How do you prioritize features when you have limited development resources and competing stakeholder needs?",
            "Describe a time when you had to make a product decision with incomplete information.",
            "Walk me through how you would approach launching a product in a new market segment."
        ],
        "marketing manager": [
            "Describe a marketing campaign you led that exceeded expectations. What made it successful?",
            "How do you approach measuring the ROI of marketing initiatives that don't directly lead to sales?",
            "Tell me about a time when a marketing strategy you implemented didn't work out as planned.",
            "How do you stay current with marketing trends and adapt your strategies accordingly?"
        ]
    }
    
    # Try to find questions for the specific role or use generic ones
    role_key = job_title.lower()
    for key in fallback_questions:
        if key in role_key:
            return fallback_questions[key][:max_questions]
    
    # Generic fallback questions
    generic_questions = [
        "Tell me about yourself and what interests you about this role.",
        "Describe a challenging situation you faced at work and how you handled it.",
        "What are your greatest strengths and how do they apply to this position?",
        "Where do you see yourself professionally in the next few years?"
    ]
    
    return generic_questions[:max_questions]

def evaluate_answer_with_ai(question, answer, conversation_history=None):
    """
    Enhanced answer evaluation that considers conversation context and provides natural feedback.
    Designed for natural conversation flow rather than formal interview scoring.
    """
    try:
        # Build context from conversation history if available
        context = ""
        if conversation_history:
            recent_interactions = conversation_history[-2:]  # Last 2 interactions for context
            context = "\n\nConversation context:\n"
            for i, interaction in enumerate(recent_interactions, 1):
                context += f"Previous Q{i}: {interaction['question']}\n"
                context += f"Previous A{i}: {interaction['answer']}\n"
        
        prompt = f"""You are an experienced interviewer having a natural conversation with a candidate. 

Current question: "{question}"
Candidate's response: "{answer}"{context}

Provide conversational feedback that:
1. Acknowledges what they said well (be specific)
2. Offers 1-2 constructive insights for improvement if needed
3. Sounds natural and encouraging, like a real interviewer would speak
4. Is 2-3 sentences maximum
5. Flows naturally into the next part of the conversation

Avoid:
- Formal scoring or ratings
- Robotic language
- Overly long feedback
- Harsh criticism

Example tone: "That's a great example of problem-solving under pressure. I particularly liked how you broke down the technical challenge into manageable steps. One thing that could strengthen your approach is considering how you might communicate progress to stakeholders during long debugging sessions."
"""

        response = openai_client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=150,
        )
        
        feedback = response.choices[0].message.content.strip()
        
        # Ensure feedback sounds natural and conversational
        if not feedback.endswith(('.', '!', '?')):
            feedback += '.'
            
        return feedback
        
    except Exception as e:
        print(f"[Error] OpenAI API error (evaluate answer): {e}")
        return "Thank you for sharing that example. Let's continue to the next question."

def get_natural_followup(feedback, next_question):
    """
    Generate natural transition between feedback and next question to maintain conversation flow.
    """
    try:
        prompt = f"""Create a natural, conversational transition that:
1. Briefly acknowledges the previous feedback: "{feedback}"
2. Smoothly introduces the next question: "{next_question}"
3. Sounds like a real interviewer speaking naturally
4. Is 1-2 sentences maximum
5. Maintains positive, engaging tone

Example transitions:
- "Thanks for that insight. Now I'd like to shift gears a bit and ask about..."
- "That's really helpful context. Building on that, I'm curious about..."
- "Great example. Let's explore a different aspect - ..."

Create a smooth transition:"""

        response = openai_client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.8,
            max_tokens=80,
        )
        
        transition = response.choices[0].message.content.strip()
        
        # Combine feedback, transition, and next question into natural flow
        natural_response = f"{feedback} {transition} {next_question}"
        
        return natural_response
        
    except Exception as e:
        print(f"[Error] Natural followup generation failed: {e}")
        # Fallback to simple concatenation
        return f"{feedback} Great! Now let's move on to the next question: {next_question}"

def generate_conversation_opener(job_title, company, candidate_name=None):
    """
    Generate a natural conversation opener for the interview.
    """
    try:
        name_part = f" {candidate_name}" if candidate_name else ""
        company_part = f" at {company}" if company else ""
        
        prompt = f"""Create a warm, natural interview opening for a {job_title} position{company_part}. 

The opening should:
- Be conversational and welcoming
- Set expectations for a natural conversation format
- Be enthusiastic but professional
- Be 2-3 sentences maximum
- Sound like a real person, not a script

Candidate name{name_part if candidate_name else ": Not provided"}

Example tone: "Hi Sarah! I'm really excited to chat with you today about the Software Engineer role at TechCorp. I'm looking forward to having a natural conversation about your experience and learning more about what drives you as a developer."
"""

        response = openai_client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.8,
            max_tokens=100,
        )
        
        return response.choices[0].message.content.strip()
        
    except Exception as e:
        print(f"[Error] Conversation opener generation failed: {e}")
        return f"Hello{name_part}! I'm excited to speak with you today about the {job_title} position{company_part}. Let's have a natural conversation about your experience and aspirations."

def generate_interview_conclusion(conversation_history, job_title, company):
    """
    Generate a natural conclusion for the interview based on the conversation.
    """
    try:
        # Summarize key points from conversation
        conversation_summary = ""
        if conversation_history:
            for i, interaction in enumerate(conversation_history[-3:], 1):  # Last 3 interactions
                conversation_summary += f"Topic {i}: {interaction['question'][:50]}...\n"
        
        company_part = f" at {company}" if company else ""
        
        prompt = f"""Create a natural, warm conclusion for an interview conversation about a {job_title} position{company_part}.

Conversation covered these topics:
{conversation_summary}

The conclusion should:
- Thank the candidate warmly
- Acknowledge the conversation naturally
- Provide next steps information
- Be encouraging and professional
- Be 2-3 sentences maximum
- Sound conversational, not scripted

Example tone: "Thank you so much for the great conversation today! I really enjoyed learning about your experience with machine learning projects and your approach to team collaboration. We'll be in touch within the next few days about next steps."
"""

        response = openai_client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=120,
        )
        
        return response.choices[0].message.content.strip()
        
    except Exception as e:
        print(f"[Error] Interview conclusion generation failed: {e}")
        return f"Thank you for the wonderful conversation today! I really enjoyed learning about your experience and passion for the {job_title} role{company_part}. We'll be in touch soon with next steps."

def detect_conversation_intent(user_input):
    """
    Detect the intent of user input in natural conversation context.
    Returns: 'answer', 'clarification', 'question', 'interruption', 'off_topic'
    """
    user_input_lower = user_input.lower().strip()
    
    # Clarification requests
    clarification_phrases = [
        "could you repeat", "can you clarify", "what do you mean", 
        "i don't understand", "could you explain", "can you rephrase"
    ]
    
    # Questions back to interviewer
    question_phrases = [
        "can you tell me", "what about", "how does", "what's the", "can i ask"
    ]
    
    # Check for clarification
    if any(phrase in user_input_lower for phrase in clarification_phrases):
        return 'clarification'
    
    # Check for questions
    if any(phrase in user_input_lower for phrase in question_phrases) or user_input.strip().endswith('?'):
        return 'question'
    
    # Check for very short responses that might need follow-up
    if len(user_input.split()) < 3:
        return 'incomplete'
    
    # Default to answer
    return 'answer'

if __name__ == '__main__':
    # Test the enhanced natural conversation functions
    print("🧪 Testing Enhanced Natural Conversation Utils\n")
    
    # Test question generation
    job_title = "Senior Software Engineer"
    company = "Netflix"
    print(f"Testing question generation for {job_title} at {company}:")
    questions = get_candidate_questions_with_ai(job_title, company)
    
    if questions:
        for i, q in enumerate(questions, 1):
            print(f"{i}. {q}")
        
        # Test answer evaluation
        print(f"\n🔍 Testing answer evaluation:")
        test_question = questions[0]
        test_answer = "In my previous role, I encountered a complex distributed systems issue where our microservices were experiencing intermittent timeouts. I started by analyzing logs across services, identified a race condition in our caching layer, and implemented a solution using distributed locks."
        
        evaluation = evaluate_answer_with_ai(test_question, test_answer)
        print(f"Question: {test_question}")
        print(f"Answer: {test_answer}")
        print(f"Evaluation: {evaluation}")
        
        # Test natural follow-up
        if len(questions) > 1:
            print(f"\n🔄 Testing natural follow-up:")
            next_question = questions[1]
            followup = get_natural_followup(evaluation, next_question)
            print(f"Natural transition: {followup}")
        
        # Test conversation opener
        print(f"\n👋 Testing conversation opener:")
        opener = generate_conversation_opener(job_title, company, "Alex")
        print(f"Opener: {opener}")
        
    else:
        print("❌ No questions generated. Check API connectivity.")
    
    print("\n✅ Testing complete!")