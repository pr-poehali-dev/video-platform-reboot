import json
import os
from typing import Dict, Any
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Manage channel information - get details, update profile
    Args: event with httpMethod, body containing channel updates
          context with request_id
    Returns: HTTP response with channel data
    '''
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
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
            channel_id = query_params.get('channel_id')
            
            if channel_id:
                cur.execute('''
                    SELECT c.id, c.user_id, c.name as channel_name, c.description, 
                           c.avatar_url, c.banner_url, c.is_verified, 
                           c.subscribers_count, c.created_at,
                           (SELECT COUNT(*) FROM videos WHERE channel_id = c.id) as videos_count
                    FROM channels c
                    WHERE c.id = %s
                ''', (channel_id,))
            elif user_id:
                cur.execute('''
                    SELECT c.id, c.user_id, c.name as channel_name, c.description, 
                           c.avatar_url, c.banner_url, c.is_verified, 
                           c.subscribers_count, c.created_at,
                           (SELECT COUNT(*) FROM videos WHERE channel_id = c.id) as videos_count
                    FROM channels c
                    WHERE c.user_id = CAST(%s AS INTEGER)
                ''', (user_id,))
            else:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'channel_id or user authentication required'})
                }
            
            channel = cur.fetchone()
            
            if not channel:
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Channel not found'})
                }
            
            channel_dict = dict(channel)
            if 'created_at' in channel_dict and isinstance(channel_dict['created_at'], datetime):
                channel_dict['created_at'] = channel_dict['created_at'].isoformat()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'channel': channel_dict})
            }
        
        if method == 'PUT':
            if not user_id:
                return {
                    'statusCode': 401,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Authentication required'})
                }
            
            body_data = json.loads(event.get('body', '{}'))
            
            channel_name = body_data.get('channel_name')
            description = body_data.get('description')
            avatar_url = body_data.get('avatar_url')
            banner_url = body_data.get('banner_url')
            
            update_fields = []
            values = []
            
            if channel_name:
                update_fields.append('name = %s')
                values.append(channel_name)
            if description is not None:
                update_fields.append('description = %s')
                values.append(description)
            if avatar_url:
                update_fields.append('avatar_url = %s')
                values.append(avatar_url)
            if banner_url:
                update_fields.append('banner_url = %s')
                values.append(banner_url)
            
            if not update_fields:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'No fields to update'})
                }
            
            values.append(user_id)
            
            query = f'''
                UPDATE channels 
                SET {', '.join(update_fields)}
                WHERE user_id = CAST(%s AS INTEGER)
                RETURNING id, name as channel_name, description, avatar_url, banner_url, 
                          is_verified, subscribers_count
            '''
            
            cur.execute(query, values)
            updated_channel = cur.fetchone()
            
            if not updated_channel:
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Channel not found'})
                }
            
            conn.commit()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'message': 'Channel updated successfully',
                    'channel': dict(updated_channel)
                })
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