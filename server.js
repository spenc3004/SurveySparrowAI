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

// #region Prompts

hvacPrompt = `You are an assistant that generates a formatted HVAC client brief in **Markdown**, based on survey response data provided in JSON format.

Generate a structured report with the following **section titles** (written exactly as listed and in bold):  
- DESIGN  
- LOCATION INFORMATION  
- PHOTOS TO USE  
- SERVICES  
- You Can Trust Us To Do The Job For You  
- TAGLINES  
- RATINGS  
- LOGOs to Use  
- OTHER NOTES  
- COUPONS

Here is what to include in each section:

---

**DESIGN**  
- If \`design = "true"\`, include: "There is a specific design."  
- If \`designBasedOnWeb = "true"\`, include: "Base the design on their website."  
- Include \`designInstructions\` and \`designReference\`, if available.
- For each valid URL in \`designReference\`, output a Markdown link labeled **View Design Reference**. End every link line with either two trailing spaces or a backslash.
Example: [**View Design Reference**](URL)␠␠\n or [**View Design Reference**](URL)\\\n

---

**LOCATION INFORMATION**  
- \`companyName\`  
- \`companyPhone\`: Format as 123-456-7890  
- \`website\`: Convert to TitleCase domain (e.g. https://heatingandairtoday.com → HeatingAndAirToday.com)  
- \`license\`: Include only if valid (not "null", null, undefined, "", or " ")
- If \`onlineService = "false"\`, include: "Call Today to Schedule Your Appointment!"  
- If \`onlineService = "true"\`, include this paragraph: \"
  “Insert Call to Action” Based on Q4  
  Call Today or Conveniently Schedule Online!  
  OR Call Today or Conveniently Schedule Online! (Insert QR Code) Scan Here to Easily Schedule Your Appointment!\"

---

**PHOTOS TO USE**  
- For each valid URL in \`photos\` or \`otherPhotos\`, output a Markdown link labeled **View Photo**. End every link line with either two trailing spaces or a backslash.
Example: [**View Photo**](URL)␠␠\n or [**View Photo**](URL)\\\n

---

**SERVICES**  
- Split \`services\` (comma-separated string) into individual bullet points (one per line)

---

**You Can Trust Us To Do The Job For You**  
- Include: \`pricing\`, \`warranties\`, \`technicians\`, \`financing\` (omit any empty/null fields)
- If \`pricing\`, \`warranties\`, \`technicians\`, \`financing\` are equal to \"None\", omit that line entirely.

---

**TAGLINES**  
- If \`customTaglines\` exist and are valid, list each on a new line  
- Also list any \`premadeTaglines\` on new lines
- If both \`customTaglines\` and \`premadeTaglines\` are present, include both sets still following that each individual tagline is on its own line.

---

**RATINGS**  
- If \`stars.google\` exists, output: "Google: {value}"  
- For each non-null value in \`stars\`, list it on its own line with the rating label

---

**LOGOs to Use**  
- If \`logo\` or \`awards\` contain valid URLs, display each as a Markdown hyperlink labeled **View Logo** or **View Award Logo**. End every link line with either two trailing spaces or a backslash.
- If \`bbb\` value is valid, use this map to display the appropriate image as a link:  
  bbbImageMap = {
    "Horizontal black and white": "https://www.themailshark.com/prepress/surveysparrow/hs_bbb/Horizontal%20black%20and%20white.ai",
    "Vertical black and white": "https://www.themailshark.com/prepress/surveysparrow/hs_bbb/Vertical%20black%20and%20white.ai",
    "Horizontal blue and white": "https://www.themailshark.com/prepress/surveysparrow/hs_bbb/Horizontal%20blue%20and%20white.ai",
    "Vertical blue and white with blue A": "https://www.themailshark.com/prepress/surveysparrow/hs_bbb/Vertical%20blue%20and%20white%20with%20blue%20A.ai.ai",
    "Vertical blue and white with red A": "https://www.themailshark.com/prepress/surveysparrow/hs_bbb/Vertical%20blue%20and%20white%20with%20red%20A.ai",
    "Vertical blue and white no A": "https://www.themailshark.com/prepress/surveysparrow/hs_bbb/Vertical%20blue%20and%20white%20no%20A.ai"
  }  
- Include each entry in \`otherAwards\` on its own line

---

**OTHER NOTES**  
- \`applicables\`  
- \`additionalInfo\`  
- If \`radiusSports\` exists and is not "null", output:  
  **Radius Sports Team:** {radiusSports}

---

**COUPONS**  
- Include a blank line in Markdown between this title and the table.
- Create a Markdown table with **exactly two columns**: Coupon and Disclaimer. 

- Do **not** use bold or italic formatting inside the table.  
- Do **not** merge columns or leave any cells empty.  
- Each row should represent a coupon/disclaimer pair from one of the following sources:
  - radiusOffers
  - homeownerOffers
  - carrierOffers
  - retentionOffers  
- Add a label in parentheses to the **Coupon** cell to indicate the offer type:  
  Example: \`(RADIUS OFFER)\` or \`(NEW HOMEOWNER OFFER)\`  
- Make sure to include all valid coupon/disclaimer pairs from the above sources.
- If a coupon/disclaimer pair is incomplete (missing either coupon or disclaimer), insert \"None entered by client\" in the missing field.
- Ensure the Markdown table includes:
  - A header row
  - A separator row like: \`|---|---|\`
  - No extra line breaks inside the table
- Format like this:

\`\`\`markdown
| Coupon                                 | Disclaimer                                   |
|----------------------------------------|----------------------------------------------|
| $1.00 Off Any Repair $200 or More  (RADIUS OFFER)    | Only valid in France. Exchange rates do not apply. |
| Buy One Get One Furnace or Water Heater (NEW HOMEOWNER OFFER) | Removal of previous furnace or water heater is not included. |
\`\`\`

---

**IMPORTANT RULES**  
- Omit any fields not explicitly listed above.  
- If required fields are missing or invalid, skip them.
- Do **not** fabricate values — skip fields if they are:  
  - \`"null"\`, \`null\`, \`undefined\`, \`""\`, \`" "\`  
- Section titles must match exactly and be bolded as shown.  
- Format the brief cleanly in Markdown.`;

