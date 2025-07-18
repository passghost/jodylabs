from flask import Flask, request, jsonify, render_template, session, redirect, url_for
from database.db_init import Database
import bcrypt
import os
from functools import wraps

app = Flask(__name__, 
    static_folder='static',
    template_folder='templates'
)

# Set a secret key for session management
app.secret_key = os.urandom(24)

# Database instance
db = Database()

# Authentication decorator
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated_function

# Routes
@app.route('/')
def home():
    return render_template('index.html')

@app.route('/api/check-auth')
def check_auth():
    return jsonify({
        'authenticated': 'user_id' in session,
        'user_id': session.get('user_id')
    })

@app.route('/api/logout')
def logout():
    session.pop('user_id', None)
    return jsonify({'message': 'Logged out successfully'})

@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    
    if not all(k in data for k in ['username', 'email', 'password']):
        return jsonify({'error': 'Missing required fields'}), 400
    
    # Hash password
    hashed = bcrypt.hashpw(data['password'].encode('utf-8'), bcrypt.gensalt())
    
    # Connect to database
    db.connect()
    
    try:
        # Create user
        user_id = db.create_user(data['username'], data['email'], hashed)
        if not user_id:
            return jsonify({'error': 'Username or email already exists'}), 400
        
        # Create profile
        profile_id = db.create_profile(
            user_id=user_id,
            display_name=data.get('display_name', data['username'])
        )
        
        # Set session
        session['user_id'] = user_id
        
        return jsonify({
            'message': 'User registered successfully',
            'user_id': user_id
        }), 201
        
    finally:
        db.close()

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    
    if not all(k in data for k in ['username', 'password']):
        return jsonify({'error': 'Missing required fields'}), 400
    
    # Connect to database
    db.connect()
    
    try:
        # Get user
        user = db.get_user(username=data['username'])
        if not user:
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Check password
        if not bcrypt.checkpw(data['password'].encode('utf-8'), user['password_hash']):
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Set session
        session['user_id'] = user['user_id']
        
        return jsonify({
            'message': 'Login successful',
            'user_id': user['user_id']
        })
        
    finally:
        db.close()

@app.route('/api/artwork', methods=['POST'])
@login_required
def create_artwork():
    data = request.get_json()
    
    if not all(k in data for k in ['title', 'image_url']):
        return jsonify({'error': 'Missing required fields'}), 400
    
    # Connect to database
    db.connect()
    
    try:
        # Create artwork
        artwork_id = db.create_artwork(
            user_id=session['user_id'],
            title=data['title'],
            image_url=data['image_url'],
            description=data.get('description'),
            tags=data.get('tags'),
            category=data.get('category')
        )
        
        if not artwork_id:
            return jsonify({'error': 'Failed to create artwork'}), 500
        
        return jsonify({
            'message': 'Artwork created successfully',
            'artwork_id': artwork_id
        }), 201
        
    finally:
        db.close()

@app.route('/api/artwork', methods=['GET'])
def get_artworks():
    # Get query parameters
    user_id = request.args.get('user_id', type=int)
    limit = request.args.get('limit', 10, type=int)
    offset = request.args.get('offset', 0, type=int)
    
    # Connect to database
    db.connect()
    
    try:
        # Get artworks
        artworks = db.get_artworks(user_id, limit, offset)
        
        # Add liked status if user is logged in
        if 'user_id' in session:
            for artwork in artworks:
                artwork['liked'] = db.check_like(session['user_id'], artwork['artwork_id'])
        
        return jsonify({
            'artworks': artworks,
            'count': len(artworks)
        })
        
    finally:
        db.close()

@app.route('/api/artwork/<int:artwork_id>/like', methods=['POST'])
@login_required
def toggle_like(artwork_id):
    # Connect to database
    db.connect()
    
    try:
        # Toggle like
        success = db.toggle_like(session['user_id'], artwork_id)
        
        if not success:
            return jsonify({'error': 'Failed to toggle like'}), 500
        
        return jsonify({'message': 'Like toggled successfully'})
        
    finally:
        db.close()

if __name__ == '__main__':
    app.run(debug=True)
