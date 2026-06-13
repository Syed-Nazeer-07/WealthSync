from flask import request


def get_json_data():
    return request.get_json(silent=True) or {}
