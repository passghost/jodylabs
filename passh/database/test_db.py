import bcrypt
import os
from db_init import Database

def test_database():
    """Test basic database operations"""
    # Use the same database instance as db_init
    db = Database()
    
    print("Testing database operations...")
    print(f"Using database at: {os.path.abspath(db.db_path)}")
    
    # Connect to database
    if not db.connect():
        print("Failed to connect to database")
        return False
    
    try:
        # Test user creation
        password = "testpassword123"
        hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        user_id = db.create_user("testuser", "test@example.com", hashed)
        if not user_id:
            print("Failed to create user")
            return False
        print(f"Created user with ID: {user_id}")
        
        # Test profile creation
        profile_id = db.create_profile(
            user_id=user_id,
            display_name="Test Artist",
            bio="A test artist profile",
            avatar_url="https://example.com/avatar.jpg"
        )
        if not profile_id:
            print("Failed to create profile")
            return False
        print(f"Created profile with ID: {profile_id}")
        
        # Test artwork creation
        artwork_id = db.create_artwork(
            user_id=user_id,
            title="Test Artwork",
            image_url="https://example.com/artwork.jpg",
            description="A beautiful test artwork",
            tags=["test", "art", "digital"],
            category="digital"
        )
        if not artwork_id:
            print("Failed to create artwork")
            return False
        print(f"Created artwork with ID: {artwork_id}")
        
        # Test like functionality
        if not db.toggle_like(user_id, artwork_id):
            print("Failed to toggle like")
            return False
        print("Successfully tested like functionality")
        
        # Test artwork retrieval
        artworks = db.get_artworks(user_id)
        if not artworks:
            print("Failed to retrieve artworks")
            return False
        print(f"Retrieved {len(artworks)} artworks")
        
        print("\nAll database tests passed successfully!")
        return True
        
    except Exception as e:
        print(f"Error during testing: {e}")
        return False
    finally:
        db.close()

if __name__ == "__main__":
    test_database()
