import pdfplumber
import os

def extract_text_from_pdf(file_path: str) -> str:
    """
    Extracts and returns clean text from a PDF resume.
    Supports both file paths (str) and file-like objects.
    """
    if isinstance(file_path, str) and not os.path.exists(file_path):
        raise FileNotFoundError(f"PDF file not found: {file_path}")

    text = ""
    try:
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
    except Exception as e:
        raise RuntimeError(f"Failed to extract text from PDF: {e}")

    return text.strip()