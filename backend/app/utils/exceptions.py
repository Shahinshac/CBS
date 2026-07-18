"""
Custom exceptions for the banking system
"""


class BankingException(Exception):
    """Base exception for banking system"""
    def __init__(self, message, status_code=400):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class AuthenticationError(BankingException):
    """Authentication failed"""
    def __init__(self, message="Authentication failed"):
        super().__init__(message, 401)


class AuthorizationError(BankingException):
    """Authorization failed - user lacks permission"""
    def __init__(self, message="Authorization failed - insufficient permissions"):
        super().__init__(message, 403)


class ValidationError(BankingException):
    """Input validation failed"""
    def __init__(self, message="Validation failed"):
        super().__init__(message, 400)


class ResourceNotFoundError(BankingException):
    """Resource not found"""
    def __init__(self, message="Resource not found"):
        super().__init__(message, 404)


class InsufficientBalanceError(BankingException):
    """Insufficient account balance"""
    def __init__(self, message="Insufficient balance"):
        super().__init__(message, 400)


class DuplicateResourceError(BankingException):
    """Resource already exists"""
    def __init__(self, message="Resource already exists"):
        super().__init__(message, 409)


class UserAlreadyExistsError(DuplicateResourceError):
    """User with given email/username already exists"""
    def __init__(self, message="User already exists"):
        super().__init__(message)
