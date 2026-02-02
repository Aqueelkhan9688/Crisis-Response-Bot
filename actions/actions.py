# actions.py
from rasa_sdk import Action, Tracker
from rasa_sdk.executor import CollectingDispatcher
from rasa_sdk.events import SlotSet, FollowupAction
from typing import Text, List, Dict, Any
import requests
import json
from datetime import datetime
import logging

# Configure logging for error handling
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ActionValidateLocation(Action):
    """Validates and formats user location input"""
    def name(self) -> Text:
        return "action_validate_location"

    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        
        location = tracker.get_slot("user_location")
        
        if not location:
            dispatcher.utter_message(
                text="📍 Please provide your location (city or area). This helps us provide accurate emergency information."
            )
            return [FollowupAction("utter_ask_location")]
        
        # Simple validation - could be extended with geocoding API
        if len(location) < 2:
            dispatcher.utter_message(
                text="❓ Please provide a more specific location (e.g., 'Central Park, Manhattan' or 'Downtown Mumbai')."
            )
            return []
        
        dispatcher.utter_message(
            text=f"📍 Location confirmed: **{location}**. I'll use this for emergency services information."
        )
        return []

class ActionGeocodeAddress(Action):
    """Converts address to coordinates using OpenStreetMap"""
    def name(self) -> Text:
        return "action_geocode_address"

    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        
        location = tracker.get_slot("user_location")
        if not location:
            return []
        
        try:
            # Using OpenStreetMap Nominatim API (free tier)
            url = f"https://nominatim.openstreetmap.org/search?q={location}&format=json&limit=1"
            headers = {'User-Agent': 'EmergencyBot/1.0'}
            
            response = requests.get(url, headers=headers, timeout=5)
            
            if response.status_code == 200 and response.json():
                data = response.json()[0]
                lat = data['lat']
                lon = data['lon']
                
                # Store coordinates for API calls
                return [
                    SlotSet("latitude", lat),
                    SlotSet("longitude", lon),
                    SlotSet("location_verified", True)
                ]
                
        except Exception as e:
            logger.error(f"Geocoding error: {e}")
            # Continue without coordinates
        
        return [SlotSet("location_verified", False)]

class ActionAssessRisk(Action):
    """Enhanced risk assessment with adaptive questioning"""
    def name(self) -> Text:
        return "action_assess_risk"

    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        
        crisis_type = tracker.get_slot("crisis_type")
        severity = tracker.get_slot("severity")
        needs_medical = tracker.get_slot("needs_medical")
        user_location = tracker.get_slot("user_location")
        
        # Risk matrix calculation
        risk_scores = {
            "fire": {"low": "medium", "medium": "high", "high": "critical", "critical": "critical"},
            "earthquake": {"low": "medium", "medium": "high", "high": "critical", "critical": "critical"},
            "flood": {"low": "low", "medium": "medium", "high": "high", "critical": "critical"},
            "medical": {"low": "medium", "medium": "high", "high": "critical", "critical": "critical"},
            "accident": {"low": "medium", "medium": "high", "high": "critical", "critical": "critical"}
        }
        
        # Default risk level
        base_risk = risk_scores.get(crisis_type, {}).get(severity, "medium")
        
        # Escalate if medical needs
        if needs_medical:
            if base_risk in ["low", "medium"]:
                base_risk = "high"
            elif base_risk == "high":
                base_risk = "critical"
        
        # Safety override for critical situations
        if base_risk == "critical":
            dispatcher.utter_message(
                text=f"🚨 **CRITICAL ALERT** 🚨\n\n"
                     f"Risk Level: **{base_risk.upper()}**\n"
                     f"Crisis: {crisis_type}\n"
                     f"Location: {user_location}\n\n"
                     f"**IMMEDIATE ACTION REQUIRED:**\n"
                     f"1. Call emergency services (112) NOW\n"
                     f"2. Move to a safe location\n"
                     f"3. Follow safety protocols\n\n"
                     f"I will guide you while help is on the way."
            )
            return [
                SlotSet("risk_level", base_risk),
                FollowupAction("utter_safety_override")
            ]
        elif base_risk == "high":
            dispatcher.utter_message(
                text=f"⚠️ **HIGH RISK SITUATION**\n\n"
                     f"Assessment: {base_risk.upper()} risk detected\n"
                     f"Emergency: {crisis_type}\n\n"
                     f"**RECOMMENDED ACTIONS:**\n"
                     f"1. Stay alert and prepared to evacuate\n"
                     f"2. Keep emergency numbers ready\n"
                     f"3. Follow specific safety instructions"
            )
        else:
            dispatcher.utter_message(
                text=f"📊 **Risk Assessment Complete**\n"
                     f"Level: **{base_risk.upper()}**\n"
                     f"Please follow the safety guidelines provided."
            )
        
        return [SlotSet("risk_level", base_risk)]

