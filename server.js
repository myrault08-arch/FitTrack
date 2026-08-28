// ============================================================
// FITTRACK AI FOOD SCANNER
// ============================================================

const express = require('express');
const multer = require('multer');
const dotenv = require('dotenv');

const { GoogleGenAI } = require('@google/genai');

dotenv.config();

const app = express();
const PORT = 3000;


// ============================================================
// CORS
// ============================================================

app.use((req, res, next) => {

    res.header(
        'Access-Control-Allow-Origin',
        '*'
    );

    res.header(
        'Access-Control-Allow-Methods',
        'GET, POST, OPTIONS'
    );

    res.header(
        'Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept'
    );

    if (req.method === 'OPTIONS') {

        return res.sendStatus(204);

    }

    next();

});


// ============================================================
// GEMINI
// ============================================================

if (!process.env.GEMINI_API_KEY) {

    console.error(
        'ERROR: GEMINI_API_KEY is missing from .env'
    );

    process.exit(1);

}


const ai =
    new GoogleGenAI({
        apiKey:
            process.env.GEMINI_API_KEY
    });


// ============================================================
// IMAGE UPLOAD
// ============================================================

const upload =
    multer({
        storage:
            multer.memoryStorage(),

        limits: {
            fileSize:
                15 * 1024 * 1024 // 15MB
        }
    });


// ============================================================
// HOME
// ============================================================

app.get(
    '/',
    (req, res) => {

        res.send(`
            <h1>FitTrack AI Food Scanner</h1>
            <p>Server is running.</p>
        `);

    }
);


// ============================================================
// AI FOOD SCANNER
// ============================================================

