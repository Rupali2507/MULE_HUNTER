from fastapi import APIRouter, BackgroundTasks
from app.services.orchestrator import run_full_pipeline

router = APIRouter()


@router.post("/run/full")
def run_full_visual_analytics(background_tasks: BackgroundTasks):
    """
    Triggers the complete ML + explainability pipeline.
    Runs asynchronously in the background.
    """
    background_tasks.add_task(run_full_pipeline)
    return {
        "status": "started",
        "message": "Visual analytics pipeline started successfully"
    }
