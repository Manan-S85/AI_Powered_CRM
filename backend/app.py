from flask import Flask, request, jsonify
from database import leads_collection
from predictor import classify_lead

app = Flask(__name__)

@app.route("/new-lead", methods=["POST"])
def new_lead():
    data = request.json

    lead_type = classify_lead(
        data["message"],
        data["has_budget"],
        data["has_timeline"],
        data["urgency"]
    )

    data["lead_type"] = lead_type
    leads_collection.insert_one(data)

    return jsonify({
        "status": "success",
        "lead_type": lead_type
    })

if __name__ == "__main__":
    app.run(debug=True)