app.post(
    '/scan-food',
    upload.single('image'),
    async (req, res) => {

        if (!req.file) {

            return res.status(400).json({

                success: false,

                error:
                    'No image uploaded.'

            });

        }


        try {

            console.log('');
            console.log(
                '=========================================='
            );

            console.log(
                'Analyzing food image...'
            );


            // --------------------------------------------------
            // READ IMAGE
            // --------------------------------------------------

            const base64Image =
                req.file.buffer.toString(
                    'base64'
                );


            // --------------------------------------------------
            // GEMINI PROMPT
            // --------------------------------------------------

            const prompt = `

You are an AI nutrition assistant for the FitTrack fitness application.

Analyze the food and drinks visible in the provided image.

IMPORTANT:
The image may contain ONE food or MULTIPLE foods.

Identify each visually distinct food or drink separately.

For each item:

1. Identify the food as accurately as possible.
2. Estimate the visible portion.
3. Estimate calories.
4. Estimate protein in grams.
5. Estimate carbohydrates in grams.
6. Estimate fat in grams.

Then calculate the total nutrition of ALL identified items.

PHOTO NUTRITION RULES:

- Estimate the portion that is actually visible.
- Do not assume the user ate more than what is visible.
- If the portion size is uncertain, make a reasonable estimate.
- For mixed dishes, identify the dish as one item unless individual components can clearly be separated.
- Do not invent ingredients that cannot reasonably be inferred.
- For restaurant or homemade food, provide a reasonable nutritional estimate.
- For packaged food, use visible information if nutrition information is readable.
- Calories should be kcal.
- Protein, carbohydrates and fat should be grams.
- All nutrition values must be numbers.
- Do not put units inside numeric values.

CONFIDENCE:

Use one of:

"high"
"medium"
"low"

Use:
- high when the food and portion are clearly identifiable
- medium when the food is identifiable but portion or ingredients are uncertain
- low when identification or portion is highly uncertain

Return ONLY valid JSON.

DO NOT use markdown.

DO NOT use code fences.

Use exactly this structure:

{
  "items": [
    {
      "food": "Food name",
      "serving": "Estimated serving",
      "calories": 0,
      "protein": 0,
      "carbs": 0,
      "fat": 0,
      "confidence": "medium"
    }
  ],
  "total": {
    "calories": 0,
    "protein": 0,
    "carbs": 0,
    "fat": 0
  },
  "notes": "Short explanation of the estimate."
}

If there is only one food, still return one item in the items array.

If no recognizable food is visible, return:

{
  "items": [],
  "total": {
    "calories": 0,
    "protein": 0,
    "carbs": 0,
    "fat": 0
  },
  "notes": "No recognizable food was detected."
}

`;


            // --------------------------------------------------
            // GEMINI REQUEST
            // --------------------------------------------------

            const response =
                await ai.models.generateContent({

                    model:
                        'gemini-3.6-flash',

                    contents: [

                        {
                            inlineData: {

                                mimeType:
                                    req.file.mimetype,

                                data:
                                    base64Image

                            }

                        },

                        {
                            text:
                                prompt
                        }

                    ]

                });


            // --------------------------------------------------
            // GET GEMINI RESPONSE
            // --------------------------------------------------

            let result =
                response.text;


            console.log('');
            console.log(
                'Gemini response:'
            );

            console.log(
                result
            );


            // --------------------------------------------------
            // REMOVE MARKDOWN IF GEMINI ADDS IT
            // --------------------------------------------------

            result =
                result
                    .replace(
                        /^```json\s*/i,
                        ''
                    )
                    .replace(
                        /^```\s*/i,
                        ''
                    )
                    .replace(
                        /\s*```$/i,
                        ''
                    )
                    .trim();


            // --------------------------------------------------
            // PARSE JSON
            // --------------------------------------------------

            const nutrition =
                JSON.parse(
                    result
                );


            // --------------------------------------------------
            // CLEAN ITEMS
            // --------------------------------------------------

            const items =
                Array.isArray(
                    nutrition.items
                )

                    ? nutrition.items.map(
                        item => ({

                            food:
                                String(
                                    item.food ||
                                    'Unknown food'
                                ),

                            serving:
                                String(
                                    item.serving ||
                                    'Unknown serving'
                                ),

                            calories:
                                Number(
                                    item.calories
                                ) || 0,

                            protein:
                                Number(
                                    item.protein
                                ) || 0,

                            carbs:
                                Number(
                                    item.carbs
                                ) || 0,

                            fat:
                                Number(
                                    item.fat
                                ) || 0,

                            confidence:
                                ['high', 'medium', 'low']
                                    .includes(
                                        String(
                                            item.confidence
                                        ).toLowerCase()
                                    )

                                    ? String(
                                        item.confidence
                                    ).toLowerCase()

                                    : 'medium'

                        })
                    )

                    : [];


            // --------------------------------------------------
            // CALCULATE TOTAL OURSELVES
            //
            // We do this instead of blindly trusting
            // Gemini's total.
            // --------------------------------------------------

            const total = {

                calories:
                    Math.round(
                        items.reduce(
                            (sum, item) =>
                                sum +
                                item.calories,
                            0
                        )
                    ),

                protein:
                    Math.round(
                        items.reduce(
                            (sum, item) =>
                                sum +
                                item.protein,
                            0
                        ) * 10
                    ) / 10,

                carbs:
                    Math.round(
                        items.reduce(
                            (sum, item) =>
                                sum +
                                item.carbs,
                            0
                        ) * 10
                    ) / 10,

                fat:
                    Math.round(
                        items.reduce(
                            (sum, item) =>
                                sum +
                                item.fat,
                            0
                        ) * 10
                    ) / 10

            };


            // --------------------------------------------------
            // RETURN RESULT
            // --------------------------------------------------

            const output = {

                success: true,

                items,

                total,

                notes:
                    String(
                        nutrition.notes ||
                        ''
                    )

            };


            console.log('');
            console.log(
                'Final nutrition:'
            );

            console.log(
                JSON.stringify(
                    output,
                    null,
                    2
                )
            );

            console.log(
                '=========================================='
            );


            res.json(
                output
            );

        }

        catch (error) {

            console.error('');

            console.error(
                'Food scanner error:',
                error
            );


            res.status(500).json({

                success: false,

                error:
                    error.message ||
                    'Failed to analyze food image.'

            });

        }

    }
);


// ============================================================
// ERROR HANDLER (e.g. multer file-size limit)
// ============================================================

app.use((error, req, res, next) => {

    console.error(
        'Unhandled request error:',
        error
    );

    res.status(400).json({

        success: false,

        error:
            error.message ||
            'Upload failed.'

    });

});


// ============================================================
// START SERVER
// ============================================================

app.listen(
    PORT,
    () => {

        console.log('');

        console.log(
            '=========================================='
        );

        console.log(
            'FitTrack AI Food Scanner'
        );

        console.log(
            'Server running at:'
        );

        console.log(
            `http://localhost:${PORT}`
        );

        console.log(
            '=========================================='
        );

        console.log('');

    }
);