def analyze_patterns(df):

    day_performance = df.groupby("day")["response_time"].mean().to_dict()
    best_day = min(day_performance, key=day_performance.get)

    channel_performance = df.groupby("channel")["response_time"].mean().to_dict()
    best_channel = min(channel_performance, key=channel_performance.get)

    avg_response_time = df["response_time"].mean()

    return {
        "best_day": best_day,
        "best_channel": best_channel,
        "avg_response_time": avg_response_time
    }