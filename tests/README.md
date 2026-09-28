# V-Nych Backend Integration Tests

Python integration test suite for the V-Nych Rust backend API.

## Prerequisites

1. **Backend Running**: The Rust backend must be running on `http://localhost:3000`
   ```bash
   # Start with Docker Compose
   docker-compose up -d
   
   # Or run locally
   cd backend
   cargo run
   ```

2. **Python 3.8+**: Ensure Python 3.8 or higher is installed

3. **Dependencies**: Install required Python packages
   ```bash
   cd tests
   pip install -r requirements.txt
   ```

## Test Structure

```
tests/
├── conftest.py              # Pytest fixtures and configuration
├── test_client.py          # Base HTTP client and helper functions
├── test_auth.py            # Authentication endpoint tests
├── test_notes.py           # Notes CRUD tests
├── test_calendar.py        # Calendar events tests
├── test_tasks.py           # Tasks CRUD tests
├── test_lists.py           # Task lists tests
├── test_attachments.py     # File attachments tests
├── test_admin.py           # Admin endpoint tests
├── test_health.py          # Health check tests
├── requirements.txt        # Python dependencies
├── pytest.ini              # Pytest configuration
└── .env.test              # Test environment variables
```

## Running Tests

### Run All Tests
```bash
cd tests
pytest
```

### Run Specific Test File
```bash
pytest test_auth.py
```

### Run Specific Test Class
```bash
pytest test_auth.py::TestAuthentication
```

### Run Specific Test Method
```bash
pytest test_auth.py::TestAuthentication::test_register_user_success
```

### Run by Marker
```bash
# Run only authentication tests
pytest -m auth

# Run only notes tests
pytest -m notes

# Run multiple markers
pytest -m "auth or notes"
```

### Verbose Output
```bash
pytest -v
```

### Show Print Statements
```bash
pytest -s
```

### Stop on First Failure
```bash
pytest -x
```

## Test Coverage

The test suite covers:

- **Authentication**: Registration, login, token validation, admin access
- **Notes**: CRUD operations, hierarchy (parent_id), ownership
- **Calendar Events**: CRUD operations, date filtering, recurrence rules
- **Tasks**: CRUD operations, filtering (starred, parent), status updates
- **Task Lists**: CRUD operations, task-list relationships
- **Attachments**: Upload, download, delete, MIME type handling
- **Admin**: Admin-only endpoints, access control
- **Health**: System status, database/Redis connectivity

## Configuration

Edit `.env.test` to customize test settings:

```env
BACKEND_URL=http://localhost:3000
TEST_USER_PREFIX=test_user_
TEST_TIMEOUT=30
```

## Automatic Cleanup

Each test automatically cleans up its data after execution:
- Deletes created users (via cascade through their data)
- Deletes notes, events, tasks, lists, and attachments
- Resets authentication state

## Troubleshooting

### Backend Not Available
If tests fail with "Backend is not available":
1. Ensure the backend is running: `docker-compose ps`
2. Check backend logs: `docker-compose logs backend`
3. Verify the backend URL in `.env.test`

### Database Connection Issues
If tests fail with database errors:
1. Ensure PostgreSQL is running: `docker-compose ps db`
2. Check database logs: `docker-compose logs db`
3. Verify database migrations ran successfully

### Authentication Failures
If authentication tests fail:
1. Check that the admin credentials are correct (admin/Bannana13@)
2. Verify JWT secret configuration in backend
3. Check for duplicate test users in database

### Timeout Errors
If tests timeout:
1. Increase `TEST_TIMEOUT` in `.env.test`
2. Check backend performance and logs
3. Ensure database isn't locked

## Test Data Factories

The suite includes helper functions for generating test data:

- `generate_test_username()`: Creates unique usernames
- `generate_test_email(username)`: Creates unique test emails
- `generate_test_password()`: Creates passwords meeting requirements
- `get_iso_datetime(minutes)`: Creates ISO format datetime strings

## CI/CD Integration

To run tests in CI/CD:

```yaml
# Example GitHub Actions
- name: Start Backend
  run: docker-compose up -d

- name: Wait for Backend
  run: sleep 10

- name: Run Tests
  run: |
    cd tests
    pip install -r requirements.txt
    pytest

- name: Stop Backend
  run: docker-compose down
```

## Contributing

When adding new tests:

1. Follow the existing test structure
2. Use appropriate markers (e.g., `@pytest.mark.notes`)
3. Ensure tests clean up their own data
4. Add documentation for new test files
5. Update this README with new coverage areas

## Notes

- Tests modify the database; always use a test environment
- Admin credentials are hardcoded in the backend (admin/Bannana13@)
- Each test runs in isolation with automatic cleanup
- File uploads use in-memory byte streams for testing
