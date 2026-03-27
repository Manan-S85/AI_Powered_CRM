import pandas as pd
import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from scipy.sparse import hstack

df = pd.read_csv("leads_dataset.csv")

X_text = df["message"]
X_num = df[["has_budget", "has_timeline", "urgency"]]
y = df["label"]

vectorizer = TfidfVectorizer()
X_text_vec = vectorizer.fit_transform(X_text)

X = hstack([X_text_vec, X_num])

model = LogisticRegression(max_iter=1000)
model.fit(X, y)

joblib.dump(model, "lead_model.pkl")
joblib.dump(vectorizer, "vectorizer.pkl")

print("Model trained successfully")