class ActionFindShelters(Action):
    """Finds emergency shelters with external API integration"""
    def name(self) -> Text:
        return "action_find_shelters"

    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        
        location = tracker.get_slot("user_location")
        latitude = tracker.get_slot("latitude")
        longitude = tracker.get_slot("longitude")
        
        if not location:
            dispatcher.utter_message(
                text="❓ I need your location to find nearby shelters. Please provide your city or area."
            )
            return [FollowupAction("utter_ask_location")]
        
        try:
            # Example integration with OpenStreetMap/Overpass API for emergency facilities
            # In production, replace with actual emergency services API
            shelter_data = self._get_shelters_from_api(latitude, longitude)
            
            if shelter_data:
                message = f"🏠 **EMERGENCY SHELTERS NEAR {location.upper()}**\n\n"
                for i, shelter in enumerate(shelter_data[:3], 1):
                    message += f"{i}. **{shelter['name']}**\n"
                    message += f"   📍 {shelter['address']}\n"
                    message += f"   📞 {shelter.get('phone', 'Contact via 112')}\n"
                    message += f"   🚗 Distance: {shelter.get('distance', 'N/A')}\n\n"
                
                message += "**Evacuation Guidelines:**\n"
                message += "1. Take emergency kit\n2. Follow marked routes\n3. Help others if safe to do so\n4. Register at shelter"
                
                dispatcher.utter_message(text=message)
            else:
                dispatcher.utter_message(
                    text=f"📍 For shelters near **{location}**:\n"
                         f"1. Contact local emergency services (112)\n"
                         f"2. Check community centers, schools, or stadiums\n"
                         f"3. Follow official evacuation announcements\n\n"
                         f"Would you like me to search for other emergency services?"
                )
                
        except Exception as e:
            logger.error(f"Shelter API error: {e}")
            dispatcher.utter_message(
                text=f"⚠️ Shelter information temporarily unavailable for {location}.\n"
                     f"**Immediate Alternatives:**\n"
                     f"• Call emergency services (112) for shelter locations\n"
                     f"• Seek high ground (floods) or open spaces (earthquakes)\n"
                     f"• Move away from immediate danger zones"
            )
        
        return []

    def _get_shelters_from_api(self, lat, lon):
        """Mock API response - replace with actual API call"""
        # This is a placeholder for real API integration
        if lat and lon:
            return [
                {
                    "name": "Central Emergency Shelter",
                    "address": "123 Safety Ave, Downtown",
                    "phone": "112 (Emergency Services)",
                    "distance": "1.2 km"
                },
                {
                    "name": "Community Center Shelter",
                    "address": "456 Relief Street",
                    "phone": "Local: 555-0123",
                    "distance": "2.5 km"
                }
            ]
        return None

