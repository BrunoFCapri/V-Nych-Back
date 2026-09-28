"""
Pytest configuration and shared fixtures.
"""
import pytest
from test_client import APIClient, generate_test_username, generate_test_email, generate_test_password, wait_for_backend


@pytest.fixture(scope="session")
def backend_available():
    """Ensure the backend is available before running tests."""
    client = APIClient()
    if not wait_for_backend(client):
        pytest.fail("Backend is not available. Please start the backend first.")
    yield True



@pytest.fixture
def client(backend_available):
    """Create a test client for each test."""
    client = APIClient()
    yield client
    # Cleanup after each test
    client.delete_user_data()
    client.clear_auth()


@pytest.fixture
def authenticated_client(client):
    """Create an authenticated test client."""
    username = generate_test_username()
    email = generate_test_email(username)
    password = generate_test_password()
    
    result = client.register(username, email, password)
    assert result['response'].status_code == 200
    
    yield client


@pytest.fixture
def admin_client(client):
    """Create an admin authenticated client."""
    result = client.login_admin()
    assert result['response'].status_code == 200
    yield client