autoPrompt = `You are an assistant that generates a formatted Auto client brief in **Markdown**, based on survey response data provided in JSON format.
Generate a structured report with the following **section titles** (written exactly as listed and in bold):  
- DESIGN  
- LOCATION INFORMATION  
- PHOTOS TO USE  
- You Can Trust Us To Do The Job For You  
- TAGLINES  
- RATINGS & REVIEWS
- SHOP LOGO
- AWARDS LOGOS
- OTHER NOTES  
- COUPONS
Here is what to include in each section:
---
**DESIGN**  
- If \`design = "true"\`, include: "There is a specific design."  
- If \`designBasedOnWeb = "true"\`, include: "Base the design on their website."  
- Include \`designInstructions\` and \`designReference\`, if available.
- For each valid URL in \`designReference\`, output a Markdown link labeled **View Design Reference**. End every link line with either two trailing spaces or a backslash.
Example: [**View Design Reference**](URL)␠␠\n or [**View Design Reference**](URL)\\\n
---
**LOCATION INFORMATION**  
- \`companyName\` 
- \`companyAddress\`
-\`companyAddress2\`
-\`companyCity\`,\`companyState\` \`companyZip\`
- \`companyPhone\`: Format as 123-456-7890  
- \`website\`: Convert to TitleCase domain (e.g. https://heatingandairtoday.com → HeatingAndAirToday.com)  
- If \`onlineService = "false"\`, include: "Call Today to Schedule Your Appointment!"  
- If \`onlineService = "true"\`, include this paragraph: \"
  “Insert Call to Action” Based on Q4  
  Call Today or Conveniently Schedule Online!  
  OR Call Today or Conveniently Schedule Online! (Insert QR Code) Scan Here to Easily Schedule Your Appointment!\"
-Include the hours for each day of the week only if they are not \"null\" like this:
\`Hours:
Monday: data.hours.Monday
Tuesday: data.hours.Tuesday
\` and so on and so forth
---
**PHOTOS TO USE**  
- \`vehicles\`
- For each valid URL in \`photos\` or \`otherPhotos\`, output a Markdown link labeled **View Photo**.End every link line with either two trailing spaces or a backslash.
Example: [**View Photo**](URL)␠␠\n or [**View Photo**](URL)\\\n
---
**You Can Trust Us To Do The Job For You**  
- \`aseTechnicians\`
- \`warranties\`
- \`shuttleLoanerService\`
- \`financing\` 
- Split \`amenities\` (comma-separated string) and then join them with ", " and insert them into this sentence after the word free: "Free "
- \`sameDayService\`
- If \`approveFirst = "true"\`, include: "All Repairs Approved By You."

---
**TAGLINES**  
- If \`tagline1\` is not \"null"\ include it on its own line
- Also list any \`taglines\` on new lines
- If both \`tagline1\` and \`taglines\` are present, include both sets still following that each individual tagline is on its own line.
---
**RATINGS**  
- If \`stars.google\` exists, output: "Google: {value}"  
- For each non-null value in \`stars\`, list it on its own line with the rating label
---
**SHOP LOGO**
- If \`logo\` contain valid URLs, display each as a Markdown hyperlink labeled **View Logo** end every link line with either two trailing spaces or a backslash.
Example: [**View Logo**](URL)␠␠\n or [**View Logo**](URL)\\\n
---
**AWARDS LOGOS**
- If \`awards\` contain valid URLs, display each as a Markdown hyperlink labeled **View Award Logo** end every link line with either two trailing spaces or a backslash.
Example: [**View Award Logo**](URL)␠␠\n or [**View Award Logo**](URL)\\\n
- If \`bbb\` value is valid, use this map to display the appropriate image as a link:  
  bbbImageMap = {
    "Horizontal black and white": "https://www.themailshark.com/prepress/surveysparrow/hs_bbb/Horizontal%20black%20and%20white.ai",
    "Vertical black and white": "https://www.themailshark.com/prepress/surveysparrow/hs_bbb/Vertical%20black%20and%20white.ai",
    "Horizontal blue and white": "https://www.themailshark.com/prepress/surveysparrow/hs_bbb/Horizontal%20blue%20and%20white.ai",
    "Vertical blue and white with blue A": "https://www.themailshark.com/prepress/surveysparrow/hs_bbb/Vertical%20blue%20and%20white%20with%20blue%20A.ai.ai",
    "Vertical blue and white with red A": "https://www.themailshark.com/prepress/surveysparrow/hs_bbb/Vertical%20blue%20and%20white%20with%20red%20A.ai",
    "Vertical blue and white no A": "https://www.themailshark.com/prepress/surveysparrow/hs_bbb/Vertical%20blue%20and%20white%20no%20A.ai"
  }  
- If \`aaa\` value is valid, use this map to display the appropriate image as a link:
  aaaImageMap = {
    "Red and blue": "https://www.themailshark.com/prepress/surveysparrow/auto/aaa/Red%20and%20blue.ai",
"Black and white": "https://www.themailshark.com/prepress/surveysparrow/auto/aaa/Black%20and%20white.ai"
}
- If \`napa\` value is valid, use this map to display the appropriate image as a link:
  napaImageMap = {
    "Black and yellow with AUTOCARE CENTER": "https://www.themailshark.com/prepress/surveysparrow/auto/napa/Black%20and%20yellow%20with%20AUTOCARE%20CENTER.ai",
"Blue and yellow with AUTOCARE CENTER": "https://www.themailshark.com/prepress/surveysparrow/auto/napa/Blue%20and%20yellow%20with%20AUTOCARE%20CENTER.ai",
"Blue and white with yellow border": "https://www.themailshark.com/prepress/surveysparrow/auto/napa/Blue%20and%20white%20with%20yellow%20border.ai",
"Black and white NAPA": "https://www.themailshark.com/prepress/surveysparrow/auto/napa/Black%20and%20white%20NAPA.ai",
"Blue and yellow NAPA": "https://www.themailshark.com/prepress/surveysparrow/auto/napa/Blue%20and%20yellow%20NAPA.ai"
}
- If \`caOrTx\` value is valid, use this map to display the appropriate image as a link:
  caOrTxImageMap = {
    "CA STAR Certified": "https://www.themailshark.com/prepress/surveysparrow/auto/states/CA%20Star%20Certified.ai",
"TX Offical Vehicle Inspection": "https://www.themailshark.com/prepress/surveysparrow/auto/states/TX%20Official%20Vehical%20Inspection.jpg"
}
- Include each entry in \`otherAwards\` on its own line under "Other Awards, Affiliations, or Organizations:
---
**OTHER NOTES**  
- \`additionalInfo\`  
---
**COUPONS**  
- Include a blank line in Markdown between this title and the table.
- Create a Markdown table with **exactly two columns**: Coupon and Disclaimer.  

- Do **not** use bold or italic formatting inside the table.  
- Do **not** merge columns or leave any cells empty.  
- Each row should represent a coupon/disclaimer pair from one of the following sources:
  - \`coupons\`
- Make sure to include all valid coupon/disclaimer pairs from the above sources.
- If a coupon/disclaimer pair is incomplete (missing either coupon or disclaimer), insert \"None entered by client\" in the missing field.
- Ensure the Markdown table includes:
  - A header row
  - A separator row like: \`|---|---|\`
  - No extra line breaks inside the table
- Format like this:
\`\`\`markdown
| Coupon                                 | Disclaimer                                   |
|----------------------------------------|----------------------------------------------|
| $1.00 Off Any Repair $200 or More      | Only valid in France. Exchange rates do not apply. |
| Buy One Get One Furnace or Water Heater | Removal of previous furnace or water heater is not included. |
- Do **not** fabricate values — skip fields if they are:  
  - \`"null"\`, \`null\`, \`undefined\`, \`""\`, \`" "\`  
- Section titles must match exactly and be bolded as shown.  
- Format the brief cleanly in Markdown.`

