Steps to create and run the FastAPI environment:

1. Go to project directory
   cd C:\dev\MULE_HUNTER\visual-analytics

2. Create virtual environment
   python -m venv mule-va

3. Activate environment
   mule-va\Scripts\Activate.ps1

(If activation is blocked, run once:
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned)

4. Install dependencies
   pip install -r requirements.txt

5. Run FastAPI
   uvicorn app.main:app --reload

6. Open in browser
   http://127.0.0.1:8000/docs
