from fastapi import FastAPI

app = FastAPI(
    title="ORCA Marine Intelligence Platform",
    description="Agentic AI-powered marine intelligence system",
    version="0.1.0"
)


@app.get("/")
def root():
    return {
        "project": "ORCA",
        "status": "running",
        "message": "Marine Intelligence Platform"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }