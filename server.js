// #region Initialization
/* Documentation
---
This imports necessary modules, sets up the Express server/middleware, configures environment 
variables, ensures the output directory exists, and initializes the OpenAI client.
---
To ensure this works, create a .env file that contains the following:
PORT = <your_port_number>*
OPENAI_API_KEY = <your_openai_api_key>
user = <your_email_address>**
pass = <your_email_app_password>***
recipient = <recipient_email_address>
---
*If PORT is not specified, it defaults to 3001.
**This is configured for the sender to be an Outlook account. For other email providers, adjustments 
will be necessary.
***App password ensures NodeMailer will work with 2FA and makes it less likely to be 
flagged/blocked as bot activity.
---
*/

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

// #endregion

// #region Endpoints
/* Documentation
---
/ss is the main endpoint. Its work flow is as follows:
- Receives JSON from Survey Sparrow and stores it in {data}
- Extracts the company or  practice name and stores it in {company}
- Calls numCoupons and adds the result to the data object {data.totalCoupons}
- Calls promptManager to get the type and promptId based on the survey_id {type, promptId}
- Generates a safe filename {safeType} for file name use
- Calls generateBrief to get the brief content in markdown {briefContent}
- Writes the output to a markdown file {mdFilePath} with fs.writeFileSync
- Calls convertToDocx to convert the markdown file {mdFilePath} to a DOCX file {docxFilePath}
- Calls sendEmail to send an email with the DOCX file attached
- Deletes the temporary markdown and DOCX files
- Sends a 200 status response if successful, or a 500 status response if any errors occur
---
*/

app.post("/ss", async (req, res) => {
  // #region Receive JSON from Survey Sparrow
  try {
    console.log("Received JSON from Survey Sparrow");
    const data = req.body
    const company = data.companyName || data.practiceName
    data.totalCoupons = numCoupons(data)
    const { type, promptId } = promptManager(data.survey_id)
    const safeType = type.replace(/\s+/g, "_");
    const briefContent = await generateBrief(data, promptId, type);

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
    console.error(`Internal server error: ${error.message}`, error);
    res.status(500).send(`Internal Server Error`);
  }
  // #endregion
});
// #endregion

// #region Prompt Handling
/* Documentation
---
PROMPTS maps the survey type to the corresponding prompt ID in the OpenAI platform.
---
SURVEY_CONFIG maps the survey_id from Survey Sparrow to the survey type and prompt ID.
---
promptManager retrieves the configuration based on the survey_id and then returns that.
---
*/

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

// #region Helper Functions
/* Documentation
---
numCoupons takes the survey JSON and counts the number of non-null coupon/disclaimer pairs across
multiple survey sections only if that section exists, and returns the total count as a string.
---
*/

function numCoupons(data) {
  try {
    let counter = 0;
    if (data.coupons) {
      for (const key in data.coupons) {
        if (key.startsWith("coupon")) {
          if (data.coupons[key] !== "null") {
            counter += 1
          }
        }
      }
    }
    if (data.homeownerOffers) {
      for (const key in data.homeownerOffers) {
        if (key.startsWith("coupon")) {
          if (data.homeownerOffers[key] !== "null") {
            counter += 1
          }
        }
      }
    }
    if (data.radiusOffers) {
      for (const key in data.radiusOffers) {
        if (key.startsWith("coupon")) {
          if (data.radiusOffers[key] !== "null") {
            counter += 1
          }
        }
      }
    }
    if (data.carrierOffers) {
      for (const key in data.carrierOffers) {
        if (key.startsWith("coupon")) {
          if (data.carrierOffers[key] !== "null") {
            counter += 1
          }
        }
      }
    }
    if (data.retentionOffers) {
      for (const key in data.retentionOffers) {
        if (key.startsWith("coupon")) {
          if (data.retentionOffers[key] !== "null") {
            counter += 1
          }
        }
      }
    }
    return String(counter);
  }

  catch (error) {
    console.error(`Error with coupon count: ${error.message}`, error);
    res.status(500).send('Error processing coupon count.');
  }
}

// #endregion

// #region Main Functions
/* Documentation
---
generateBrief takes the survey JSON data, promptId, and type as arguments,
then it sends a request to the OpenAI API with the promptId and survey data to generate the brief
content in markdown, which is returned as {output} to the /ss endpoint.
---
convertToDocx takes mdFilePath and docxFilePath as arguments and uses exec to run a Pandoc command 
to convert the brief markdown file to a DOCX file.
---
sendEmail takes attachmentPath, company, and type as arguments and uses NodeMailer to send an email 
with the DOCX file attached*. To adjust the recipient and sender, you can adjust your .env file.
---
*This is configured for the sender to be an Outlook account. For other email providers, adjustments 
will be necessary.
---
*/

async function generateBrief(data, promptId, type) {
  // #region Generate Brief Content
  try {
    const response = await client.responses.create({
      model: 'gpt-4.1-mini',
      prompt: {
        id: promptId
      },
      input: [
        {
          role: 'user',
          content: `Use this data to create a ${type} client brief adhere to exact section titles and 
        formatting in the instructions. ${JSON.stringify(data, null, 2)}`
        }
      ]
    });

    const output = response.output[0].content[0].text;
    console.log("AI Output finished generating.");
    return output;
  }

  catch (error) {
    console.error(`Error generating brief: ${error.message}`, error);
    res.status(500).send('Error generating brief.');
  }
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

// #endregion

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})
