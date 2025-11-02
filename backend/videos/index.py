import json
import os
import base64
from typing import Dict, Any
import psycopg2
import psycopg2.extras

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Video upload and management
    Args: event with httpMethod, body (video data, thumbnail, metadata)
    Returns: HTTP response with video data or list of videos
    '''
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Channel-Id',
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
        
        if method == 'GET':
            cur.execute("""
                SELECT v.id, v.title, v.description, v.thumbnail_url, v.video_url, 
                       v.duration, v.views_count, v.likes_count, v.video_type, v.created_at,
                       c.name as channel_name, c.is_verified
                FROM videos v
                LEFT JOIN channels c ON v.channel_id = c.id
                ORDER BY v.created_at DESC
                LIMIT 50
            """)
            
            videos = []
            for row in cur.fetchall():
                videos.append({
                    'id': row[0],
                    'title': row[1],
                    'description': row[2],
                    'thumbnail_url': row[3],
                    'video_url': row[4],
                    'duration': row[5],
                    'views_count': row[6],
                    'likes_count': row[7],
                    'video_type': row[8],
                    'created_at': row[9].isoformat() if row[9] else None,
                    'channel_name': row[10],
                    'is_verified': row[11]
                })
            
            cur.close()
            conn.close()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'videos': videos}),
                'isBase64Encoded': False
            }
        
        elif method == 'POST':
            body_data = json.loads(event.get('body', '{}'))
            
            channel_id = body_data.get('channel_id')
            title = body_data.get('title')
            description = body_data.get('description', '')
            video_url = body_data.get('video_url')
            thumbnail_url = body_data.get('thumbnail_url')
            duration = body_data.get('duration', 0)
            video_type = body_data.get('video_type', 'regular')
            
            if not channel_id or not title or not video_url:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Missing required fields'}),
                    'isBase64Encoded': False
                }
            
            cur.execute(
                """INSERT INTO videos (channel_id, title, description, video_url, thumbnail_url, duration, video_type)
                   VALUES (%s, %s, %s, %s, %s, %s, %s)
                   RETURNING id, title, description, video_url, thumbnail_url, duration, video_type, views_count, likes_count""",
                (channel_id, title, description, video_url, thumbnail_url, duration, video_type)
            )
            
            video = cur.fetchone()
            conn.commit()
            cur.close()
            conn.close()
            
            return {
                'statusCode': 201,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'video': {
                        'id': video[0],
                        'title': video[1],
                        'description': video[2],
                        'video_url': video[3],
                        'thumbnail_url': video[4],
                        'duration': video[5],
                        'video_type': video[6],
                        'views_count': video[7],
                        'likes_count': video[8]
                    }
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