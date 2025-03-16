# utils/service_response.py


class ServiceResponse:
    def __init__(
        self, success: bool, data=None, error_message: str = None, code: int = 200
    ):
        self.success = success
        self.data = data
        self.error_message = error_message
        self.code = code

    def to_dict(self):
        return {
            "success": self.success,
            "data": self.data,
            "error_message": self.error_message,
            "code": self.code,
        }

    @classmethod
    def success_response(cls, data, code=200):
        return cls(True, data=data, code=code)

    @classmethod
    def error_response(cls, error_message, code=500):
        return cls(False, error_message=error_message, code=code)


def safe_execute(func, *args, **kwargs) -> ServiceResponse:
    """
    Executes a function and returns a ServiceResponse.
    If an exception is raised, it catches it and returns an error response.
    """
    try:
        result = func(*args, **kwargs)
        return ServiceResponse.success_response(result)
    except Exception as e:
        return ServiceResponse.error_response(str(e))
