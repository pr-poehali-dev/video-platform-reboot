import json
import os
import hashlib
import secrets
from typing import Dict, Any
import psycopg2
import psycopg2.extras

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: User registration and authentication
    Args: event with httpMethod, body (username, email, password)
    Returns: HTTP response with user data or auth token
    '''
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Auth-Token',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Database not configured'}),
            'isBase64Encoded': False
        }
    
    try:
        conn = psycopg2.connect(database_url)
        cur = conn.cursor()
        
        if method == 'POST':
            body_data = json.loads(event.get('body', '{}'))
            action = body_data.get('action', 'login')
            
            if action == 'register':
                username = body_data.get('username')
                email = body_data.get('email')
                password = body_data.get('password')
                
                if not username or not email or not password:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Missing required fields'}),
                        'isBase64Encoded': False
                    }
                
                password_hash = hashlib.sha256(password.encode()).hexdigest()
                avatar_url = f'https://api.dicebear.com/7.x/avataaars/svg?seed={username}'
                
                cur.execute(
                    "INSERT INTO users (username, email, avatar_url) VALUES (%s, %s, %s) RETURNING id, username, email, avatar_url, is_admin",
                    (username, email, avatar_url)
                )
                user = cur.fetchone()
                
                cur.execute(
                    "INSERT INTO channels (user_id, name, description, avatar_url) VALUES (%s, %s, %s, %s) RETURNING id",
                    (user[0], f'Канал {username}', f'Канал пользователя {username}', avatar_url)
                )
                channel = cur.fetchone()
                
                conn.commit()
                
                auth_token = secrets.token_urlsafe(32)
                
                return {
                    'statusCode': 201,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        'user': {
                            'id': user[0],
                            'username': user[1],
                            'email': user[2],
                            'avatar_url': user[3],
                            'is_admin': user[4]
                        },
                        'channel_id': channel[0],
                        'auth_token': auth_token
                    }),
                    'isBase64Encoded': False
                }
            
            elif action == 'login':
                username = body_data.get('username')
                password = body_data.get('password')
                
                if not username or not password:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Missing credentials'}),
                        'isBase64Encoded': False
                    }
                
                cur.execute(
                    "SELECT u.id, u.username, u.email, u.avatar_url, u.is_admin, c.id FROM users u LEFT JOIN channels c ON c.user_id = u.id WHERE u.username = %s",
                    (username,)
                )
                user_data = cur.fetchone()
                
                if not user_data:
                    return {
                        'statusCode': 401,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Invalid credentials'}),
                        'isBase64Encoded': False
                    }
                
                auth_token = secrets.token_urlsafe(32)
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        'user': {
                            'id': user_data[0],
                            'username': user_data[1],
                            'email': user_data[2],
                            'avatar_url': user_data[3],
                            'is_admin': user_data[4]
                        },
                        'channel_id': user_data[5],
                        'auth_token': auth_token
                    }),
                    'isBase64Encoded': False
                }
        
        cur.close()
        conn.close()
        
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'}),
            'isBase64Encoded': False
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }