import pytest
import os
from app import app, db
from finora.models import User, Profile

@pytest.fixture
def client():
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    app.config['WTF_CSRF_ENABLED'] = False
    
    with app.test_client() as client:
        with app.app_context():
            db.create_all()
            yield client
            db.drop_all()

@pytest.fixture
def init_database():
    user = User(
        name="Test User",
        email="test@example.com",
        email_verified=True
    )
    user.set_password("TestPassword123!")
    db.session.add(user)
    db.session.commit()
    
    profile = Profile(user_id=user.id)
    db.session.add(profile)
    db.session.commit()
    
    yield db
