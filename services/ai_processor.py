import openai

def generate_summary(company, content):

    prompt = f"""
    Company Name: {company}
    Website Content: {content}

    Identify:
    Industry
    Estimated company size
    Possible decision makers
    Generate a short professional summary
    """

    response = openai.ChatCompletion.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}]
    )

    return response["choices"][0]["message"]["content"]