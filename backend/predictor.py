import joblib
from scipy.sparse import hstack

model = joblib.load("../ml_model/lead_model.pkl")
vectorizer = joblib.load("../ml_model/vectorizer.pkl")

def classify_lead(message, has_budget, has_timeline, urgency):
    text_vec = vectorizer.transform([message])
    num_vec = [[has_budget, has_timeline, urgency]]
    X = hstack([text_vec, num_vec])
    return model.predict(X)[0]
