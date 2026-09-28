"""
Test e2e del endpoint POST /api/notes.

Sin mocks: pega contra el backend levantado (docker-compose) con Postgres real.
Usa las fixtures de tests/conftest.py, que limpian los datos al terminar.
"""
import uuid

import pytest
from test_client import APIClient


@pytest.mark.e2e
class TestCreateNoteE2E:

    def test_post_note_persiste_y_se_puede_recuperar(self, authenticated_client: APIClient):
        payload = {
            "title": f"Nota e2e {uuid.uuid4().hex[:6]}",
            "content": {"blocks": [{"type": "paragraph", "text": "Hola desde e2e"}]},
        }

        created = authenticated_client.post('/api/notes', json=payload)

        assert created.status_code == 200
        note = created.json()
        assert note['title'] == payload['title']
        assert note['content'] == payload['content']
        assert note['user_id'] == authenticated_client.user_id
        assert note['parent_id'] is None

        # Lo que devolvió el POST quedó realmente guardado en la BD.
        fetched = authenticated_client.get(f"/api/notes/{note['id']}")
        assert fetched.status_code == 200
        assert fetched.json() == note

        listed = authenticated_client.get('/api/notes').json()
        assert note['id'] in [n['id'] for n in listed]

    def test_post_subnota_queda_vinculada_al_padre(self, authenticated_client: APIClient):
        parent = authenticated_client.post('/api/notes', json={"title": "Padre", "content": {}}).json()

        child = authenticated_client.post('/api/notes', json={
            "title": "Hija",
            "content": {},
            "parent_id": parent['id'],
        })

        assert child.status_code == 200
        assert child.json()['parent_id'] == parent['id']

    def test_post_note_sin_token_responde_401(self, client: APIClient):
        response = client.post('/api/notes', json={"title": "Sin auth", "content": {}})

        assert response.status_code == 401
