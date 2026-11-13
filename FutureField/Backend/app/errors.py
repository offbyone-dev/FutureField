"""Domain errors. Services raise these; main.py maps them to HTTP responses."""


class AppError(Exception):
    status_code = 400


class NotFoundError(AppError):
    status_code = 404


class InvalidInputError(AppError):
    status_code = 422
