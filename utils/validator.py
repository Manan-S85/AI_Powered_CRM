def validate_input(company, website, email):

    if not company:
        return False

    if not website and not email:
        return False

    return True