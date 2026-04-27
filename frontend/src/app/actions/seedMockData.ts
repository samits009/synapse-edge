"use server";

import { db } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { verifyAuthToken } from "@/lib/security";

/* ========================================================================
   SynapseEdge — Mock Field Report Seeder (Hardened)
   ========================================================================
   Inserts realistic crisis field reports into Firestore for demo purposes.
   Auth-gated so only logged-in operators can seed.
   ======================================================================== */

const MOCK_REPORTS = [
  {
    raw_text:
      "Severe flooding in Sector 12 — water levels have risen 4 feet in the last 2 hours. Multiple families trapped on rooftops near the Gomti River bridge. We need rescue boats and trained swimmers immediately. At least 30 people including elderly and children. Medical supplies also needed — some are showing signs of hypothermia.",
    status: "incoming",
    location_lat: 26.8467,
    location_lng: 80.9462,
    urgency: 5,
  },
  {
    raw_text:
      "Field hospital at Camp Bravo is overwhelmed. We have 47 patients and only 2 doctors remaining after shift change. Running critically low on IV fluids, bandages, and antibiotics. Need at least 3 more medical volunteers and a supply drop within the hour. Trauma cases increasing from building collapse debris.",
    status: "incoming",
    location_lat: 26.9124,
    location_lng: 80.9563,
    urgency: 5,
  },
  {
    raw_text:
      "Communication tower at Grid Point Echo-7 went dark 45 minutes ago. Mesh network coverage dropped 40% in the eastern corridor. We've lost contact with 3 field squads. Need a telecom engineer and portable satellite uplink equipment. Secondary repeater at the school building may still be salvageable.",
    status: "incoming",
    location_lat: 26.7891,
    location_lng: 80.8734,
    urgency: 4,
  },
  {
    raw_text:
      "Food distribution point at Lucknow Central Park has been overrun. Crowd of approximately 500 has gathered but we only have rations for 200. Need crowd management volunteers, additional food supplies, and someone who speaks Hindi and Urdu to coordinate. Situation is tense but non-violent so far.",
    status: "incoming",
    location_lat: 26.8508,
    location_lng: 80.9423,
    urgency: 4,
  },
  {
    raw_text:
      "Structural engineer needed URGENTLY. Three-story apartment building at 14 Hazratganj Road showing severe cracks after aftershock. Approximately 60 residents refuse to evacuate without professional assessment. Building may be at risk of partial collapse. Need structural assessment team and evacuation transport.",
    status: "incoming",
    location_lat: 26.8535,
    location_lng: 80.9468,
    urgency: 5,
  },
  {
    raw_text:
      "Clean water contamination detected at the Amausi bore well supplying Sector 9 relief camp. Testing shows E. coli levels above safe thresholds. 300+ displaced persons relying on this source. Need water purification tablets, portable filtration units, and a public health specialist to assess scope of exposure.",
    status: "incoming",
    location_lat: 26.7594,
    location_lng: 80.8894,
    urgency: 4,
  },
  {
    raw_text:
      "Search and rescue operation needed at collapsed warehouse near Charbagh station. Local witnesses report at least 8 workers were inside during the earthquake. We have removed some debris manually but need heavy equipment and trained rescue dogs. Time is critical — last voice contact was 2 hours ago.",
    status: "incoming",
    location_lat: 26.8555,
    location_lng: 80.9191,
    urgency: 5,
  },
  {
    raw_text:
      "Road blockage on NH-27 near Barabanki interchange. Large tree fell across both lanes, completely blocking the primary relief supply route. Convoy of 12 trucks carrying medical supplies and tarpaulins is stuck. Need chainsaw team and traffic management. Alternate routes are flooded.",
    status: "incoming",
    location_lat: 26.9297,
    location_lng: 81.1762,
    urgency: 3,
  },
  {
    raw_text:
      "Elderly care facility in Gomti Nagar has lost power for 18 hours. 24 residents including 6 on oxygen concentrators running on backup batteries that will die in approximately 3 hours. Need portable generators, fuel, and an electrician to restore mains connection. Medical team on standby requested.",
    status: "incoming",
    location_lat: 26.8563,
    location_lng: 81.0144,
    urgency: 5,
  },
  {
    raw_text:
      "Volunteer coordination center at Indira Nagar community hall requests logistics support. We have 200+ registered volunteers but no systematic assignment. Need someone experienced in crisis coordination to set up shift rotations, skill mapping, and deployment protocols. Also need 50 hi-vis vests and ID badges.",
    status: "incoming",
    location_lat: 26.8726,
    location_lng: 81.0012,
    urgency: 2,
  },
  {
    raw_text:
      "Drone surveillance over Sector 14 shows a large group of displaced persons (est. 150-200) setting up informal camp near railway tracks. No sanitation, no shelter material, no organized aid. Children and pregnant women observed. Need ground team with tents, hygiene kits, and registration coordinators.",
    status: "incoming",
    location_lat: 26.8101,
    location_lng: 80.9278,
    urgency: 4,
  },
  {
    raw_text:
      "Gas leak reported at the LPG distribution point in Alambagh. Area has been cordoned off but 3 cylinders are still unaccounted for. Residents within 500m radius need temporary relocation. Need hazmat team, fire safety unit, and temporary shelter for approximately 80 displaced families.",
    status: "incoming",
    location_lat: 26.8187,
    location_lng: 80.9101,
    urgency: 5,
  },
];

export async function seedMockReports(idToken: string): Promise<{ success: boolean; count?: number; error?: string }> {
  const authResult = await verifyAuthToken(idToken);
  if (!authResult) return { success: false, error: "Unauthorized" };

  try {
    const batch = db.batch();
    let count = 0;

    const numToSeed = Math.floor(Math.random() * 2) + 3; // 3 or 4
    const shuffled = [...MOCK_REPORTS].sort(() => 0.5 - Math.random());
    const selectedReports = shuffled.slice(0, numToSeed);

    for (const report of selectedReports) {
      const ref = db.collection("field_tasks").doc();
      batch.set(ref, {
        ...report,
        rawText: report.raw_text,
        createdAt: FieldValue.serverTimestamp(),
      });
      count++;
    }

    await batch.commit();
    return { success: true, count };
  } catch {
    return { success: false, error: "Failed to seed reports." };
  }
}
