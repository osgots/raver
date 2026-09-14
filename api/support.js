function setCors(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization"
    );
    res.setHeader("Cache-Control", "no-store");
}

function send(res, status, body) {
    setCors(res);

    res.status(status);
    res.setHeader(
        "Content-Type",
        "application/json; charset=utf-8"
    );

    res.end(JSON.stringify(body));
}


// ============================================================
// GEMINI MODEL
// ============================================================

const MODEL = "gemini-3.1-flash-lite";


// ============================================================
// RAVER AI SYSTEM PROMPT
// ============================================================

const SYSTEM_PROMPT = `
You are Raver AI Support.

You are the intelligent customer-service assistant built specifically
for the Raver institution-search web application.

ABOUT RAVER:

- Raver allows users to select an institution.
- Users can search a student using roll number / enrollment number.
- Student search works without login.
- There is no search quota or search limit.
- Raver AI Support also works without login.

PRIVACY AND ROLES:

There are three account roles:

1. USER
2. ADMIN
3. DEVELOPER

Guests and normal Users must NEVER receive protected student phone numbers.

Only:

- Admin
- Developer

may see phone numbers.

Never explain ways to bypass this restriction.

REPORTS AND FEEDBACK:

Users can use AI Support without login.

However:

- submitting a Report
- submitting Feedback

requires the user to login.

ACCOUNT SYSTEM:

Users can:

- Login
- Logout
- Change password
- Use Forgot Password
- Recover their account securely

DEVELOPER:

The Developer has the highest access level.

Developer can:

- promote users to Admin
- demote Admins
- manage users
- enable maintenance mode
- disable maintenance mode
- customize the maintenance message
- create notices
- add notice images
- add notice videos
- preview notice media
- view reports
- view feedback
- view support information
- manage site operations

ADMIN:

Admins can:

- see protected student phone numbers
- review reports
- review feedback
- access administrative tools provided by the site

Admins cannot override the Developer.

MAINTENANCE MODE:

When maintenance mode is enabled:

The website should still open.

The following should still work:

- login
- logout
- password recovery
- notices
- account functions
- language controls
- Raver AI Support

Student searches are temporarily disabled.

The Developer's maintenance message is displayed to users.

LANGUAGES:

Raver supports multiple UI and voice languages.

Language preferences can remain saved on the user's device.

YOUR BEHAVIOR:

You are not a fixed FAQ bot.

Understand the user's actual question.

Give a different and relevant response depending on what was asked.

Use conversation history when the user asks follow-up questions.

For example:

User:
"What is Raver?"

Explain Raver.

User:
"Who can see phone numbers?"

Explain Admin and Developer access.

User:
"Why?"

Understand that "Why?" refers to phone-number privacy.

Do not repeat the same introduction after every message.

Be conversational.

Be concise unless the user requests a detailed explanation.

If the user asks how to perform something in Raver,
give clear step-by-step instructions.

Never claim that you changed:

- an account
- a role
- a password
- maintenance mode
- a notice
- a report
- a deployment

unless the website itself confirms that action.

Never expose:

- API keys
- passwords
- secret tokens
- environment variables
- protected student phone numbers

If a problem needs human/admin attention,
tell a logged-in user to use:

Customer Service → Report / Feedback.

Respond naturally like an intelligent support assistant.
`;


// ============================================================
// CONVERSATION HISTORY
// ============================================================

function cleanHistory(raw) {

    if (!Array.isArray(raw)) {
        return [];
    }

    return raw
        .slice(-16)
        .map((message) => {

            const role =
                message?.role === "assistant"
                    ? "model"
                    : "user";

            const text = String(
                message?.content || ""
            )
                .trim()
                .slice(0, 3000);

            return {
                role,
                parts: [
                    {
                        text
                    }
                ]
            };
        })
        .filter(
            message =>
                message.parts[0].text
        );
}


// ============================================================
// EXTRACT GEMINI RESPONSE
// ============================================================

