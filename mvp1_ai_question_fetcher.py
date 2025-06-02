#!/usr/bin/env python3
import os
import argparse
import requests
import re
import time
import openai
from bs4 import BeautifulSoup
import json
import argparse
import openai

# ─── CONFIG ─────────────────────────────────────────────────────────────────────
# Make sure you have the following environment variables set:
GOOGLE_API_KEY, GOOGLE_CX = os.getenv("GOOGLE_API_KEY"), os.getenv("GOOGLE_CX")
if not GOOGLE_API_KEY or not GOOGLE_CX:
    raise RuntimeError("Set your GOOGLE_API_KEY and GOOGLE_CX environment variables before running.")
SEARCH_NUM = 5  # how many results to fetch per search

# Make sure your OPENAI_API_KEY is set in the environment:
openai.api_key = os.getenv("OPENAI_API_KEY")
if not openai.api_key:
    raise RuntimeError("Set your OPENAI_API_KEY environment variable before running.")

# If you scrape a lot of pages, you may want to respect rate limits:
OPENAI_SLEEP_BETWEEN_CALLS = 1.0  # seconds
# ────────────────────────────────────────────────────────────────────────────────

def fetch_search_results(query, num=SEARCH_NUM):
    """
    Calls Google Custom Search API for a given query string,
    returns a list of result URLs (up to `num`).
    """
    url = "https://www.googleapis.com/customsearch/v1"
    params = {
        "key": GOOGLE_API_KEY,
        "cx": GOOGLE_CX,
        "q": query,
        "num": num
    }
    resp = requests.get(url, params=params, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    items = data.get("items", [])
    return [item["link"] for item in items]


def scrape_text_from_url(url):
    """
    Fetches the page at `url` and extracts text from <h1-4>, <p>, and <li> tags.
    """
    try:
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
    except requests.exceptions.RequestException:
        return ""

    soup = BeautifulSoup(resp.text, "html.parser")

    # Remove <script>, <style>, <nav>, <footer>, etc.
    for tag in soup(["script", "style", "header", "footer", "nav", "aside", "form"]):
        tag.decompose()

    # Grab text from h1-h4, p, and li tags
    texts = []
    for tag_name in ["h1", "h2", "h3", "h4", "p", "li"]:
        for t in soup.find_all(tag_name):
            txt = t.get_text(separator=" ", strip=True)
            if txt:
                texts.append(txt)
    return "\n".join(texts)


def get_candidate_questions_with_ai(raw_text, job_title, company, max_questions=15):
    """
    Send a prompt to OpenAI that asks it to extract all interview questions
    from the raw_text and return a JSON array of up to `max_questions` best questions
    for the given job/company context.
    """
    prompt = f"""
You are an AI assistant that extracts and refines interview questions from a blob of scraped text.
The user is preparing for a {job_title} role at {company}. Below is a chunk of raw text (which may contain some interview Q&A, bullet lists, or just page text).

Your job:
1. Find every question‐style line (anything that ends with a question mark or looks like “Q: ... ?”).
2. Deduplicate near‐duplicates (e.g. “Tell me about a time you led a team?” vs. “Tell me about a time you led a team at work?” should be merged).
3. Keep only ones that actually sound like “interview‐style” prompts (discard irrelevant “site navigation?” lines or “Ready to learn more?”).
4. Rank them by how relevant/likely they are for this specific role ({job_title} at {company}).
5. Finally, return at most {max_questions} questions, in JSON array form, e.g.:

[
  "Tell me about a time you used data to drive a strategic decision?",
  "How would you design an A/B test to measure the effectiveness of Netflix recommendations?",
  ...
]

Make sure the output is valid JSON (just a single array of strings), with no extra commentary.
------
Raw text (length ~{len(raw_text.split())} words):
\"\"\"
{raw_text[:2000]}  # we only show the first 2000 chars to the model to avoid token‐limit issues
\"\"\"
"""
    # print("\n[DEBUG] First 2000 characters of text sent to OpenAI:\n")
    # print(raw_text[:2000])
    # print("\n" + "-" * 60 + "\n")

    # If raw_text is very large, you might need to chunk it or trim more aggressively.
    try:
        resp = openai.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,  # deterministic output
            max_tokens=600,  # enough to output ~15 JSON items
        )
        text_out = resp.choices[0].message.content.strip()
        # Try to parse the response as JSON. If it fails, we’ll do a naive regex parse.
        try:
            questions = json.loads(text_out)
            if isinstance(questions, list):
                return questions
        except json.JSONDecodeError:
            # Fallback: extract lines between [ and ] and split on quotes
            items = re.findall(r'"(.*?)\?"', text_out)
            return [q + "?" for q in items][:max_questions]

        return []

    except openai.APIError as e:
        print(f"[✖] OpenAI error: {e}")
        return []


def conduct_interview(job_title, company, questions):
    print("\nStarting the mock interview...\n")
    for i, question in enumerate(questions):
        print(f"Question {i+1}: {question}")
        user_answer = input("Your answer: ")

        # Call LLM to evaluate and potentially get follow-up
        llm_response = openai.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are evaluating an interview answer and deciding if a follow-up is needed."},
                {"role": "user", "content": f"Question: {question}\nAnswer: {user_answer}"}
            ],
            # ... (adjust parameters and prompt for evaluation/follow-up)
        )
        llm_output = llm_response.choices[0].message.content.strip()
        print(f"AI Feedback: {llm_output}\n")

        # (Simple logic for follow-up - can be expanded)
        if "follow-up" in llm_output.lower():
            follow_up_question = input("AI Follow-up question (enter if provided, else skip): ")
            if follow_up_question:
                user_follow_up_answer = input("Your answer to follow-up: ")
                # (Optionally evaluate follow-up too)

        input("Press Enter to continue to the next question...") # Simple pacing

    print("\nEnd of the mock interview. Thank you!\n")

def main():
    parser = argparse.ArgumentParser(description="MVP2: Text-based AI Mock Interview")
    parser.add_argument("job_title", help="Target job title")
    parser.add_argument("company", help="Company name")
    args = parser.parse_args()

    print("[→] Fetching interview questions...")
    questions = get_candidate_questions_with_ai(
        raw_text=get_combined_scraped_text(args.job_title, args.company),
        job_title=args.job_title,
        company=args.company,
        max_questions=10 # Let's start with a smaller number for the interview
    )

    if questions:
        conduct_interview(args.job_title, args.company, questions)
    else:
        print("[!] Could not fetch interview questions. Please try again.")

def get_combined_scraped_text(job_title, company):
    query = f'"{company}" "{job_title}" interview questions'
    urls = fetch_search_results(query)
    all_text = ""
    for url in urls:
        print(f"  • Scraping: {url}")
        text = scrape_text_from_url(url)
        if text:
            all_text += text + "\n\n"
    return all_text

if __name__ == "__main__":
    main()