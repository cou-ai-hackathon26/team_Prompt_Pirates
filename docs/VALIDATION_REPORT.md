# AI validation report

Run: 2026-11-23T15:11:34.986Z against http://localhost:3000
Models: primary gemini-3.5-flash-lite, fallback gemini-3.5-flash, Groq openai/gpt-oss-120b / qwen/qwen3.8-27b

| Area | Passed | Avg time |
|---|---|---|
| CBC | 14/14 | 1.0 s |
| Text | 7/7 | 7.5 s |
| Voice (TTS) | 4/4 | 10.6 s |

Responses are cached by input, so a repeat run is instant; delete AiCache rows to re-test the live model.

| Area | Case | Result | Detail |
|---|---|---|---|
| CBC | demo-day2-shapla (clean) | pass |  |
| CBC | demo-day2-shapla-photo | pass |  |
| CBC | demo-day4-shapla (clean) | pass |  |
| CBC | demo-day4-shapla-photo | pass |  |
| CBC | meghna-analyzer-si (clean) | pass |  |
| CBC | meghna-analyzer-si-photo | pass |  |
| CBC | padma-compact-kul (clean) | pass |  |
| CBC | padma-compact-kul-photo | pass |  |
| CBC | jamuna-si-10e9 (clean) | pass |  |
| CBC | jamuna-si-10e9-photo | pass |  |
| CBC | karnaphuli-range-trap (clean) | pass |  |
| CBC | karnaphuli-range-trap-photo | pass |  |
| CBC | not-cbc-ns1 (clean) | pass |  |
| CBC | not-cbc-ns1-photo | pass |  |
| Text | জ্বর কমে গেছে কিন্তু পেটে খুব ব্যথা, আজকে দুইবার বমি করছে | pass |  |
| Text | জ্বর ১০২, পানি খাচ্ছে, বমি নেই, পেটে ব্যথা নেই | pass |  |
| Text | সকাল থেকে প্রস্রাব হয়নি, খুব ঝিমাচ্ছে, দাঁত দিয়ে রক্ত পড়ছে | pass |  |
| Text | বাচ্চা কিছুই খাইতে পারতেছে না, যা খায় বমি কইরা ফালায়, চাইরবার বমি হইছে | pass |  |
| Text | Fever ta kome geche, but platelet nemese, hat-pa thanda hoye ache | pass |  |
| Text | নাক দিয়া রক্ত পড়ছে, পায়খানা কালা কালা | pass |  |
| Text | আজকে অনেক ভালো, জ্বর নাই, স্বাভাবিক খাওয়া দাওয়া করতেছে | pass |  |
| Voice (TTS) | জ্বর কমে গেছে কিন্তু পেটে খুব ব্যথা, আজকে দুইবার বমি করছে | pass |  |
| Voice (TTS) | জ্বর ১০২, পানি খাচ্ছে, বমি নেই, পেটে ব্যথা নেই | pass |  |
| Voice (TTS) | সকাল থেকে প্রস্রাব হয়নি, খুব ঝিমাচ্ছে, দাঁত দিয়ে রক্ত পড়ছে | pass |  |
| Voice (TTS) | বাচ্চা কিছুই খাইতে পারতেছে না, যা খায় বমি কইরা ফালায়, চাইরবার বমি হইছে | pass |  |
