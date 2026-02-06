#!/usr/bin/env python3
"""
MongoDB to PostgreSQL Data Copy Script
Copies all soldiers and messages from MongoDB to PostgreSQL
"""

from pymongo import MongoClient
import psycopg2
from psycopg2.extras import execute_values
from datetime import datetime
import json

# ==================== CONFIGURATION ====================
MONGO_URI = "mongodb://localhost:27017/"
MONGO_DB = "himalayan_mesh"

PG_HOST = "localhost"
PG_PORT = 5432
PG_USER = "postgres"
PG_PASSWORD = "DarkSister"  # CHANGE THIS
PG_DB = "himalayan_mesh"
# =======================================================

def connect_mongo():
    """Connect to MongoDB"""
    client = MongoClient(MONGO_URI)
    db = client[MONGO_DB]
    print("✅ MongoDB Connected")
    return db

def connect_postgres():
    """Connect to PostgreSQL"""
    conn = psycopg2.connect(
        host=PG_HOST,
        port=PG_PORT,
        user=PG_USER,
        password=PG_PASSWORD,
        database=PG_DB
    )
    print("✅ PostgreSQL Connected")
    return conn

def copy_soldiers(mongo_db, pg_conn):
    """Copy soldiers from MongoDB to PostgreSQL"""
    print("\n📊 Copying Soldiers...")
    
    soldiers = list(mongo_db.soldiers.find())
    print(f"Found {len(soldiers)} soldiers in MongoDB")
    
    if len(soldiers) == 0:
        print("No soldiers to copy")
        return 0
    
    cursor = pg_conn.cursor()
    success = 0
    
    for soldier in soldiers:
        try:
            query = """
                INSERT INTO soldiers (
                    soldier_id, name, unit, post,
                    latitude, longitude, altitude,
                    public_key, private_key,
                    battery_level, status, signal_strength,
                    connected_to, last_seen, created_at, updated_at, mongo_id
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (soldier_id) DO UPDATE SET
                    name = EXCLUDED.name,
                    battery_level = EXCLUDED.battery_level,
                    status = EXCLUDED.status,
                    latitude = EXCLUDED.latitude,
                    longitude = EXCLUDED.longitude,
                    updated_at = EXCLUDED.updated_at
            """
            
            values = (
                soldier.get('soldierId'),
                soldier.get('name'),
                soldier.get('unit'),
                soldier.get('post'),
                soldier.get('position', {}).get('latitude'),
                soldier.get('position', {}).get('longitude'),
                soldier.get('position', {}).get('altitude', 0),
                soldier.get('publicKey'),
                soldier.get('privateKey', ''),
                soldier.get('batteryLevel', 100),
                soldier.get('status', 'active'),
                soldier.get('signalStrength', 100),
                soldier.get('connectedTo', []),
                soldier.get('lastSeen', datetime.now()),
                soldier.get('createdAt', datetime.now()),
                soldier.get('updatedAt', datetime.now()),
                str(soldier.get('_id'))
            )
            
            cursor.execute(query, values)
            success += 1
            print(f"\r✅ Copied: {success}/{len(soldiers)}", end='')
            
        except Exception as e:
            print(f"\n❌ Error copying {soldier.get('soldierId')}: {e}")
    
    pg_conn.commit()
    cursor.close()
    print(f"\n✅ Soldiers copied: {success}")
    return success

