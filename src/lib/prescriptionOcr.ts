/**
 * Prescription OCR using Google Gemini Vision API
 * Extracts medicine names, dosages, and durations from handwritten prescription images.
 */

export interface ExtractedMedicine {
    medicine_name: string;
    dosage: string;
    duration: string;
}

export interface OcrResult {
    medicines: ExtractedMedicine[];
    rawText: string;
}

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

/**
 * Convert a File to a base64 string (without the data URL prefix).
 */
export async function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result as string;
            // Remove the "data:<mime>;base64," prefix
            const base64 = dataUrl.split(",")[1];
            const mimeType = file.type || "image/jpeg";
            resolve({ base64, mimeType });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Send a prescription image to Google Gemini Vision API and extract structured prescription data.
 */
export async function extractPrescriptionText(
    base64ImageData: string,
    mimeType: string
): Promise<OcrResult> {
    if (!GEMINI_API_KEY) {
        throw new Error(
            "Gemini API key not configured. Please set VITE_GEMINI_API_KEY in your .env file."
        );
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

    const prompt = `You are a medical prescription reader. Analyze this handwritten prescription image and extract the following information.

Return ONLY a valid JSON object with this exact structure (no markdown, no code blocks, just pure JSON):
{
  "medicines": [
    {
      "medicine_name": "name of the medicine",
      "dosage": "dosage like 500mg, 1 tablet twice daily, etc.",
      "duration": "duration like 5 days, 1 week, etc."
    }
  ],
  "rawText": "the full raw text you can read from the prescription, preserving the original layout as much as possible"
}

Important instructions:
- Extract ALL medicines visible in the prescription
- If dosage or duration is not clearly readable, make your best guess and add "(unclear)" at the end
- If you cannot read the handwriting at all, return empty medicines array and set rawText to "Unable to read prescription"
- Do NOT wrap the JSON in markdown code blocks
- Return ONLY the JSON object`;

    const requestBody = {
        contents: [
            {
                parts: [
                    {
                        inlineData: {
                            mimeType,
                            data: base64ImageData,
                        },
                    },
                    {
                        text: prompt,
                    },
                ],
            },
        ],
        generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048,
        },
    };

    const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
            `Gemini API error (${response.status}): ${errorData?.error?.message || response.statusText}`
        );
    }

    const data = await response.json();

    // Extract the text content from Gemini's response
    const textContent =
        data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Parse the JSON response
    try {
        // Clean up potential markdown code blocks
        let cleanJson = textContent.trim();
        if (cleanJson.startsWith("```")) {
            cleanJson = cleanJson.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
        }

        const parsed = JSON.parse(cleanJson);

        return {
            medicines: Array.isArray(parsed.medicines)
                ? parsed.medicines.map((m: any) => ({
                    medicine_name: String(m.medicine_name || "").trim(),
                    dosage: String(m.dosage || "").trim(),
                    duration: String(m.duration || "").trim(),
                }))
                : [],
            rawText: String(parsed.rawText || textContent).trim(),
        };
    } catch {
        // If JSON parsing fails, return the raw text
        return {
            medicines: [],
            rawText: textContent.trim() || "Unable to parse prescription text",
        };
    }
}
