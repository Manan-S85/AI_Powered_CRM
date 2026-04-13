import google.genai as genai
import os
import json
from schemas import ResumeData
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise EnvironmentError("GEMINI_API_KEY is not set in your .env file.")

client = genai.Client(api_key=GEMINI_API_KEY)


def parse_resume(resume_text: str) -> dict:
    """
    Uses Gemini to extract structured data from raw resume text.
    Returns a validated dict matching the ResumeData schema.
    """
    
    prompt = f"""
    You are a highly accurate resume parsing system.

    Your task is to extract structured information from the given resume.

    IMPORTANT RULES:
    - Return ONLY valid JSON — no markdown, no explanation, no extra text
    - If information is missing, return empty list [] or empty string "" or 0
    - Do NOT guess or hallucinate
    - All skills must be lowercase
    - Remove duplicate skills
    - Experience must be total years (numeric only, e.g. 2.5)
    - Extract contact details ONLY if clearly present in resume

    SCHEMA:
    {{
    "candidate_name": "string",
    "email": "string",
    "phone": "string",
    "skills": ["string"],
    "experience_years": number,
    "companies": ["string"],
    "education": "string",
    "projects": ["string"],
    "roles": ["string"]
    }}

    FIELD DEFINITIONS:
    - candidate_name: full name of candidate (top of resume usually)
    - email: valid email address
    - phone: phone number with country code if available
    - skills: technical and professional skills (e.g., python, react, sql)
    - experience_years: total professional experience in years
    - companies: names of companies worked at (empty list if none / student)
    - education: highest qualification as a short string (e.g., "BSc Computer Science")
    - projects: key projects worked on (titles only)
    - roles: job roles or designations (e.g., "software engineer", "ml intern")

    EXTRACTION GUIDELINES:
    - Name should NOT include email or titles like "resume", "cv"
    - Email must contain "@"
    - Phone should be a valid number (ignore random numbers like dates)
    - If multiple emails/phones exist, return the primary one

    Resume:
    {resume_text}
"""

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash-lite",
            contents=prompt,
            config={"temperature": 0, "top_p": 0.1},
        )

        text = response.text.strip()

        # Strip markdown code fences if present
        if text.startswith("```"):
            text = text.replace("```json", "").replace("```", "").strip()

        data = json.loads(text)
        validated = ResumeData(**data)
        return validated.model_dump()

    except json.JSONDecodeError as e:
        print(f"[resume_parser] JSON decode error: {e}")
    except Exception as e:
        print(f"[resume_parser] Error: {e}")

    # Safe fallback
    return ResumeData(
        skills=[], experience_years=0.0, companies=[],
        education="", projects=[], roles=[]
    ).model_dump()