def copy_messages(mongo_db, pg_conn):
    """Copy messages from MongoDB to PostgreSQL"""
    print("\n📨 Copying Messages...")
    
    messages = list(mongo_db.messages.find())
    print(f"Found {len(messages)} messages in MongoDB")
    
    if len(messages) == 0:
        print("No messages to copy")
        return 0
    
    cursor = pg_conn.cursor()
    success = 0
    
    for msg in messages:
        try:
            # Insert message
            query = """
                INSERT INTO messages (
                    message_id, from_soldier, to_soldier,
                    encrypted_content, encrypted_aes_key, signature,
                    image_data, has_image,
                    priority, message_type,
                    hop_count, delivered, delivered_at, failed_attempts,
                    expires_at, created_at, updated_at, mongo_id
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (message_id) DO NOTHING
            """
            
            values = (
                msg.get('messageId'),
                msg.get('from'),
                msg.get('to'),
                msg.get('encryptedContent'),
                msg.get('encryptedAESKey'),
                msg.get('signature'),
                msg.get('imageData'),
                msg.get('hasImage', False),
                msg.get('priority', 'medium'),
                msg.get('messageType', 'general'),
                msg.get('hopCount', 0),
                msg.get('delivered', False),
                msg.get('deliveredAt'),
                msg.get('failedAttempts', 0),
                msg.get('expiresAt', datetime.now()),
                msg.get('createdAt', datetime.now()),
                msg.get('updatedAt', datetime.now()),
                str(msg.get('_id'))
            )
            
            cursor.execute(query, values)
            
            # Insert message routes
            if 'path' in msg and msg['path']:
                for idx, hop in enumerate(msg['path']):
                    route_query = """
                        INSERT INTO message_routes (message_id, soldier_id, hop_number, battery_level, timestamp)
                        VALUES (%s, %s, %s, %s, %s)
                        ON CONFLICT DO NOTHING
                    """
                    
                    if isinstance(hop, dict):
                        soldier_id = hop.get('soldierId')
                        battery = hop.get('batteryLevel')
                        timestamp = hop.get('timestamp', datetime.now())
                    else:
                        soldier_id = hop
                        battery = None
                        timestamp = datetime.now()
                    
                    cursor.execute(route_query, (
                        msg.get('messageId'),
                        soldier_id,
                        idx + 1,
                        battery,
                        timestamp
                    ))
            
            success += 1
            print(f"\r✅ Copied: {success}/{len(messages)}", end='')
            
        except Exception as e:
            print(f"\n❌ Error copying {msg.get('messageId')}: {e}")
    
    pg_conn.commit()
    cursor.close()
    print(f"\n✅ Messages copied: {success}")
    return success

def verify_copy(mongo_db, pg_conn):
    """Verify the copy was successful"""
    print("\n🔍 Verifying Copy...")
    
    cursor = pg_conn.cursor()
    
    # Count soldiers
    mongo_soldiers = mongo_db.soldiers.count_documents({})
    cursor.execute("SELECT COUNT(*) FROM soldiers")
    pg_soldiers = cursor.fetchone()[0]
    
    # Count messages
    mongo_messages = mongo_db.messages.count_documents({})
    cursor.execute("SELECT COUNT(*) FROM messages")
    pg_messages = cursor.fetchone()[0]
    
    cursor.close()
    
    print("═══════════════════════════════════════")
    print(f"MongoDB Soldiers:     {mongo_soldiers}")
    print(f"PostgreSQL Soldiers:  {pg_soldiers}")
    print(f"Match: {'✅' if mongo_soldiers == pg_soldiers else '❌'}")
    print("───────────────────────────────────────")
    print(f"MongoDB Messages:     {mongo_messages}")
    print(f"PostgreSQL Messages:  {pg_messages}")
    print(f"Match: {'✅' if mongo_messages == pg_messages else '❌'}")
    print("═══════════════════════════════════════")
    
    return mongo_soldiers == pg_soldiers and mongo_messages == pg_messages

def main():
    """Main function"""
    print("╔════════════════════════════════════════╗")
    print("║  MongoDB → PostgreSQL Copy Script     ║")
    print("╚════════════════════════════════════════╝")
    
    try:
        # Connect to databases
        mongo_db = connect_mongo()
        pg_conn = connect_postgres()
        
        # Copy data
        soldiers_copied = copy_soldiers(mongo_db, pg_conn)
        messages_copied = copy_messages(mongo_db, pg_conn)
        
        # Verify
        verified = verify_copy(mongo_db, pg_conn)
        
        # Close connections
        pg_conn.close()
        
        print("\n╔════════════════════════════════════════╗")
        print("║          COPY COMPLETE                 ║")
        print("╚════════════════════════════════════════╝")
        print(f"✅ Soldiers: {soldiers_copied}")
        print(f"✅ Messages: {messages_copied}")
        print(f"{'✅ Verification: PASSED' if verified else '❌ Verification: FAILED'}")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()