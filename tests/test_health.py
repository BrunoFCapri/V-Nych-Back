"""
Health check and status endpoint tests.
"""
import pytest
from test_client import APIClient


@pytest.mark.health
class TestHealthAndStatus:
    """Test health check and status endpoints."""
    
    def test_health_check(self, client: APIClient):
        """Test the basic health check endpoint."""
        response = client.get('/health')
        assert response.status_code == 200
        assert response.text == 'OK'
    
    def test_status_endpoint(self, client: APIClient):
        """Test the status endpoint with backend running."""
        response = client.get('/api/status')
        assert response.status_code == 200
        
        data = response.json()
        assert 'status' in data
        assert 'database' in data
        assert 'redis' in data
        assert data['status'] == 'Running'
    
    def test_status_database_connected(self, client: APIClient):
        """Test that status reports database as connected."""
        response = client.get('/api/status')
        assert response.status_code == 200
        
        data = response.json()
        assert data['database'] == 'Connected'
    
    def test_status_redis_connected(self, client: APIClient):
        """Test that status reports Redis as connected."""
        response = client.get('/api/status')
        assert response.status_code == 200
        
        data = response.json()
        assert data['redis'] == 'Connected'
    
    def test_public_calendar_availability(self, client: APIClient):
        """Test the public calendar availability endpoint."""
        response = client.get('/api/public/calendar')
        # This endpoint should work without authentication
        # May return 400 if missing required query parameters
        assert response.status_code in [200, 404, 400]  # 404 if no events exist, 400 if missing params
    
    def test_health_check_no_auth_required(self, client: APIClient):
        """Test that health check doesn't require authentication."""
        # Clear any auth
        client.clear_auth()
        response = client.get('/health')
        assert response.status_code == 200
    
    def test_status_no_auth_required(self, client: APIClient):
        """Test that status endpoint doesn't require authentication."""
        # Clear any auth
        client.clear_auth()
        response = client.get('/api/status')
        assert response.status_code == 200
    
    def test_public_calendar_no_auth_required(self, client: APIClient):
        """Test that public calendar endpoint doesn't require authentication."""
        # Clear any auth
        client.clear_auth()
        response = client.get('/api/public/calendar')
        # May return 400 if missing required query parameters
        assert response.status_code in [200, 404, 400]
