const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const db = require('../config/db');

const knownNonMedicines = [
  "high fever", "fever", "cough", "cold", "pain", "headache", "vomiting", "nausea", "diarrhea", "dizziness", "fatigue"
];

process.on('uncaughtException', err => console.error('[Fatal] Uncaught Exception:', err));
process.on('unhandledRejection', reason => console.error('[Fatal] Unhandled Rejection:', reason));

exports.uploadMiddleware = (req, res, next) => {
  if (!req.files || !req.files.audio) {
    return res.status(400).json({ error: 'No audio file uploaded' });
  }

  const audio = req.files.audio;
  const ext = path.extname(audio.name).toLowerCase();
  const allowedExts = ['.mp3', '.webm', '.weba'];

  if (!allowedExts.includes(ext)) {
    return res.status(400).json({ error: 'Invalid audio format' });
  }

  const sanitizedName = `${Date.now()}_${path.basename(audio.name)}`;
  const uploadPath = path.join(__dirname, '..', '..', 'uploads', sanitizedName);

  audio.mv(uploadPath, err => {
    if (err) {
      return res.status(500).json({ error: 'File upload failed', details: err.message });
    }

    req.audioPath = uploadPath;
    req.audioFilename = sanitizedName;
    next();
  });
};

exports.processVoiceInput = async (req, res) => {
  const startTime = Date.now();
  let responded = false;

  const safeRespond = (status, payload) => {
    if (!responded) {
      responded = true;
      console.log(`[Node] Response in ${Date.now() - startTime}ms`);
      return res.status(status).json(payload);
    }
  };

  const { patientId } = req.body;
  if (!patientId) return safeRespond(400, { error: 'Missing patientId in body' });

  const audioFilename = req.audioFilename || req.body.audioFilename;
  if (!audioFilename) return safeRespond(400, { error: 'Missing audio filename' });

  const projectRoot = path.join(__dirname, '..', '..');
  const audioRelPath = path.join('uploads', audioFilename);
  const audioFullPath = path.join(projectRoot, audioRelPath);
  const scriptPath = path.join(projectRoot, 'scripts', 'process_audio.py');

  if (!fs.existsSync(audioFullPath)) {
    return safeRespond(400, { error: 'Audio file not found', details: audioFullPath });
  }

  if (!fs.existsSync(scriptPath)) {
    return safeRespond(500, { error: 'Python script not found', details: scriptPath });
  }

  console.log(`[VOICE] Running Python for patientId: ${patientId} on ${audioRelPath}`);

  const python = spawn('python', [scriptPath, audioRelPath], { cwd: projectRoot });
  let output = '', errorOutput = '';

  python.stdout.on('data', data => output += data.toString());
  python.stderr.on('data', data => errorOutput += data.toString());

  python.on('close', async (code) => {
    console.log(`[Python] Exit code: ${code}`);
    if (errorOutput) console.error('[Python stderr]', errorOutput.trim());

    const s = output.indexOf('{'), e = output.lastIndexOf('}');
    if (s === -1 || e === -1) {
      return safeRespond(500, { error: 'No valid JSON from Python', details: output.trim() });
    }

    let parsed;
    try {
      parsed = JSON.parse(output.slice(s, e + 1));
    } catch (err) {
      return safeRespond(500, { error: 'JSON parsing failed', details: err.message });
    }

    const medicines = parsed.medicines || [];
    const diagnoses = parsed.diagnosis || [];

    let conn;
    try {
      conn = await db.getConnection();

      const [rows] = await conn.query('SELECT id FROM patients WHERE patientId = ?', [patientId]);
      if (!rows.length) {
        return safeRespond(404, { error: 'Patient not found' });
      }

      const patient_db_id = rows[0].id;

      for (const diag of diagnoses) {
        const uid = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        await conn.query(`
          INSERT INTO patient_diagnoses
          (patientDiagnosisId, patient_db_id, diagnosisCode, diagnosisName, remarks, dateAdded)
          VALUES (?, ?, ?, ?, ?, NOW())
        `, [`diag_${uid}`, patient_db_id, `DX${uid}`, diag, null]);
      }

      for (const drug of medicines) {
        const cleanDrug = drug?.trim().toLowerCase();
        if (!cleanDrug || knownNonMedicines.includes(cleanDrug)) {
          console.log(`[Filter] Skipped non-medicine: ${drug}`);
          continue;
        }
        const uid = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        await conn.query(`
          INSERT INTO patient_medications
          (medicationId, patient_db_id, drugName, instructions, startDate)
          VALUES (?, ?, ?, ?, CURDATE())
        `, [`med_${uid}`, patient_db_id, drug, 'Not specified']);
      }

      return safeRespond(200, {
        success: true,
        medicines,
        diagnosis: diagnoses,
        message: 'Voice input processed and saved.'
      });

    } catch (err) {
      console.error('[DB Error]', err);
      return safeRespond(500, { error: 'Database error', details: err.message });
    } finally {
      if (conn) conn.release();
    }
  });
};
