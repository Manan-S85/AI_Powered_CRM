# tools.py

def get_leave_balance(emp_id):
    data = {
        1: {"leaves": 12}
    }
    return data.get(emp_id, {}).get("leaves", "No data found")


def get_salary(emp_id):
    data = {
        1: {"basic": 30000, "hra": 10000, "bonus": 5000}
    }
    return data.get(emp_id, "No salary data")


def get_policy(policy_name):
    policies = {
        "maternity": "6 months paid leave is provided."
    }
    return policies.get(policy_name, "Policy not found")