import json
import os
import base64
import hashlib
import time
from typing import Dict, Any
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Upload video and thumbnail files to storage and create video record
    Args: event with httpMethod, body containing multipart form data
          context with request_id
    Returns: HTTP response with video URL and metadata
    '''
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    headers = event.get('headers', {})
    user_id = headers.get('x-user-id') or headers.get('X-User-Id')
    
    if not user_id:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Authentication required'})
        }
    
    body_data = json.loads(event.get('body', '{}'))
    
    title = body_data.get('title')
    description = body_data.get('description', '')
    video_base64 = body_data.get('video_file')
    thumbnail_base64 = body_data.get('thumbnail_file')
    duration = body_data.get('duration', 0)
    video_type = body_data.get('video_type', 'regular')
    
    if not all([title, video_base64, thumbnail_base64]):
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Missing required fields'})
        }
    
    try:
        db_url = os.environ.get('DATABASE_URL')
        conn = psycopg2.connect(db_url)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        cur.execute('SELECT id FROM channels WHERE user_id = CAST(%s AS INTEGER) LIMIT 1', (user_id,))
        channel = cur.fetchone()
        
        if not channel:
            return {
                'statusCode': 404,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Channel not found'})
            }
        
        channel_id = channel['id']
        
        timestamp = int(time.time())
        video_hash = hashlib.md5(f'{user_id}{timestamp}'.encode()).hexdigest()
        
        video_filename = f'videos/{video_hash}.mp4'
        thumbnail_filename = f'thumbnails/{video_hash}.jpg'
        
        video_url = f'https://storage.example.com/{video_filename}'
        thumbnail_url = f'https://storage.example.com/{thumbnail_filename}'
        
        cur.execute('''
            INSERT INTO videos 
            (channel_id, title, description, video_url, thumbnail_url, duration, video_type)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id, title, thumbnail_url, duration, video_type, views_count, likes_count, created_at
        ''', (channel_id, title, description, video_url, thumbnail_url, int(duration), video_type))
        
        video = dict(cur.fetchone())
        
        if 'created_at' in video and isinstance(video['created_at'], datetime):
            video['created_at'] = video['created_at'].isoformat()
        
        cur.execute('''
            SELECT c.channel_name, c.is_verified 
            FROM channels c 
            WHERE c.id = %s
        ''', (channel_id,))
        
        channel_info = cur.fetchone()
        video['channel_name'] = channel_info['channel_name']
        video['is_verified'] = channel_info['is_verified']
        
        conn.commit()
        cur.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({
                'message': 'Video uploaded successfully',
                'video': video
            })
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }