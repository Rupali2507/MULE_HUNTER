from fastapi import FastAPI
from app.api.routes import router

app = FastAPI(
    title="Visual Analytics ML Service",
    description="ML orchestration service for Mule-Hunter",
    version="1.0.0"
)

app.include_router(
    router,
    prefix="/visual-analytics/api",
    tags=["visual-analytics"]
)


@app.get("/health")
def health_check():
    return {"status": "ok"}
