from __future__ import annotations

import csv
import io
from copy import deepcopy
from datetime import datetime, timezone
from typing import Literal

from fastapi import Body, FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .engine import RULES, SAMPLE_RECORDS, build_dashboard, compare_records


app = FastAPI(
    title="DataMirror API",
    description="客户主数据清洗与前后对比 Demo",
    version="0.1.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

records = deepcopy(SAMPLE_RECORDS)
review_decisions: dict[str, dict] = {}
audit_logs: list[dict] = []


class ReviewDecision(BaseModel):
    decision: Literal["approved", "rejected", "edited"]
    note: str = ""


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "service": "datamirror-api", "version": "0.1.0"}


@app.get("/api/dashboard")
def dashboard(profile: str = Query("balanced")) -> dict:
    return build_dashboard(records, profile)


@app.get("/api/rules")
def list_rules(profile: str = Query("balanced")) -> list[dict]:
    dashboard_data = build_dashboard(records, profile)
    return [
        {
            **rule,
            "enabled": profile in rule["profiles"],
            "hits": dashboard_data["rule_hits"].get(rule["id"], 0),
        }
        for rule in RULES
    ]


@app.get("/api/records")
def list_records(
    profile: str = Query("balanced"),
    status: str = Query("all"),
    query: str = Query(""),
) -> list[dict]:
    result = compare_records(records, profile)
    normalized_query = query.strip().lower()
    if status != "all":
        result = [row for row in result if row["status"] == status]
    if normalized_query:
        result = [
            row
            for row in result
            if normalized_query in str(row).lower()
        ]
    return [
        {**row, "review_decision": review_decisions.get(row["id"])}
        for row in result
    ]


@app.get("/api/audit")
def audit() -> list[dict]:
    return list(reversed(audit_logs))


@app.post("/api/reviews/{record_id}")
def decide_review(record_id: str, payload: ReviewDecision) -> dict:
    if not any(row["id"] == record_id for row in records):
        raise HTTPException(status_code=404, detail="记录不存在")
    decision = {
        "record_id": record_id,
        "decision": payload.decision,
        "note": payload.note,
        "operator": "Demo 顾问",
        "decided_at": now_iso(),
    }
    review_decisions[record_id] = decision
    audit_logs.append(
        {
            "id": f"A-{len(audit_logs) + 1:04d}",
            "action": "人工复核",
            "target": record_id,
            "detail": f"{payload.decision}: {payload.note or '无备注'}",
            "operator": "Demo 顾问",
            "created_at": decision["decided_at"],
        }
    )
    return decision


@app.post("/api/datasets/upload")
async def upload_dataset(
    body: bytes = Body(..., media_type="text/csv"),
) -> dict:
    global records
    try:
        text = body.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text))
        required = {"customer_name", "phone", "address", "credit_code"}
        if not reader.fieldnames or not required.issubset(set(reader.fieldnames)):
            raise ValueError("CSV必须包含 customer_name、phone、address、credit_code")
        uploaded = []
        for index, row in enumerate(reader, start=1):
            uploaded.append(
                {
                    "id": row.get("id") or f"UP-{index:04d}",
                    "source": row.get("source") or "上传文件",
                    **{field: row.get(field, "") for field in required},
                }
            )
        if not uploaded:
            raise ValueError("CSV没有数据行")
    except (UnicodeDecodeError, csv.Error, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    records = uploaded
    review_decisions.clear()
    audit_logs.append(
        {
            "id": f"A-{len(audit_logs) + 1:04d}",
            "action": "上传数据集",
            "target": "current-dataset",
            "detail": f"导入 {len(uploaded)} 条记录",
            "operator": "Demo 顾问",
            "created_at": now_iso(),
        }
    )
    return {"count": len(uploaded), "message": "数据集上传成功"}


@app.post("/api/reset")
def reset_demo() -> dict:
    global records
    records = deepcopy(SAMPLE_RECORDS)
    review_decisions.clear()
    audit_logs.clear()
    return {"message": "演示数据已重置", "count": len(records)}


@app.get("/api/export.csv")
def export_csv(profile: str = Query("balanced")) -> Response:
    output = io.StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=[
            "id",
            "source",
            "customer_name",
            "phone",
            "address",
            "credit_code",
            "change_count",
            "review_status",
        ],
    )
    writer.writeheader()
    for row in compare_records(records, profile):
        writer.writerow(
            {
                "id": row["id"],
                "source": row["source"],
                **row["after"],
                "change_count": len(row["changes"]),
                "review_status": review_decisions.get(row["id"], {}).get(
                    "decision", "pending" if row["needs_review"] else "not_required"
                ),
            }
        )
    return Response(
        content="\ufeff" + output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=datamirror-result.csv"},
    )

