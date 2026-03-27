import pandas as pd

def process_data(data):
    df = pd.DataFrame(data)

    df["sent_time"] = pd.to_datetime(df["sent_time"])
    df["reply_time"] = pd.to_datetime(df["reply_time"])

    df["response_time"] = (df["reply_time"] - df["sent_time"]).dt.total_seconds() / 3600
    df["day"] = df["sent_time"].dt.day_name()

    return df