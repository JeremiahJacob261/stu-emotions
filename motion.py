from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from transformers import pipeline
import torch
import uvicorn

app = FastAPI(title="GoEmotions API")

# Enable CORS so your HTML can call the API
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load the model once when the app starts
classifier = pipeline(
    "text-classification",
    model="SamLowe/roberta-base-go_emotions",
    top_k=None,                    # return all 28 emotions
    device=0 if torch.cuda.is_available() else -1
)

class TextInput(BaseModel):
    text: str

@app.post("/predict")
async def predict(input: TextInput):
    results = classifier(input.text)[0]
    
    # Sort by score descending
    results = sorted(results, key=lambda x: x["score"], reverse=True)
    
    return {
        "emotions": results,
        "top_emotions": [r for r in results if r["score"] > 0.3]
    }

# Serve the simple HTML UI
@app.get("/", response_class=HTMLResponse)
async def home():
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>GoEmotions Detector</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 700px; margin: 40px auto; padding: 20px; }
            textarea { width: 100%; height: 150px; padding: 12px; font-size: 16px; }
            button { padding: 12px 24px; font-size: 16px; background: #1a73e8; color: white; border: none; border-radius: 6px; cursor: pointer; }
            button:hover { background: #1557b0; }
            #result { margin-top: 30px; }
            .emotion { margin: 8px 0; padding: 10px; background: #f8f9fa; border-radius: 6px; }
            .bar { height: 8px; background: #1a73e8; margin-top: 4px; border-radius: 4px; }
        </style>
    </head>
    <body>
        <h1>🎭 GoEmotions Detector</h1>
        <p>Paste any text and see detected emotions</p>
        
        <textarea id="text" placeholder="Type or paste your text here..."></textarea><br><br>
        <button onclick="analyze()">Analyze Emotions</button>
        
        <div id="result"></div>

        <script>
            async function analyze() {
                const text = document.getElementById('text').value.trim();
                if (!text) return alert("Please enter some text");

                const res = await fetch('/predict', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: text })
                });

                const data = await res.json();
                let html = '<h2>Results:</h2>';

                data.emotions.forEach(e => {
                    const percent = (e.score * 100).toFixed(1);
                    html += `
                        <div class="emotion">
                            <strong>${e.label}</strong> — ${percent}%
                            <div class="bar" style="width: ${percent}%"></div>
                        </div>
                    `;
                });

                document.getElementById('result').innerHTML = html;
            }
        </script>
    </body>
    </html>
    """

# For local testing
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=7860)