class ActionProvideInstructions(Action):
    """Provides crisis-specific verified instructions"""
    def name(self) -> Text:
        return "action_provide_instructions"

    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        
        crisis_type = tracker.get_slot("crisis_type")
        risk_level = tracker.get_slot("risk_level")
        
        # Verified emergency instructions database
        instructions_db = {
            "fire": {
                "title": "🔥 FIRE EMERGENCY PROCEDURES",
                "steps": [
                    "1. **ALERT OTHERS** - Shout 'Fire!' and activate alarms",
                    "2. **EVACUATE IMMEDIATELY** - Use nearest safe exit",
                    "3. **STAY LOW** - Crawl under smoke if necessary",
                    "4. **CHECK DOORS** - Feel door handles before opening",
                    "5. **MEET AT ASSEMBLY POINT** - Do not re-enter building",
                    "6. **CALL 112** - Once safe, report the fire"
                ],
                "donts": [
                    "× Do NOT use elevators",
                    "× Do NOT stop to collect belongings",
                    "× Do NOT re-enter for any reason"
                ]
            },
            "earthquake": {
                "title": "🌍 EARTHQUAKE SAFETY PROTOCOL",
                "steps": [
                    "1. **DROP, COVER, HOLD ON** - Immediate action",
                    "2. **STAY INDOORS** - If inside, stay there",
                    "3. **AVOID WINDOWS** - Move away from glass",
                    "4. **IF OUTSIDE** - Move to open area away from buildings",
                    "5. **IF DRIVING** - Pull over, stay in vehicle",
                    "6. **AFTER SHOCKS** - Check for injuries and hazards"
                ],
                "donts": [
                    "× Do NOT run outside during shaking",
                    "× Do NOT stand in doorways (modern advice)",
                    "× Do NOT use matches or lighters"
                ]
            },
            "flood": {
                "title": "🌊 FLOOD EMERGENCY GUIDANCE",
                "steps": [
                    "1. **MOVE TO HIGHER GROUND** - Immediately",
                    "2. **AVOID WALKING WATER** - 6 inches can knock you down",
                    "3. **TURN OFF UTILITIES** - If safe to do so",
                    "4. **EVACUATE IF ORDERED** - Follow official instructions",
                    "5. **STAY INFORMED** - Monitor emergency broadcasts",
                    "6. **AVOID FLOODWATERS** - Contamination and hidden hazards"
                ],
                "donts": [
                    "× Do NOT drive through flooded areas",
                    "× Do NOT touch electrical equipment in water",
                    "× Do NOT drink tap water if contaminated"
                ]
            },
            "medical": {
                "title": "🏥 MEDICAL EMERGENCY RESPONSE",
                "steps": [
                    "1. **CHECK RESPONSIVENESS** - Tap and shout",
                    "2. **CALL 112 IMMEDIATELY** - Request ambulance",
                    "3. **CHECK BREATHING** - Look, listen, feel",
                    "4. **PERFORM CPR IF TRAINED** - If no breathing",
                    "5. **CONTROL BLEEDING** - Apply pressure with clean cloth",
                    "6. **DO NOT MOVE** - Unless in immediate danger"
                ],
                "donts": [
                    "× Do NOT give food or drink to unconscious person",
                    "× Do NOT remove impaled objects",
                    "× Do NOT apply tourniquets unless trained"
                ]
            }
        }
        
        default_instructions = {
            "title": "⚠️ GENERAL EMERGENCY GUIDELINES",
            "steps": [
                "1. **STAY CALM** - Panic reduces decision-making ability",
                "2. **ASSESS SITUATION** - Identify immediate dangers",
                "3. **CALL 112** - Report your exact location and situation",
                "4. **FOLLOW OFFICIAL ADVICE** - Listen to emergency broadcasts",
                "5. **HELP OTHERS IF SAFE** - Check on vulnerable individuals",
                "6. **PREPARE TO EVACUATE** - Have emergency kit ready"
            ],
            "donts": [
                "× Do NOT spread unverified information",
                "× Do NOT ignore evacuation orders",
                "× Do NOT return to danger zones"
            ]
        }
        
        instructions = instructions_db.get(crisis_type, default_instructions)
        
        # Construct response based on risk level
        if risk_level in ["critical", "high"]:
            urgency_prefix = "🚨 **IMMEDIATE ACTION REQUIRED** 🚨\n\n"
        else:
            urgency_prefix = "📋 **SAFETY PROTOCOLS**\n\n"
        
        message = f"{urgency_prefix}"
        message += f"**{instructions['title']}**\n\n"
        message += "**ACTIONS TO TAKE:**\n"
        message += "\n".join(instructions['steps']) + "\n\n"
        message += "**AVOID THESE:**\n"
        message += "\n".join(instructions['donts']) + "\n\n"
        message += f"**Risk Level: {risk_level.upper()}**\n"
        message += "*Information verified with emergency services protocols*"
        
        dispatcher.utter_message(text=message)
        
        # If critical risk, prompt for human handover
        if risk_level == "critical":
            return [FollowupAction("action_escalate_to_human")]
        
        return []

