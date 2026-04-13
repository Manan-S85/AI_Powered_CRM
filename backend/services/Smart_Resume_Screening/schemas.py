from pydantic import BaseModel, Field
from typing import List, Optional

class ResumeData(BaseModel):
    candidate_name: str = ""
    email: str = ""
    phone: str = ""
    skills: List[str] = Field(default_factory=list)
    experience_years: float = 0.0
    companies: List[str] = Field(default_factory=list)
    education: str = ""
    projects: List[str] = Field(default_factory=list)
    roles: List[str] = Field(default_factory=list)

class JDData(BaseModel):
    required_skills: List[str] = Field(default_factory=list)
    preferred_skills: List[str] = Field(default_factory=list)
    required_experience: float = 0.0
    job_role: str = ""
    education_required: str = ""
    responsibilities: List[str] = Field(default_factory=list)