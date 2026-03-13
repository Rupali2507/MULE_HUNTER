from fastapi import FastAPI
from .schemas import EIFRequest
from .inference import score_eif

app = FastAPI()

@app.post("/v1/eif/score")
def score(req: EIFRequest):

    score, top_factors, explanation = score_eif(req.features)

    return {
        "model": "EIF",
        "version": "v2.1",
        "score": score,
        "confidence": 0.88,
        "topFactors": top_factors,
        "explanation": explanation
    }