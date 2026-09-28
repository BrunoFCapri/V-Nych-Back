"""
Base test client and helper functions for API testing.
"""
import os
import time
import uuid
import requests
from typing import Optional, Dict, Any
from dotenv import load_dotenv

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), '.env.test'))

BASE_URL = os.getenv('BACKEND_URL', 'http://localhost:3000')
TEST_USER_PREFIX = os.getenv('TEST_USER_PREFIX', 'test_user_')
TEST_TIMEOUT = int(os.getenv('TEST_TIMEOUT', '30'))


class _APIClient:
    """HTTP client for testing the V-Nych API."""
    
    def __init__(self, base_url: str = BASE_URL):
        """Initialize the API client.
        
        Args:
            base_url: Base URL for the API (default from env or localhost:3000)
        """
        self.base_url = base_url
        self.token: Optional[str] = None
        self.user_id: Optional[str] = None
        self.username: Optional[str] = None
        self.is_admin: bool = False
    
    def set_auth(self, token: str, user_id: str, username: str, is_admin: bool = False) -> None:
        """Set authentication credentials."""
        self.token = token
        self.user_id = user_id
        self.username = username
        self.is_admin = is_admin
    
    def clear_auth(self):
        """Clear authentication credentials."""
        self.token = None
        self.user_id = None
        self.username = None
        self.is_admin = False
    
    def _get_headers(self) -> Dict[str, str]:
        """Get headers with authentication if available."""
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        return headers
    
    def _request(self, method: str, endpoint: str, **kwargs) -> requests.Response:
        """Make an HTTP request with proper error handling."""
        url = f"{self.base_url}{endpoint}"
        headers = kwargs.pop('headers', {})
        
        # Don't set Content-Type for file uploads (requests will set it with boundary)
        if 'files' not in kwargs:
            headers.update(self._get_headers())
        else:
            # For file uploads, only add auth header if token exists
            if self.token:
                headers['Authorization'] = f'Bearer {self.token}'
        
        try:
            response = requests.request(method, url, headers=headers, timeout=TEST_TIMEOUT, **kwargs)
            return response
        except requests.exceptions.RequestException as e:
            raise Exception(f"Request failed: {e}")
    
    def get(self, endpoint: str, **kwargs) -> requests.Response:
        """Make a GET request."""
        return self._request('GET', endpoint, **kwargs)
    
    def post(self, endpoint: str, **kwargs) -> requests.Response:
        """Make a POST request."""
        return self._request('POST', endpoint, **kwargs)
    
    def patch(self, endpoint: str, **kwargs) -> requests.Response:
        """Make a PATCH request."""
        return self._request('PATCH', endpoint, **kwargs)
    
    def delete(self, endpoint: str, **kwargs) -> requests.Response:
        """Make a DELETE request."""
        return self._request('DELETE', endpoint, **kwargs)
    
    # Authentication helpers
    def register(self, username: str, email: str, password: str) -> Dict[str, Any]:
        """Register a new user."""
        response = self.post('/api/auth/register', json={
            'username': username,
            'email': email,
            'password': password
        })
        try:
            data = response.json()
        except:
            data = None
        if response.status_code in [200, 201] and data:
            self.set_auth(data['token'], data['user']['id'], data['user']['username'], data['user']['is_admin'])
        return {'response': response, 'data': data}
    
    def login(self, identifier: str, password: str) -> Dict[str, Any]:
        """Login with username or email."""
        response = self.post('/api/auth/login', json={
            'identifier': identifier,
            'password': password
        })
        try:
            data = response.json()
        except:
            data = None
        if response.status_code in [200, 201] and data:
            self.set_auth(data['token'], data['user']['id'], data['user']['username'], data['user']['is_admin'])
        return {'response': response, 'data': data}
    
    def login_admin(self) -> Dict[str, Any]:
        """Login as admin using hardcoded credentials."""
        return self.login('admin', 'Bannana13@')
    
    # Cleanup helpers
    def delete_user_data(self) -> None:
        """Delete all data created by the current user."""
        if not self.user_id or self.is_admin:
            return
        
        try:
            # Delete attachments (cascade should handle this, but let's be safe)
            attachments = self.get('/api/attachments').json()
            for attachment in attachments:
                # We need task_id to delete attachments, skip for now
                pass
            
            # Delete tasks
            tasks = self.get('/api/tasks').json()
            for task in tasks:
                self.delete(f"/api/tasks/{task['id']}")
            
            # Delete notes
            notes = self.get('/api/notes').json()
            for note in notes:
                self.delete(f"/api/notes/{note['id']}")
            
            # Delete events
            events = self.get('/api/calendar/events').json()
            for event in events:
                self.delete(f"/api/calendar/events/{event['id']}")
            
            # Delete lists
            lists = self.get('/api/lists').json()
            for lst in lists:
                self.delete(f"/api/lists/{lst['id']}")
        except Exception as e:
            print(f"Error during cleanup: {e}")


# Test data factories
def generate_test_username() -> str:
    """Generate a unique test username."""
    return f"{TEST_USER_PREFIX}{uuid.uuid4().hex[:8]}"


def generate_test_email(username: str = None) -> str:
    """Generate a unique test email."""
    if username is None:
        username = generate_test_username()
    return f"{username}@test.local"


def generate_test_password() -> str:
    """Generate a test password that meets requirements."""
    return "TestPassword123!"


# Type alias for public API
APIClient = _APIClient


def wait_for_backend(client: APIClient, max_retries: int = 10, retry_interval: int = 2) -> bool:
    """Wait for the backend to be available."""
    for _ in range(max_retries):
        try:
            response = client.get('/health')
            if response.status_code == 200:
                return True
        except Exception:
            pass
        time.sleep(retry_interval)
    return False
