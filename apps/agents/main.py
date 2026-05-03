import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import chat
from app.routes import review
from app.routes import agent
from app.routes import detect_binder
from app.routes import classify
from app.routes import intake
from app.routes import draft
from app.routes import assist
from app.routes import extract
from app.routes import redline
from app.routes import approval
from app.routes import obligations
from app.routes import renewals
from app import tracing

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)

app = FastAPI(title="CLM Agent Service", version="0.1.0")


@app.on_event("shutdown")
async def _flush_langfuse() -> None:
    """D.0.7 — flush buffered traces so the last few requests before SIGTERM
    actually make it to Langfuse. No-op when tracing is disabled."""
    tracing.flush()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router, prefix="/agent")
app.include_router(review.router)
app.include_router(agent.router)
app.include_router(detect_binder.router)
app.include_router(classify.router)
app.include_router(intake.router)
app.include_router(draft.router)
app.include_router(assist.router)
app.include_router(extract.router)
app.include_router(redline.router)
app.include_router(approval.router)
app.include_router(obligations.router)
app.include_router(renewals.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
