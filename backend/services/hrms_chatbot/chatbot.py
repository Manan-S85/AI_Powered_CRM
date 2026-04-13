from .tools import get_leave_balance, get_salary, get_policy

def process_query(query, emp_id=1):
    query = query.lower()

    if "leave" in query:
        return f"You have {get_leave_balance(emp_id)} leaves remaining."

    elif "salary" in query:
        return f"Salary breakdown: {get_salary(emp_id)}"

    elif "maternity" in query:
        return get_policy("maternity")

    return "Sorry, I didn't understand your query."