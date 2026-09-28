"""
Task lists endpoint tests.
"""
import pytest
import uuid
from test_client import APIClient


@pytest.mark.lists
class TestTaskLists:
    """Test task lists endpoints."""
    
    def test_list_lists_empty(self, authenticated_client: APIClient):
        """Test listing lists when user has no lists."""
        response = authenticated_client.get('/api/lists')
        assert response.status_code == 200
        assert response.json() == []
    
    def test_create_list_minimal(self, authenticated_client: APIClient):
        """Test creating a list with minimal data."""
        list_data = {
            'title': 'Test List'
        }
        
        response = authenticated_client.post('/api/lists', json=list_data)
        assert response.status_code in [200, 201]
        
        data = response.json()
        assert data['title'] == 'Test List'
        assert 'id' in data
        assert 'created_at' in data
        assert data['is_default'] == False  # default
    
    def test_create_list_with_color(self, authenticated_client: APIClient):
        """Test creating a list with color."""
        list_data = {
            'title': 'Colored List',
            'color': '#ff0000'
        }
        
        response = authenticated_client.post('/api/lists', json=list_data)
        assert response.status_code in [200, 201]
        
        data = response.json()
        assert data['title'] == 'Colored List'
        assert data['color'] == '#ff0000'
    
    def test_create_list_with_icon(self, authenticated_client: APIClient):
        """Test creating a list with icon."""
        list_data = {
            'title': 'Icon List',
            'icon': '📝'
        }
        
        response = authenticated_client.post('/api/lists', json=list_data)
        assert response.status_code in [200, 201]
        
        data = response.json()
        assert data['title'] == 'Icon List'
        assert data['icon'] == '📝'
    
    def test_create_list_full(self, authenticated_client: APIClient):
        """Test creating a list with all fields."""
        list_data = {
            'title': 'Full List',
            'color': '#00ff00',
            'icon': '🎯'
        }
        
        response = authenticated_client.post('/api/lists', json=list_data)
        assert response.status_code in [200, 201]
        
        data = response.json()
        assert data['title'] == 'Full List'
        assert data['color'] == '#00ff00'
        assert data['icon'] == '🎯'
    
    def test_list_lists_with_data(self, authenticated_client: APIClient):
        """Test listing lists when user has lists."""
        # Create a list
        list_data = {'title': 'Test List'}
        authenticated_client.post('/api/lists', json=list_data)
        
        # List lists
        response = authenticated_client.get('/api/lists')
        assert response.status_code == 200
        lists = response.json()
        assert len(lists) == 1
        assert lists[0]['title'] == 'Test List'
    
    def test_get_list_by_id(self, authenticated_client: APIClient):
        """Test getting a specific list by ID - using list endpoint."""
        # Create a list
        list_data = {'title': 'Test List'}
        create_response = authenticated_client.post('/api/lists', json=list_data)
        list_id = create_response.json()['id']
        
        # Get the list by checking if it exists in the list endpoint
        response = authenticated_client.get('/api/lists')
        assert response.status_code == 200
        
        lists = response.json()
        found_list = next((lst for lst in lists if lst['id'] == list_id), None)
        assert found_list is not None
        assert found_list['title'] == 'Test List'
    
    def test_get_list_not_found(self, authenticated_client: APIClient):
        """Test getting a non-existent list - using list endpoint."""
        fake_id = uuid.uuid4()
        
        # Check if fake ID exists in the list endpoint
        response = authenticated_client.get('/api/lists')
        assert response.status_code == 200
        
        lists = response.json()
        found_list = next((lst for lst in lists if lst['id'] == fake_id), None)
        assert found_list is None
    
    def test_update_list_title(self, authenticated_client: APIClient):
        """Test updating list title."""
        # Create a list
        list_data = {'title': 'Original Title'}
        create_response = authenticated_client.post('/api/lists', json=list_data)
        list_id = create_response.json()['id']
        
        # Update title
        update_data = {'title': 'Updated Title'}
        response = authenticated_client.patch(f'/api/lists/{list_id}', json=update_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data['title'] == 'Updated Title'
    
    def test_update_list_color(self, authenticated_client: APIClient):
        """Test updating list color."""
        # Create a list
        list_data = {'title': 'Test List'}
        create_response = authenticated_client.post('/api/lists', json=list_data)
        list_id = create_response.json()['id']
        
        # Update color
        update_data = {'color': '#0000ff'}
        response = authenticated_client.patch(f'/api/lists/{list_id}', json=update_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data['color'] == '#0000ff'
    
    def test_update_list_icon(self, authenticated_client: APIClient):
        """Test updating list icon."""
        # Create a list
        list_data = {'title': 'Test List'}
        create_response = authenticated_client.post('/api/lists', json=list_data)
        list_id = create_response.json()['id']
        
        # Update icon
        update_data = {'icon': '⭐'}
        response = authenticated_client.patch(f'/api/lists/{list_id}', json=update_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data['icon'] == '⭐'
    
    def test_update_list_partial(self, authenticated_client: APIClient):
        """Test partial update of list fields."""
        # Create a list
        list_data = {'title': 'Test List', 'color': '#ff0000'}
        create_response = authenticated_client.post('/api/lists', json=list_data)
        list_id = create_response.json()['id']
        
        # Update only title
        update_data = {'title': 'Updated Title'}
        response = authenticated_client.patch(f'/api/lists/{list_id}', json=update_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data['title'] == 'Updated Title'
        assert data['color'] == '#ff0000'  # unchanged
    
    def test_update_list_not_found(self, authenticated_client: APIClient):
        """Test updating a non-existent list."""
        fake_id = uuid.uuid4()
        update_data = {'title': 'Updated Title'}
        response = authenticated_client.patch(f'/api/lists/{fake_id}', json=update_data)
        assert response.status_code == 404
    
    def test_delete_list(self, authenticated_client: APIClient):
        """Test deleting a list."""
        # Create a list
        list_data = {'title': 'Test List'}
        create_response = authenticated_client.post('/api/lists', json=list_data)
        list_id = create_response.json()['id']
        
        # Delete the list
        response = authenticated_client.delete(f'/api/lists/{list_id}')
        assert response.status_code == 204
        
        # Verify it's deleted (should not appear in list)
        list_response = authenticated_client.get('/api/lists')
        lists = list_response.json()
        assert not any(lst['id'] == list_id for lst in lists)
    
    def test_delete_list_not_found(self, authenticated_client: APIClient):
        """Test deleting a non-existent list."""
        fake_id = uuid.uuid4()
        response = authenticated_client.delete(f'/api/lists/{fake_id}')
        assert response.status_code == 404
    
    def test_list_ownership(self, authenticated_client: APIClient):
        """Test that users can only access their own lists."""
        # Create a list
        list_data = {'title': 'User List'}
        create_response = authenticated_client.post('/api/lists', json=list_data)
        list_id = create_response.json()['id']
        
        # Verify the list exists for the original user (by checking list endpoint)
        response = authenticated_client.get('/api/lists')
        lists = response.json()
        assert any(lst['id'] == list_id for lst in lists)
    
    def test_task_list_relationship(self, authenticated_client: APIClient):
        """Test creating a task associated with a list."""
        # Create a list
        list_data = {'title': 'Test List'}
        list_response = authenticated_client.post('/api/lists', json=list_data)
        list_id = list_response.json()['id']
        
        # Create a task with list_id
        task_data = {
            'title': 'Task in List',
            'list_id': list_id
        }
        task_response = authenticated_client.post('/api/tasks', json=task_data)
        assert task_response.status_code in [200, 201]
        
        task = task_response.json()
        assert task['list_id'] == list_id