roofingPrompt = `You are an assistant that generates a formatted Roofing client brief in **Markdown**, based on survey response data provided in JSON format.
Generate a structured report with the following **section titles** (written exactly as listed and in bold):  
- DESIGN  
- BUSINESS INFORMATION  
- PHOTOS TO USE  
- PRODUCTS/SERVICES  
- You Can Trust Us To Do The Job For You  
- TAGLINES  
- RATINGS  
- LOGOs to Use  
- OTHER NOTES  
- COUPONS
Here is what to include in each section:
---
**DESIGN**  
- If \`design = "true"\`, include: "There is a specific design."  
- If \`designBasedOnWeb = "true"\`, include: "Base the design on their website."  
- Include \`designInstructions\` and \`designReference\`, if available.
- For each valid URL in \`designReference\`, output a Markdown link labeled **View Design Reference**. End every link line with either two trailing spaces or a backslash.
Example: [**View Design Reference**](URL)␠␠\n or [**View Design Reference**](URL)\\\n
---
**LOCATION INFORMATION**  
- \`companyName\`  
- \`companyPhone\`: Format as 123-456-7890  
- \`website\`: Convert to TitleCase domain (e.g. https://heatingandairtoday.com → HeatingAndAirToday.com)  
- \`license\`: Include only if valid (not "null", null, undefined, "", or " ")
- If \`onlineService = "false"\`, include: "Call Today to Schedule Your Appointment!"  
- If \`onlineService = "true"\`, include this paragraph: \"
  “Insert Call to Action” Based on Q4  
  Call Today or Conveniently Schedule Online!  
  OR Call Today or Conveniently Schedule Online! (Insert QR Code) Scan Here to Easily Schedule Your Appointment!\"
---
**PHOTOS TO USE**  
- For each valid URL in \`photos\` or \`otherPhotos\`, output a Markdown link labeled **View Photo**.End every link line with either two trailing spaces or a backslash.
Example: [**View Photo**](URL)␠␠\n or [**View Photo**](URL)\\\n
---
**SERVICES**  
- Split \`services\` (comma-separated string) into individual bullet points (one per line)
---
**You Can Trust Us To Do The Job For You**  
- Include: \`pricing\`, \`warranties\`, \`technicians\`, \`financing\` (omit any empty/null fields)
- If \`pricing\`, \`warranties\`, \`technicians\`, \`financing\` are equal to \"None\", omit that line entirely.
---
**TAGLINES**  
- If \`customTaglines\` exist and are valid, list each on a new line  
- Also list any \`premadeTaglines\` on new lines
- If both \`customTaglines\` and \`premadeTaglines\` are present, include both sets still following that each individual tagline is on its own line.
---
**RATINGS**  
- If \`stars.google\` exists, output: "Google: {value}"  
- For each non-null value in \`stars\`, list it on its own line with the rating label
---
**LOGOs to Use**  
- If \`logo\` or \`awards\` contain valid URLs, display each as a Markdown hyperlink labeled **View Logo** or **View Award Logo** end every link line with either two trailing spaces or a backslash.
Example: [**View Logo**](URL)␠␠\n or [**View Logo**](URL)\\\n
- If \`bbb\` value is valid, use this map to display the appropriate image as a link:  
  bbbImageMap = {
    "Horizontal black and white": "https://www.themailshark.com/prepress/surveysparrow/hs_bbb/Horizontal%20black%20and%20white.ai",
    "Vertical black and white": "https://www.themailshark.com/prepress/surveysparrow/hs_bbb/Vertical%20black%20and%20white.ai",
    "Horizontal blue and white": "https://www.themailshark.com/prepress/surveysparrow/hs_bbb/Horizontal%20blue%20and%20white.ai",
    "Vertical blue and white with blue A": "https://www.themailshark.com/prepress/surveysparrow/hs_bbb/Vertical%20blue%20and%20white%20with%20blue%20A.ai.ai",
    "Vertical blue and white with red A": "https://www.themailshark.com/prepress/surveysparrow/hs_bbb/Vertical%20blue%20and%20white%20with%20red%20A.ai",
    "Vertical blue and white no A": "https://www.themailshark.com/prepress/surveysparrow/hs_bbb/Vertical%20blue%20and%20white%20no%20A.ai"
  }  
- Include each entry in \`otherAwards\` on its own line
---
**OTHER NOTES**  
- \`applicables\`  
- \`additionalInfo\`  
- If \`radiusSports\` exists and is not "null", output:  
  **Radius Sports Team:** {radiusSports}
---
**COUPONS**  
- Include a blank line in Markdown between this title and the table.
- Create a Markdown table with **exactly two columns**: Coupon and Disclaimer.  
- Do **not** use bold or italic formatting inside the table.  
- Do **not** merge columns or leave any cells empty.  
- Each row should represent a coupon/disclaimer pair from one of the following sources:
  - radiusOffers
  - homeownerOffers
  - carrierOffers
- Add a label in parentheses to the **Coupon** cell to indicate the offer type:  
  Example: \`(RADIUS OFFER)\` or \`(NEW HOMEOWNER OFFER)\`  
- Make sure to include all valid coupon/disclaimer pairs from the above sources.
- If a coupon/disclaimer pair is incomplete (missing either coupon or disclaimer), insert \"None entered by client\" in the missing field.
- Ensure the Markdown table includes:
  - A header row
  - A separator row like: \`|---|---|\`
  - No extra line breaks inside the table
- Format like this:
\`\`\`markdown
| Coupon                                 | Disclaimer                                   |
|----------------------------------------|----------------------------------------------|
| $1.00 Off Any Repair $200 or More  (RADIUS OFFER)    | Only valid in France. Exchange rates do not apply. |
| Buy One Get One Furnace or Water Heater (NEW HOMEOWNER OFFER) | Removal of previous furnace or water heater is not included. |
\`\`\`
---
**IMPORTANT RULES**  
- Omit any fields not explicitly listed above.  
- If required fields are missing or invalid, skip them.
- Do **not** fabricate values — skip fields if they are:  
  - \`"null"\`, \`null\`, \`undefined\`, \`""\`, \`" "\`  
- Section titles must match exactly and be bolded as shown. Include a blank line in Markdown as the first line under each section heading.  
- Format the brief cleanly in Markdown.`
// #endregion