function extractText(data) {

    const parts =
        data?.candidates?.[0]
            ?.content
            ?.parts;

    if (!Array.isArray(parts)) {
        return "";
    }

    return parts
        .map(part => part?.text || "")
        .join("")
        .trim();
}


// ============================================================
// VERCEL SERVERLESS FUNCTION
// ============================================================

export default async function handler(req, res) {

    setCors(res);


    // --------------------------------------------------------
    // CORS PREFLIGHT
    // --------------------------------------------------------

    if (req.method === "OPTIONS") {

        return res
            .status(204)
            .end();
    }


    // --------------------------------------------------------
    // ONLY POST
    // --------------------------------------------------------

    if (req.method !== "POST") {

        return send(
            res,
            405,
            {
                error: "Method not allowed"
            }
        );
    }


    try {

        // ----------------------------------------------------
        // GET GEMINI KEY FROM VERCEL
        // ----------------------------------------------------

        const apiKey =
            process.env.GEMINI_API_KEY;


        if (!apiKey) {

            return send(
                res,
                503,
                {
                    error:
                        "Raver AI is not configured",

                    detail:
                        "GEMINI_API_KEY is missing from Vercel Environment Variables."
                }
            );
        }


        // ----------------------------------------------------
        // USER MESSAGE
        // ----------------------------------------------------

        const message =
            String(
                req.body?.message || ""
            )
                .trim()
                .slice(0, 3000);


        if (!message) {

            return send(
                res,
                400,
                {
                    error:
                        "Message required"
                }
            );
        }


        // ----------------------------------------------------
        // CHAT HISTORY
        // ----------------------------------------------------

        const history =
            cleanHistory(
                req.body?.history
            );


        const last =
            history[
                history.length - 1
            ];


        const messageAlreadyIncluded =

            last?.role === "user" &&

            last
                ?.parts?.[0]
                ?.text === message;


        const contents =

            messageAlreadyIncluded

                ? history

                : [
                    ...history,

                    {
                        role: "user",

                        parts: [
                            {
                                text: message
                            }
                        ]
                    }
                ];


        // ----------------------------------------------------
        // CALL GEMINI
        // ----------------------------------------------------

        const url =

            "https://generativelanguage.googleapis.com" +

            `/v1beta/models/${MODEL}:generateContent` +

            `?key=${encodeURIComponent(apiKey)}`;


        const response =
            await fetch(
                url,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        systemInstruction: {

                            parts: [
                                {
                                    text:
                                        SYSTEM_PROMPT
                                }
                            ]
                        },


                        contents,


                        generationConfig: {

                            temperature: 0.45,

                            maxOutputTokens: 1000
                        }
                    })
                }
            );


        const data =
            await response
                .json()
                .catch(
                    () => ({})
                );


        // ----------------------------------------------------
        // GEMINI ERROR
        // ----------------------------------------------------

        if (!response.ok) {

            console.error(
                "Gemini API error:",
                response.status,
                data
            );


            if (response.status === 429) {

                return send(
                    res,
                    429,
                    {
                        error:
                            "Raver AI free-tier limit reached",

                        detail:
                            "Please wait a little and try again."
                    }
                );
            }


            return send(
                res,
                503,
                {
                    error:
                        "Raver AI is temporarily unavailable",

                    detail:
                        data
                            ?.error
                            ?.message ||

                        `Gemini error ${response.status}`
                }
            );
        }


        // ----------------------------------------------------
        // EXTRACT ANSWER
        // ----------------------------------------------------

        const answer =
            extractText(data);


        if (!answer) {

            return send(
                res,
                502,
                {
                    error:
                        "Gemini returned an empty response"
                }
            );
        }


        // ----------------------------------------------------
        // SUCCESS
        // ----------------------------------------------------

        return send(
            res,
            200,
            {
                answer,

                mode:
                    "ai",

                model:
                    MODEL
            }
        );


    } catch (error) {

        console.error(
            "Raver AI Support:",
            error
        );


        return send(
            res,
            503,
            {
                error:
                    "Raver AI is temporarily unavailable",

                detail:
                    "Check the Gemini API key and Vercel function logs."
            }
        );
    }
}
