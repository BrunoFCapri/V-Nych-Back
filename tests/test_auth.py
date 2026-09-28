"""
Authentication endpoint tests.
"""
import pytest
from test_client import APIClient, generate_test_username, generate_test_email, generate_test_password


@pytest.mark.auth
class TestAuthentication:
    """Test authentication endpoints."""
    
    def test_register_user_success(self, client: APIClient):
        """Test successful user registration."""
        username = generate_test_username()
        email = generate_test_email(username)
        password = generate_test_password()
        
        result = client.register(username, email, password)
        
        assert result['response'].status_code == 200
        assert 'token' in result['data']
        assert 'user' in result['data']
        assert result['data']['user']['username'] == username
        assert result['data']['user']['email'] == email
        assert result['data']['user']['is_admin'] == False
        assert client.token is not None
        assert client.user_id is not None
    
    def test_register_duplicate_username(self, client: APIClient):
        """Test registration with duplicate username fails."""
        username = generate_test_username()
        email = generate_test_email(username)
        password = generate_test_password()
        
        # First registration should succeed
        result1 = client.register(username, email, password)
        assert result1['response'].status_code == 200
        
        # Second registration with same username should fail
        client.clear_auth()
        email2 = "different_" + email
        result2 = client.register(username, email2, password)
        assert result2['response'].status_code == 409
        assert result2['data'] is None  # Error response might not be JSON
    
    def test_register_duplicate_email(self, client: APIClient):
        """Test registration with duplicate email fails."""
        username = generate_test_username()
        email = generate_test_email(username)
        password = generate_test_password()
        
        # First registration should succeed
        result1 = client.register(username, email, password)
        assert result1['response'].status_code == 200
        
        # Second registration with same email should fail
        client.clear_auth()
        username2 = "different_" + username
        result2 = client.register(username2, email, password)
        assert result2['response'].status_code == 409
        assert result2['data'] is None  # Error response might not be JSON
    
    def test_login_with_username(self, client: APIClient):
        """Test login with username."""
        username = generate_test_username()
        email = generate_test_email(username)
        password = generate_test_password()
        
        # Register first
        client.register(username, email, password)
        client.clear_auth()
        
        # Login with username
        result = client.login(username, password)
        
        assert result['response'].status_code == 200
        assert 'token' in result['data']
        assert 'user' in result['data']
        assert result['data']['user']['username'] == username
        assert client.token is not None
    
    def test_login_with_email(self, client: APIClient):
        """Test login with email."""
        username = generate_test_username()
        email = generate_test_email(username)
        password = generate_test_password()
        
        # Register first
        client.register(username, email, password)
        client.clear_auth()
        
        # Login with email
        result = client.login(email, password)
        
        assert result['response'].status_code == 200
        assert 'token' in result['data']
        assert 'user' in result['data']
        assert result['data']['user']['email'] == email
        assert client.token is not None
    
    def test_login_invalid_credentials(self, client: APIClient):
        """Test login with invalid credentials fails."""
        result = client.login('nonexistent', 'wrongpassword')
        assert result['response'].status_code == 401
        assert result['data'] is None  # Error response might not be JSON
    
    def test_login_wrong_password(self, client: APIClient):
        """Test login with correct username but wrong password fails."""
        username = generate_test_username()
        email = generate_test_email(username)
        password = generate_test_password()
        
        # Register first
        client.register(username, email, password)
        client.clear_auth()
        
        # Login with wrong password
        result = client.login(username, 'wrongpassword')
        assert result['response'].status_code == 401
        assert result['data'] is None  # Error response might not be JSON
    
    def test_admin_login_success(self, client: APIClient):
        """Test admin login with hardcoded credentials."""
        result = client.login_admin()
        
        assert result['response'].status_code == 200
        assert 'token' in result['data']
        assert 'user' in result['data']
        assert result['data']['user']['username'] == 'admin'
        assert result['data']['user']['is_admin'] == True
        assert client.is_admin == True
    
    def test_admin_login_wrong_password(self, client: APIClient):
        """Test admin login with wrong password fails."""
        result = client.login('admin', 'wrongpassword')
        assert result['response'].status_code == 401
        assert result['data'] is None  # Error response might not be JSON
    
    def test_unauthorized_access_without_token(self, client: APIClient):
        """Test accessing protected endpoint without token fails."""
        response = client.get('/api/notes')
        assert response.status_code == 401
    
    def test_unauthorized_access_with_invalid_token(self, client: APIClient):
        """Test accessing protected endpoint with invalid token fails."""
        client.token = "invalid_token"
        response = client.get('/api/notes')
        assert response.status_code == 401
    
    def test_authorized_access_with_valid_token(self, authenticated_client: APIClient):
        """Test accessing protected endpoint with valid token succeeds."""
        response = authenticated_client.get('/api/notes')
        assert response.status_code == 200
