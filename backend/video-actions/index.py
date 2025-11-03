import json
import os
from typing import Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Handle video actions - like, dislike, view count, subscriptions
    Args: event with httpMethod, body containing action type and video/channel ID
          context with request_id
    Returns: HTTP response with updated counts
    '''
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    headers = event.get('headers', {})
    user_id = headers.get('x-user-id') or headers.get('X-User-Id')
    
    db_url = os.environ.get('DATABASE_URL')
    conn = psycopg2.connect(db_url)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        if method == 'GET':
            query_params = event.get('queryStringParameters', {})
            action = query_params.get('action')
            video_id = query_params.get('video_id')
            channel_id = query_params.get('channel_id')
            
            if action == 'check_subscription' and user_id and channel_id:
                cur.execute('''
                    SELECT id FROM subscriptions 
                    WHERE user_id = %s AND channel_id = %s
                ''', (user_id, channel_id))
                is_subscribed = cur.fetchone() is not None
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'is_subscribed': is_subscribed})
                }
            
            if action == 'check_like' and user_id and video_id:
                cur.execute('''
                    SELECT is_like FROM video_likes 
                    WHERE user_id = %s AND video_id = %s
                ''', (user_id, video_id))
                like_record = cur.fetchone()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        'liked': like_record['is_like'] if like_record else None
                    })
                }
            
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Invalid action'})
            }
        
        if method == 'POST':
            if not user_id:
                return {
                    'statusCode': 401,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Authentication required'})
                }
            
            body_data = json.loads(event.get('body', '{}'))
            action = body_data.get('action')
            video_id = body_data.get('video_id')
            channel_id = body_data.get('channel_id')
            
            if action == 'like':
                cur.execute('''
                    INSERT INTO video_likes (user_id, video_id, is_like)
                    VALUES (%s, %s, true)
                    ON CONFLICT (user_id, video_id) 
                    DO UPDATE SET is_like = true
                ''', (user_id, video_id))
                
                cur.execute('''
                    UPDATE videos SET 
                        likes_count = (SELECT COUNT(*) FROM video_likes WHERE video_id = %s AND is_like = true),
                        dislikes_count = (SELECT COUNT(*) FROM video_likes WHERE video_id = %s AND is_like = false)
                    WHERE id = %s
                    RETURNING likes_count, dislikes_count
                ''', (video_id, video_id, video_id))
                
                counts = cur.fetchone()
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        'likes_count': counts['likes_count'],
                        'dislikes_count': counts['dislikes_count']
                    })
                }
            
            if action == 'dislike':
                cur.execute('''
                    INSERT INTO video_likes (user_id, video_id, is_like)
                    VALUES (%s, %s, false)
                    ON CONFLICT (user_id, video_id) 
                    DO UPDATE SET is_like = false
                ''', (user_id, video_id))
                
                cur.execute('''
                    UPDATE videos SET 
                        likes_count = (SELECT COUNT(*) FROM video_likes WHERE video_id = %s AND is_like = true),
                        dislikes_count = (SELECT COUNT(*) FROM video_likes WHERE video_id = %s AND is_like = false)
                    WHERE id = %s
                    RETURNING likes_count, dislikes_count
                ''', (video_id, video_id, video_id))
                
                counts = cur.fetchone()
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        'likes_count': counts['likes_count'],
                        'dislikes_count': counts['dislikes_count']
                    })
                }
            
            if action == 'view':
                cur.execute('''
                    INSERT INTO video_views (user_id, video_id)
                    VALUES (%s, %s)
                ''', (user_id, video_id))
                
                cur.execute('''
                    UPDATE videos SET views_count = views_count + 1
                    WHERE id = %s
                    RETURNING views_count
                ''', (video_id,))
                
                result = cur.fetchone()
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'views_count': result['views_count']})
                }
            
            if action == 'subscribe':
                cur.execute('''
                    INSERT INTO subscriptions (user_id, channel_id)
                    VALUES (%s, %s)
                    ON CONFLICT (user_id, channel_id) DO NOTHING
                ''', (user_id, channel_id))
                
                cur.execute('''
                    UPDATE channels SET subscribers_count = (
                        SELECT COUNT(*) FROM subscriptions WHERE channel_id = %s
                    )
                    WHERE id = %s
                    RETURNING subscribers_count
                ''', (channel_id, channel_id))
                
                result = cur.fetchone()
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        'is_subscribed': True,
                        'subscribers_count': result['subscribers_count']
                    })
                }
            
            if action == 'unsubscribe':
                cur.execute('''
                    DELETE FROM subscriptions 
                    WHERE user_id = %s AND channel_id = %s
                ''', (user_id, channel_id))
                
                cur.execute('''
                    UPDATE channels SET subscribers_count = (
                        SELECT COUNT(*) FROM subscriptions WHERE channel_id = %s
                    )
                    WHERE id = %s
                    RETURNING subscribers_count
                ''', (channel_id, channel_id))
                
                result = cur.fetchone()
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        'is_subscribed': False,
                        'subscribers_count': result['subscribers_count']
                    })
                }
            
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Invalid action'})
            }
        
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'})
        }
        
    except Exception as e:
        conn.rollback()
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }
    finally:
        cur.close()
        conn.close()
