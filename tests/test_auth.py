import json

def test_login_success(client, init_database):
    response = client.post('/api/auth/login', json={
        'email': 'test@example.com',
        'password': 'TestPassword123!'
    })
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['email'] == 'test@example.com'

def test_login_invalid_password(client, init_database):
    response = client.post('/api/auth/login', json={
        'email': 'test@example.com',
        'password': 'WrongPassword!'
    })
    assert response.status_code == 401

def test_login_invalid_email(client, init_database):
    response = client.post('/api/auth/login', json={
        'email': 'doesnotexist@example.com',
        'password': 'TestPassword123!'
    })
    assert response.status_code == 401
