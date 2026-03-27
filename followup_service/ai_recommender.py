import openai

def generate_recommendation(insights):

    prompt = f"""
    Based on the following insights:

    Best Day: {insights['best_day']}
    Best Channel: {insights['best_channel']}
    Avg Response Time (hours): {insights['avg_response_time']}

    Generate a professional follow-up recommendation including:
    best day, best time, and best communication channel.
    """

    response = openai.ChatCompletion.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}]
    )

    return {
        "recommendation": response["choices"][0]["message"]["content"]
    }