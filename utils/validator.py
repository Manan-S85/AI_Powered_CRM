def validate_lead_input(company, website, email):

    if not company:
        return False

    if not website and not email:
        return False

    return True


def validate_followup_input(data):

    if not isinstance(data, list):
        return False

    required_keys = {"sent_time", "reply_time", "channel"}

    for item in data:
        if not required_keys.issubset(item.keys()):
            return False

    return True