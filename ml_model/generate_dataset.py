import random
import pandas as pd

hot_msgs = [
    "urgent website needed budget 50k",
    "need app asap budget 1 lakh",
    "looking to buy software immediately",
    "require ecommerce website urgent",
]

warm_msgs = [
    "planning website next month",
    "interested but need discussion",
    "may need app in future",
    "looking for quotation"
]

cold_msgs = [
    "just checking price",
    "hi",
    "need info",
    "only enquiry"
]

data = []

for _ in range(120):
    data.append([random.choice(hot_msgs), 1, 1, 2, "Hot"])

for _ in range(90):
    data.append([random.choice(warm_msgs), 0, 1, 1, "Warm"])

for _ in range(90):
    data.append([random.choice(cold_msgs), 0, 0, 0, "Archive"])

df = pd.DataFrame(data, columns=[
    "message", "has_budget", "has_timeline", "urgency", "label"
])

df.to_csv("leads_dataset.csv", index=False)
print("Dataset generated:", len(df))