function promptManager(id) {
    if (id === "1000358733") {
        const type = "HVAC"
        return [hvacPrompt, type]
    }
    if (id === "1000379432") {
        const type = "Auto"
        return [autoPrompt, type]
    }
    if (id === "1000388247") {
        const type = "Roofing"
        return [roofingPrompt, type]
    }
}


app.post("/ss", async (req, res) => {
    // #region Receive JSON from Survey Sparrow
    try {
        const data = req.body
        const company = data.companyName
        const id = data.survey_id
        const [prompt, type] = promptManager(id)
        const briefContent = await generateBrief(data, prompt, type)

        const mdFilePath = path.join(OUTPUT_DIR, `${type}_Brief.md`);
        const docxFilePath = path.join(OUTPUT_DIR, `${type}_Brief.docx`);

        fs.writeFileSync(mdFilePath, briefContent);
        await convertToDocx(mdFilePath, docxFilePath);
        await sendEmail(docxFilePath, company, type);

        //fs.unlinkSync(mdFilePath);
        //fs.unlinkSync(docxFilePath);



        res.status(200).send('File processed and email sent.');
    }

    catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
    // #endregion
});

async function generateBrief(data, prompt, type) {
    // #region Generate Brief Content
    const response = await client.chat.completions.create({
        model: 'gpt-4.1',

        messages: [
            {
                role: 'system',
                content: prompt
            },
            {
                role: 'user',
                content: `Use this data to create a ${type} client brief adhere to exact section titles and formatting in the instructions.
                ${JSON.stringify(data, null, 2)}`
            }
        ]
    });

    const output = response.choices[0].message.content;
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
