import asyncio
import sys
import os

# Add backend to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.embedding_service import get_embedding_service
from app.models.task import TaskIngestRequest

async def main():
    print("=" * 60)
    print("🧠 SynapseEdge — Project Cortex Demo Pipeline")
    print("=" * 60)
    
    # 1. Simulate Edge Capture (Android)
    raw_text = """Village: Rampur Block C
Need immediate medical supplies — 3 children with high fever,
no clean drinking water since Tuesday. The hand pump broke.
Priority: VERY URGENT"""
    print(f"\n[EDGE] 📝 Captured Raw Field Note:\n{raw_text}")
    
    # 2. Simulate Intent Extraction (Gemini Nano)
    print(f"\n[EDGE] 🤖 Running AI Intent Extraction (Gemini Nano)...")
    intent = "medical_supply_request"
    urgency = 4
    skills = ["medical_first_aid", "plumbing", "water_systems"]
    description = "Urgent medical supplies needed for children with high fever. Water hand pump is broken, requiring plumbing repair."
    
    task = TaskIngestRequest(
        raw_text=raw_text,
        intent=intent,
        urgency=urgency,
        skills_needed=skills,
        description=description,
        sync_hops=1
    )
    
    print(f"[EDGE] ✓ Generated Structured Task (ready for Mesh Sync):")
    print(task.model_dump_json(indent=2))
    
    # 3. Simulate Backend Embedding (Vertex AI)
    print(f"\n[BACKEND] 🔮 Cloud received task. Generating Vertex AI Embedding...")
    embed_service = get_embedding_service()
    vector = await embed_service.generate_embedding(description)
    
    print(f"[BACKEND] ✓ Generated {len(vector)}-dimensional embedding vector.")
    print(f"          Vector sample: [{vector[0]:.4f}, {vector[1]:.4f}, {vector[2]:.4f}, ...]")
    
    # 4. Simulate pgvector matching
    print(f"\n[BACKEND] 🎯 Querying pgvector for matching volunteers...")
    print(f"          Query: SELECT * FROM volunteers ORDER BY embedding <=> task_vector")
    
    print("""
    MATCH 1:
      Volunteer: Dr. Priya Sharma
      Bio: "...trauma surgeon... trained in water purification systems."
      Similarity: 0.842
      Why it matched (Latent Skills): 
        - "children with fever" → trauma surgeon/medical
        - "hand pump broken" → water purification
        
    MATCH 2:
      Volunteer: Marcus Chen
      Bio: "...can repair generators and solar panel systems..."
      Similarity: 0.615
      Why it matched (Latent Skills):
        - "plumbing repair" → mechanical repair/systems

[DASHBOARD] 📡 Syncing match events to Firebase Firestore...
""")

if __name__ == "__main__":
    asyncio.run(main())
