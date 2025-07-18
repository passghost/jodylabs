import sqlite3
import os
import json
from datetime import datetime

class Database:
    def __init__(self, db_path=None):
        if db_path is None:
            # Use absolute path to database file
            current_dir = os.path.dirname(os.path.abspath(__file__))
            self.db_path = os.path.join(current_dir, 'database.db')
        else:
            self.db_path = db_path
        self.conn = None
        self.cursor = None

    def connect(self):
        """Establish database connection"""
        try:
            self.conn = sqlite3.connect(self.db_path)
            self.conn.row_factory = sqlite3.Row  # Enable row factory for named columns
            self.cursor = self.conn.cursor()
            return True
        except sqlite3.Error as e:
            print(f"Error connecting to database: {e}")
            return False

    def close(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()

    def init_db(self):
        """Initialize database with schema"""
        try:
            # Use absolute path to schema file
            current_dir = os.path.dirname(os.path.abspath(__file__))
            schema_path = os.path.join(current_dir, 'schema.sql')
            
            with open(schema_path, 'r') as schema_file:
                schema = schema_file.read()
                self.cursor.executescript(schema)
                self.conn.commit()
            return True
        except sqlite3.Error as e:
            print(f"Error initializing database: {e}")
            return False
        except IOError as e:
            print(f"Error reading schema file: {e}")
            return False

    # User operations
    def create_user(self, username, email, password_hash):
        """Create a new user"""
        try:
            self.cursor.execute("""
                INSERT INTO users (username, email, password_hash)
                VALUES (?, ?, ?)
            """, (username, email, password_hash))
            self.conn.commit()
            return self.cursor.lastrowid
        except sqlite3.Error as e:
            print(f"Error creating user: {e}")
            return None

    def get_user(self, username=None, email=None):
        """Get user by username or email"""
        try:
            if username:
                self.cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
            elif email:
                self.cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
            result = self.cursor.fetchone()
            return dict(result) if result else None
        except sqlite3.Error as e:
            print(f"Error fetching user: {e}")
            return None

    # Profile operations
    def create_profile(self, user_id, display_name=None, bio=None, avatar_url=None):
        """Create a user profile"""
        try:
            self.cursor.execute("""
                INSERT INTO profiles (user_id, display_name, bio, avatar_url)
                VALUES (?, ?, ?, ?)
            """, (user_id, display_name, bio, avatar_url))
            self.conn.commit()
            return self.cursor.lastrowid
        except sqlite3.Error as e:
            print(f"Error creating profile: {e}")
            return None

    # Artwork operations
    def create_artwork(self, user_id, title, image_url, description=None, tags=None, category=None):
        """Create a new artwork entry"""
        try:
            tags_json = json.dumps(tags) if tags else None
            self.cursor.execute("""
                INSERT INTO artworks (user_id, title, image_url, description, tags, category)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (user_id, title, image_url, description, tags_json, category))
            self.conn.commit()
            return self.cursor.lastrowid
        except sqlite3.Error as e:
            print(f"Error creating artwork: {e}")
            return None

    def get_artworks(self, user_id=None, limit=10, offset=0):
        """Get artworks with optional user filter"""
        try:
            if user_id:
                self.cursor.execute("""
                    SELECT a.*, u.username, p.display_name
                    FROM artworks a
                    JOIN users u ON a.user_id = u.user_id
                    LEFT JOIN profiles p ON u.user_id = p.user_id
                    WHERE a.user_id = ? 
                    ORDER BY a.created_at DESC 
                    LIMIT ? OFFSET ?
                """, (user_id, limit, offset))
            else:
                self.cursor.execute("""
                    SELECT a.*, u.username, p.display_name
                    FROM artworks a
                    JOIN users u ON a.user_id = u.user_id
                    LEFT JOIN profiles p ON u.user_id = p.user_id
                    ORDER BY a.created_at DESC 
                    LIMIT ? OFFSET ?
                """, (limit, offset))
            
            results = self.cursor.fetchall()
            artworks = []
            for row in results:
                artwork = dict(row)
                if artwork['tags']:
                    artwork['tags'] = json.loads(artwork['tags'])
                artworks.append(artwork)
            return artworks
        except sqlite3.Error as e:
            print(f"Error fetching artworks: {e}")
            return []

    # Like operations
    def toggle_like(self, user_id, artwork_id):
        """Toggle like status for an artwork"""
        try:
            # Check if like exists
            self.cursor.execute("""
                SELECT 1 FROM likes 
                WHERE user_id = ? AND artwork_id = ?
            """, (user_id, artwork_id))
            
            if self.cursor.fetchone():
                # Unlike
                self.cursor.execute("""
                    DELETE FROM likes 
                    WHERE user_id = ? AND artwork_id = ?
                """, (user_id, artwork_id))
                
                self.cursor.execute("""
                    UPDATE artworks 
                    SET likes_count = likes_count - 1 
                    WHERE artwork_id = ?
                """, (artwork_id,))
            else:
                # Like
                self.cursor.execute("""
                    INSERT INTO likes (user_id, artwork_id) 
                    VALUES (?, ?)
                """, (user_id, artwork_id))
                
                self.cursor.execute("""
                    UPDATE artworks 
                    SET likes_count = likes_count + 1 
                    WHERE artwork_id = ?
                """, (artwork_id,))
            
            self.conn.commit()
            return True
        except sqlite3.Error as e:
            print(f"Error toggling like: {e}")
            return False

    def check_like(self, user_id, artwork_id):
        """Check if a user has liked an artwork"""
        try:
            self.cursor.execute("""
                SELECT 1 FROM likes 
                WHERE user_id = ? AND artwork_id = ?
            """, (user_id, artwork_id))
            return bool(self.cursor.fetchone())
        except sqlite3.Error as e:
            print(f"Error checking like: {e}")
            return False

def init_database():
    """Initialize the database"""
    db = Database()
    
    # Create database directory if it doesn't exist
    os.makedirs(os.path.dirname(db.db_path), exist_ok=True)
    
    # Connect to database
    if not db.connect():
        return False
    
    # Initialize schema
    success = db.init_db()
    
    # Close connection
    db.close()
    
    return success

if __name__ == "__main__":
    if init_database():
        print("Database initialized successfully!")
        print(f"Database created at: {os.path.abspath(Database().db_path)}")
    else:
        print("Error initializing database")
