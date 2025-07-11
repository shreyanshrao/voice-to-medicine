from openai import OpenAI
import os
import json
import glob

# Setup OpenAI client
client = OpenAI(api_key="")  # Replace with your OpenAI API key
# Step 1: Get the latest uploaded file
# UPLOAD_FOLDER = 'uploads'
# audio_files = sorted(glob.glob(os.path.join(UPLOAD_FOLDER, '*.mp3')), key=os.path.getmtime)
# if not audio_files:
#     print("No audio files found.")
#     exit()

# latest_audio = audio_files[-1]
# print(f"🔊 Using latest audio file: {latest_audio}")

# # Step 2: Transcribe using Whisper
# transcription = client.audio.transcriptions.create(
#     model="whisper-1",
#     file=open(latest_audio, "rb"),
#     response_format="text"
# )

# print(f"\n📝 Transcript:\n{transcription}\n")

# Step 3: Send transcript to GPT to extract medicines/symptoms
transcript="""
The patient, Mr. Ramesh, a 54-year-old male with a history of type 2 diabetes and hypertension, presented with complaints of fever, sore throat, and persistent fatigue over the past three days. On physical examination, his temperature was recorded at 101.8°F, and his throat showed signs of significant inflammation. He also reported a mild cough, nasal congestion, and body aches. Given the clinical presentation and likely upper respiratory tract infection, the physician initiated antibiotic therapy with amoxicillin to address a suspected bacterial cause. Alongside this, paracetamol was prescribed to help reduce the fever and manage the general body aches, with instructions to take it every six hours after meals.

Mr. Ramesh also has a history of seasonal allergic rhinitis, which tends to worsen during monsoon season. He mentioned frequent sneezing and nasal irritation. To relieve these symptoms, the doctor added cetirizine, a non-drowsy antihistamine, to be taken at bedtime. Considering his long-standing history of type 2 diabetes, he was advised to continue his regular regimen of metformin, an oral hypoglycemic agent that helps control blood sugar levels, and to monitor his fasting glucose more frequently while unwell.

His blood pressure during the visit was 148/92 mmHg, slightly elevated from his usual readings. As a result, his antihypertensive therapy was adjusted by increasing the dose of amlodipine, a calcium channel blocker known for its effectiveness in managing moderate hypertension. Furthermore, to support cardiac health, particularly in light of his age and borderline cholesterol levels, the doctor recommended initiating atorvastatin, a statin used to reduce LDL cholesterol and improve overall cardiovascular outcomes.

Due to his multiple medications and recent antibiotic prescription, there was concern about gastrointestinal irritation or reflux. To prevent this, pantoprazole, a proton pump inhibitor, was added to protect the stomach lining. The patient also expressed occasional symptoms of insomnia, especially when dealing with stress or illness. For this, the doctor suggested a short course of zolpidem, a sleep aid, not to exceed 5 nights in a row.

Finally, during the review of systems, Mr. Ramesh mentioned that he occasionally experiences joint pain, particularly in the knees. Given the chronic nature of this complaint and the likelihood of osteoarthritis, ibuprofen was recommended on an as-needed basis for pain relief, not exceeding 1,200 mg per day. However, he was also advised to use it sparingly due to potential interactions with his blood pressure medication and the added strain on the kidneys in diabetic patients.

He was instructed to stay well-hydrated, take rest, and return for follow-up in five days or earlier if symptoms worsened. His prescriptions were carefully reviewed for interactions, and he was advised to keep a written log of all medications taken during this period to avoid any duplication or missed doses.
"""
prompt = f"""
You are a medical assistant.

Extract medicine names and symptoms in JSON format from this transcript:

Transcript:
{transcript}

Return the output like:
{{
  "medicines": [...],
  "diagnosis": [...]
}}
"""

response = client.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": prompt}],
    temperature=0
)

try:
    result = json.loads(response.choices[0].message.content)
    print("\n✅ Extracted Data:")
    print("Medicines:", result.get("medicines", []))
    print("Diagnosis:", result.get("diagnosis", []))

    # Optionally: Save result to JSON
    with open("extracted_result.json", "w") as f:
        json.dump(result, f, indent=2)

except Exception as e:
    print("❌ Failed to parse response:", e)