class ActionEscalateToHuman(Action):
    """Enhanced escalation with context handover"""
    def name(self) -> Text:
        return "action_escalate_to_human"

    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        
        # Collect all relevant context
        crisis_type = tracker.get_slot("crisis_type") or "Unknown"
        location = tracker.get_slot("user_location") or "Location not provided"
        risk_level = tracker.get_slot("risk_level") or "Unknown"
        severity = tracker.get_slot("severity") or "Unknown"
        needs_medical = "Yes" if tracker.get_slot("needs_medical") else "No"
        
        # Get last user messages for context
        latest_messages = []
        for event in reversed(tracker.events):
            if event.get('event') == 'user':
                latest_messages.append(event.get('text', ''))
            if len(latest_messages) >= 3:
                break
        
        context_summary = "\n".join(reversed(latest_messages))
        
        # Construct handover message
        handover_message = (
            f"🆘 **EMERGENCY HANDOVER TO HUMAN OPERATOR** 🆘\n\n"
            f"**INCIDENT SUMMARY:**\n"
            f"• Crisis Type: {crisis_type}\n"
            f"• Location: {location}\n"
            f"• Risk Level: {risk_level}\n"
            f"• Severity: {severity}\n"
            f"• Medical Needs: {needs_medical}\n\n"
            f"**RECENT CONVERSATION:**\n"
            f"{context_summary}\n\n"
            f"⏳ Connecting you now. Please stay on this line.\n"
            f"📞 If connection fails, call 112 directly with this reference."
        )
        
        dispatcher.utter_message(text=handover_message)
        
        # In production: Trigger webhook to operator dashboard
        self._notify_operator(tracker)
        
        return [
            SlotSet("awaiting_human", True),
            SlotSet("handover_time", datetime.now().isoformat())
        ]

    def _notify_operator(self, tracker):
        """Send handover notification to operator system"""
        # This would connect to your operator dashboard/webhook
        try:
            handover_data = {
                "user_id": tracker.sender_id,
                "crisis_type": tracker.get_slot("crisis_type"),
                "location": tracker.get_slot("user_location"),
                "risk_level": tracker.get_slot("risk_level"),
                "timestamp": datetime.now().isoformat(),
                "conversation_url": f"/operator/conversation/{tracker.sender_id}"
            }
            # Example API call - customize for your system
            # requests.post("https://operator-dashboard.example.com/handover", 
            #               json=handover_data, timeout=3)
            logger.info(f"Operator handover triggered: {handover_data}")
        except Exception as e:
            logger.error(f"Operator notification failed: {e}")

class ActionLogInteraction(Action):
    """Logs interactions for analysis and compliance"""
    def name(self) -> Text:
        return "action_log_interaction"

    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        
        # Log interaction details (in production, store in database)
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "user_id": tracker.sender_id,
            "last_intent": tracker.latest_message.get('intent', {}).get('name'),
            "risk_level": tracker.get_slot("risk_level"),
            "crisis_type": tracker.get_slot("crisis_type"),
            "escalated": tracker.get_slot("awaiting_human", False)
        }
        
        logger.info(f"Interaction logged: {log_entry}")
        
        return []

class ActionGetEmergencyContacts(Action):
    """Provides emergency contact information based on location"""
    def name(self) -> Text:
        return "action_get_emergency_contacts"

    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        
        location = tracker.get_slot("user_location")
        
        # Default international emergency numbers
        contacts = {
            "universal": "112 - International Emergency",
            "police": "911 (US/CA), 999 (UK), 100 (India)",
            "fire": "911 (US/CA), 999 (UK), 101 (India)",
            "medical": "911 (US/CA), 999 (UK), 102 (India)",
            "disaster": "Local government hotline"
        }
        
        message = (
            f"📞 **EMERGENCY CONTACTS**\n\n"
            f"**Universal Emergency Number:** {contacts['universal']}\n"
            f"**Police:** {contacts['police']}\n"
            f"**Fire Department:** {contacts['fire']}\n"
            f"**Medical Emergency:** {contacts['medical']}\n\n"
            f"**For {location if location else 'your location'}:**\n"
            f"• Contact local municipality website\n"
            f"• Check community emergency plans\n"
            f"• Save local hospital and police numbers\n\n"
            f"*Program these into your phone now for quick access*"
        )
        
        dispatcher.utter_message(text=message)
        return []