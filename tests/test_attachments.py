"""
Task attachments endpoint tests.
"""
import pytest
import uuid
import io
from test_client import APIClient


@pytest.mark.attachments
class TestTaskAttachments:
    """Test task attachments endpoints."""
    
    def create_test_task(self, client: APIClient) -> str:
        """Helper to create a test task and return its ID."""
        task_data = {'title': 'Test Task'}
        response = client.post('/api/tasks', json=task_data)
        return response.json()['id']
    
    def test_upload_attachment(self, authenticated_client: APIClient):
        """Test uploading an attachment to a task."""
        task_id = self.create_test_task(authenticated_client)
        
        # Create a test file
        file_content = b'Test file content'
        files = {'file': ('test.txt', io.BytesIO(file_content), 'text/plain')}
        
        response = authenticated_client.post(f'/api/tasks/{task_id}/attachments', files=files)
        assert response.status_code == 200
        
        data = response.json()
        assert data['filename'] == 'test.txt'
        assert data['mime_type'] == 'text/plain'
        assert 'id' in data
        assert 'uploaded_at' in data
    
    def test_upload_attachment_not_owned_task(self, authenticated_client: APIClient):
        """Test uploading attachment to a non-existent or non-owned task."""
        fake_task_id = uuid.uuid4()
        
        file_content = b'Test file content'
        files = {'file': ('test.txt', io.BytesIO(file_content), 'text/plain')}
        
        response = authenticated_client.post(f'/api/tasks/{fake_task_id}/attachments', files=files)
        assert response.status_code == 404
    
    def test_list_task_attachments_empty(self, authenticated_client: APIClient):
        """Test listing attachments for a task with no attachments."""
        task_id = self.create_test_task(authenticated_client)
        
        response = authenticated_client.get(f'/api/tasks/{task_id}/attachments')
        assert response.status_code == 200
        assert response.json() == []
    
    def test_list_task_attachments_with_data(self, authenticated_client: APIClient):
        """Test listing attachments for a task with attachments."""
        task_id = self.create_test_task(authenticated_client)
        
        # Upload an attachment
        file_content = b'Test file content'
        files = {'file': ('test.txt', io.BytesIO(file_content), 'text/plain')}
        authenticated_client.post(f'/api/tasks/{task_id}/attachments', files=files)
        
        # List attachments
        response = authenticated_client.get(f'/api/tasks/{task_id}/attachments')
        assert response.status_code == 200
        
        attachments = response.json()
        assert len(attachments) == 1
        assert attachments[0]['filename'] == 'test.txt'
    
    def test_list_all_user_attachments_empty(self, authenticated_client: APIClient):
        """Test listing all attachments for a user with no attachments."""
        response = authenticated_client.get('/api/attachments')
        assert response.status_code == 200
        assert response.json() == []
    
    def test_list_all_user_attachments_with_data(self, authenticated_client: APIClient):
        """Test listing all attachments for a user with attachments."""
        task_id = self.create_test_task(authenticated_client)
        
        # Upload an attachment
        file_content = b'Test file content'
        files = {'file': ('test.txt', io.BytesIO(file_content), 'text/plain')}
        authenticated_client.post(f'/api/tasks/{task_id}/attachments', files=files)
        
        # List all attachments
        response = authenticated_client.get('/api/attachments')
        assert response.status_code == 200
        
        attachments = response.json()
        assert len(attachments) == 1
        assert attachments[0]['filename'] == 'test.txt'
    
    def test_download_attachment(self, authenticated_client: APIClient):
        """Test downloading an attachment."""
        task_id = self.create_test_task(authenticated_client)
        
        # Upload an attachment
        file_content = b'Test file content for download'
        files = {'file': ('test.txt', io.BytesIO(file_content), 'text/plain')}
        upload_response = authenticated_client.post(f'/api/tasks/{task_id}/attachments', files=files)
        attachment_id = upload_response.json()['id']
        
        # Download the attachment
        response = authenticated_client.get(f'/api/tasks/{task_id}/attachments/{attachment_id}')
        assert response.status_code == 200
        assert response.content == file_content
    
    def test_download_attachment_not_found(self, authenticated_client: APIClient):
        """Test downloading a non-existent attachment."""
        task_id = self.create_test_task(authenticated_client)
        fake_attachment_id = uuid.uuid4()
        
        response = authenticated_client.get(f'/api/tasks/{task_id}/attachments/{fake_attachment_id}')
        assert response.status_code == 404
    
    def test_download_attachment_not_owned_task(self, authenticated_client: APIClient):
        """Test downloading attachment from non-owned task."""
        fake_task_id = uuid.uuid4()
        fake_attachment_id = uuid.uuid4()
        
        response = authenticated_client.get(f'/api/tasks/{fake_task_id}/attachments/{fake_attachment_id}')
        assert response.status_code == 404
    
    def test_delete_attachment(self, authenticated_client: APIClient):
        """Test deleting an attachment."""
        task_id = self.create_test_task(authenticated_client)
        
        # Upload an attachment
        file_content = b'Test file content'
        files = {'file': ('test.txt', io.BytesIO(file_content), 'text/plain')}
        upload_response = authenticated_client.post(f'/api/tasks/{task_id}/attachments', files=files)
        attachment_id = upload_response.json()['id']
        
        # Delete the attachment
        response = authenticated_client.delete(f'/api/tasks/{task_id}/attachments/{attachment_id}')
        assert response.status_code == 204
        
        # Verify it's deleted
        list_response = authenticated_client.get(f'/api/tasks/{task_id}/attachments')
        attachments = list_response.json()
        assert len(attachments) == 0
    
    def test_delete_attachment_not_found(self, authenticated_client: APIClient):
        """Test deleting a non-existent attachment."""
        task_id = self.create_test_task(authenticated_client)
        fake_attachment_id = uuid.uuid4()
        
        response = authenticated_client.delete(f'/api/tasks/{task_id}/attachments/{fake_attachment_id}')
        assert response.status_code == 404
    
    def test_delete_attachment_not_owned_task(self, authenticated_client: APIClient):
        """Test deleting attachment from non-owned task."""
        fake_task_id = uuid.uuid4()
        fake_attachment_id = uuid.uuid4()
        
        response = authenticated_client.delete(f'/api/tasks/{fake_task_id}/attachments/{fake_attachment_id}')
        assert response.status_code == 404
    
    def test_upload_multiple_attachments(self, authenticated_client: APIClient):
        """Test uploading multiple attachments to the same task."""
        task_id = self.create_test_task(authenticated_client)
        
        # Upload first attachment
        file_content1 = b'First file content'
        files1 = {'file': ('test1.txt', io.BytesIO(file_content1), 'text/plain')}
        authenticated_client.post(f'/api/tasks/{task_id}/attachments', files=files1)
        
        # Upload second attachment
        file_content2 = b'Second file content'
        files2 = {'file': ('test2.txt', io.BytesIO(file_content2), 'text/plain')}
        authenticated_client.post(f'/api/tasks/{task_id}/attachments', files=files2)
        
        # List attachments
        response = authenticated_client.get(f'/api/tasks/{task_id}/attachments')
        assert response.status_code == 200
        
        attachments = response.json()
        assert len(attachments) == 2
    
    def test_upload_different_file_types(self, authenticated_client: APIClient):
        """Test uploading attachments with different MIME types."""
        task_id = self.create_test_task(authenticated_client)
        
        # Upload text file
        text_content = b'Text content'
        text_files = {'file': ('test.txt', io.BytesIO(text_content), 'text/plain')}
        text_response = authenticated_client.post(f'/api/tasks/{task_id}/attachments', files=text_files)
        assert text_response.json()['mime_type'] == 'text/plain'
        
        # Upload JSON file
        json_content = b'{"key": "value"}'
        json_files = {'file': ('test.json', io.BytesIO(json_content), 'application/json')}
        json_response = authenticated_client.post(f'/api/tasks/{task_id}/attachments', files=json_files)
        assert json_response.json()['mime_type'] == 'application/json'
    
    def test_attachment_ownership(self, authenticated_client: APIClient):
        """Test that users can only access their own task attachments."""
        task_id = self.create_test_task(authenticated_client)
        
        # Upload an attachment
        file_content = b'Test file content'
        files = {'file': ('test.txt', io.BytesIO(file_content), 'text/plain')}
        upload_response = authenticated_client.post(f'/api/tasks/{task_id}/attachments', files=files)
        attachment_id = upload_response.json()['id']
        
        # Verify the attachment exists for the original user
        response = authenticated_client.get(f'/api/tasks/{task_id}/attachments/{attachment_id}')
        assert response.status_code == 200
