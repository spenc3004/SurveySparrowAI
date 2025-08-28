const express = require('express')
const fs = require('fs')
const path = require('path')
const { exec } = require('child_process');
const nodemailer = require('nodemailer')
const openai = require('openai');

const app = express()
require('dotenv').config()

const PORT = process.env.PORT || 3001

app.use(express.json())

const OUTPUT_DIR = path.join(__dirname, 'output');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

const client = new openai.OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.get("/", (req, res) => {
  res.send('Hello from server.js')
})

// #region Prompt Handling

const PROMPTS = {
  hvac: "pmpt_689226a161dc8190b3ac61c52a055eda0f5aed1595299f08",
  auto: "pmpt_68adf665c1988195be6b0224591843e50f57c68ec231c47f",
  roofing: "pmpt_68ae0c8224a88197957bb03a23a50b620733f4b65b87c83e",
  plumbing: "pmpt_68b0502d4cb0819488dad99904ad90ea0840c0d15f6acac4",
  electrical: "pmpt_68b05466206c8197b3922311d1b62e5804176f4fc3158400",
  generalBusiness: "pmpt_68b0590e6c6c8195943f8a4f0c9acc520023760ec7129d84",
  dental: "pmpt_68b06111a8108196810f2ae75f25be28014401816a0ed215",
};

const SURVEY_CONFIG = {
  "1000358733": { type: "HVAC", promptId: PROMPTS.hvac },
  "1000379432": { type: "Auto", promptId: PROMPTS.auto },
  "1000388247": { type: "Roofing", promptId: PROMPTS.roofing },
  "1000388375": { type: "Plumbing", promptId: PROMPTS.plumbing },
  "1000388856": { type: "Electrical", promptId: PROMPTS.electrical },
  "1000388862": { type: "General Business", promptId: PROMPTS.generalBusiness },
  "1000388867": { type: "Dental", promptId: PROMPTS.dental },
};

function promptManager(id) {
  const cfg = SURVEY_CONFIG[String(id)];
  if (!cfg) throw new Error(`Unsupported survey_id: ${id}`);
  return cfg;
}
// #endregion




app.post("/ss", async (req, res) => {
  // #region Receive JSON from Survey Sparrow
  try {
    console.log("Received JSON from Survey Sparrow");
    const data = req.body
    const company = data.companyName || data.practiceName
    const { type, promptId } = promptManager(data.survey_id)
    console.log(promptId)
    const safeType = type.replace(/\s+/g, "_");
    const briefContent = await generateBrief(data, promptId, type)

    const mdFilePath = path.join(OUTPUT_DIR, `${safeType}_Brief.md`);
    const docxFilePath = path.join(OUTPUT_DIR, `${safeType}_Brief.docx`);

    fs.writeFileSync(mdFilePath, briefContent);
    await convertToDocx(mdFilePath, docxFilePath);
    await sendEmail(docxFilePath, company, type);

    fs.unlinkSync(mdFilePath);
    fs.unlinkSync(docxFilePath);



    res.status(200).send('File processed and email sent.');
  }

  catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
  // #endregion
});

async function generateBrief(data, promptId, type) {
  // #region Generate Brief Content
  const response = await client.responses.create({
    model: 'gpt-4.1-mini',
    prompt: {
      id: promptId,
    },
    input: [
      {
        role: 'user',
        content: `Use this data to create a ${type} client brief adhere to exact section titles and formatting in the instructions.
          ${JSON.stringify(data, null, 2)}`
      }
    ]
  });

  const output = response.output[0].content[0].text;
  console.log("AI Output finished generating.");
  return output;
  // #endregion
}

function convertToDocx(mdFilePath, docxFilePath) {
  // #region Convert output.md to a docx
  console.log("Converting MD to DOCX...");
  return new Promise((resolve, reject) => {
    exec(`pandoc ${mdFilePath} -o ${docxFilePath}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error converting MD to DOCX: ${stderr}`);
        reject(error);
      } else {
        resolve();
      }
    });
  });
  // #endregion
}

async function sendEmail(attachmentPath, company, type) {
  // #region Send output.docx in email
  console.log("Sending email...");
  let transporter = nodemailer.createTransport({
    host: 'smtp.office365.com',
    port: 587,
    secure: false,
    auth: { user: process.env.user, pass: process.env.pass },
    tls: {
      ciphers: "SSLv3" // Helps avoid connection issues
    }

  });

  let mailOptions = {
    from: process.env.user,
    to: process.env.recipient,
    bcc: "sharkymailson@gmail.com",
    subject: `New ${type} Survey Submitted for ${company}`,
    text: 'Please see the attached document.',
    attachments: [{ path: attachmentPath }]
  };

  await transporter.sendMail(mailOptions);
  // #endregion
}

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})
