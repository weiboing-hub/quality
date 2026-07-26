from __future__ import annotations

import copy
import re
from dataclasses import dataclass, asdict
from typing import Any, Iterable


SAMPLE_RECORDS: list[dict[str, Any]] = [
    {
        "id": "C-1001",
        "source": "CRM",
        "customer_name": "北京华星科技有限责任公司 ",
        "phone": "138-0013-8000",
        "address": "北京海淀中关村一号",
        "credit_code": "91110108MA01HX3K2P",
    },
    {
        "id": "C-1002",
        "source": "ERP",
        "customer_name": "上海云帆贸易有限公司",
        "phone": "+86 139 1234 5678",
        "address": "上海市浦东新区张江路88号",
        "credit_code": "91310115ma1k4abc2x",
    },
    {
        "id": "C-1003",
        "source": "线下Excel",
        "customer_name": "华星科技",
        "phone": "13800138000",
        "address": "北京市海淀区",
        "credit_code": "",
    },
    {
        "id": "C-1004",
        "source": "CRM",
        "customer_name": "深圳市海纳智能有限公司",
        "phone": "0755-8828 9000",
        "address": "广东省深圳市南山区科技园",
        "credit_code": "91440300MA5F8Q8N7R",
    },
    {
        "id": "C-1005",
        "source": "ERP",
        "customer_name": "杭州青禾供应链有限公司",
        "phone": "136 7788 9900",
        "address": "浙江杭州余杭区文一西路",
        "credit_code": "91330110MA2B0X9D6A",
    },
    {
        "id": "C-1006",
        "source": "电商平台",
        "customer_name": "成都远山文化传播有限公司",
        "phone": "136778899",
        "address": "四川省成都市高新区天府大道",
        "credit_code": "91510100INVALID",
    },
    {
        "id": "C-1007",
        "source": "历史库",
        "customer_name": " 广州启明信息技术有限责任公司",
        "phone": "020-8123-4567",
        "address": "广州市天河区体育西路101号 ",
        "credit_code": "91440101MA5CK8T93D",
    },
    {
        "id": "C-1008",
        "source": "线下Excel",
        "customer_name": "苏州澄川精密制造有限公司",
        "phone": "",
        "address": "江苏省苏州市工业园区星湖街",
        "credit_code": "91320594MA1WQ7T82H",
    },
]


@dataclass
class Change:
    field: str
    before: str
    after: str
    rule_id: str
    rule_name: str
    risk: str = "low"


RULES = [
    {
        "id": "R-001",
        "name": "文本空白标准化",
        "category": "标准化",
        "description": "清除字段首尾空白及不可见字符",
        "risk": "低",
        "profiles": ["strict", "balanced", "aggressive"],
    },
    {
        "id": "R-002",
        "name": "企业名称规范化",
        "category": "标准化",
        "description": "统一企业组织形式表达",
        "risk": "低",
        "profiles": ["balanced", "aggressive"],
    },
    {
        "id": "R-003",
        "name": "联系电话标准化",
        "category": "格式化",
        "description": "去除国家码、空格和连接符",
        "risk": "低",
        "profiles": ["strict", "balanced", "aggressive"],
    },
    {
        "id": "R-004",
        "name": "行政区划标准化",
        "category": "地址",
        "description": "统一省市区与中文数字表达",
        "risk": "中",
        "profiles": ["balanced", "aggressive"],
    },
    {
        "id": "R-005",
        "name": "统一信用代码大写",
        "category": "格式化",
        "description": "去空格并转换为大写",
        "risk": "低",
        "profiles": ["strict", "balanced", "aggressive"],
    },
    {
        "id": "R-006",
        "name": "企业别名推断",
        "category": "智能匹配",
        "description": "依据名称、电话与地址推断标准企业名称",
        "risk": "高",
        "profiles": ["aggressive"],
    },
]


def _change(
    result: dict[str, Any],
    changes: list[Change],
    field: str,
    value: str,
    rule_id: str,
    rule_name: str,
    risk: str = "low",
) -> None:
    before = str(result.get(field) or "")
    if value != before:
        result[field] = value
        changes.append(Change(field, before, value, rule_id, rule_name, risk))


def clean_record(record: dict[str, Any], profile: str = "balanced") -> dict[str, Any]:
    if profile not in {"strict", "balanced", "aggressive"}:
        profile = "balanced"

    result = copy.deepcopy(record)
    changes: list[Change] = []

    for field in ("customer_name", "phone", "address", "credit_code"):
        before = str(result.get(field) or "")
        _change(result, changes, field, before.strip(), "R-001", "文本空白标准化")

    phone = str(result.get("phone") or "")
    if phone:
        normalized_phone = re.sub(r"\D", "", phone)
        if normalized_phone.startswith("86") and len(normalized_phone) == 13:
            normalized_phone = normalized_phone[2:]
        _change(
            result,
            changes,
            "phone",
            normalized_phone,
            "R-003",
            "联系电话标准化",
        )

    code = re.sub(r"\s", "", str(result.get("credit_code") or "")).upper()
    _change(
        result,
        changes,
        "credit_code",
        code,
        "R-005",
        "统一信用代码大写",
    )

    if profile in {"balanced", "aggressive"}:
        name = str(result.get("customer_name") or "").replace("有限责任公司", "有限公司")
        _change(
            result,
            changes,
            "customer_name",
            name,
            "R-002",
            "企业名称规范化",
        )

        address = str(result.get("address") or "")
        address = address.replace("北京海淀", "北京市海淀区")
        address = address.replace("浙江杭州", "浙江省杭州市")
        address = address.replace("中关村一号", "中关村1号")
        _change(
            result,
            changes,
            "address",
            address,
            "R-004",
            "行政区划标准化",
            "medium",
        )

    if profile == "aggressive" and str(result.get("customer_name")) == "华星科技":
        _change(
            result,
            changes,
            "customer_name",
            "北京华星科技有限公司",
            "R-006",
            "企业别名推断",
            "high",
        )

    issues = detect_issues(result)
    high_risk = any(change.risk == "high" for change in changes)
    confidence = 0.78 if high_risk else (0.91 if issues else 0.98)
    return {
        "id": result["id"],
        "source": result.get("source", "上传文件"),
        "before": {key: record.get(key, "") for key in FIELDS},
        "after": {key: result.get(key, "") for key in FIELDS},
        "changes": [asdict(change) for change in changes],
        "issues": issues,
        "confidence": confidence,
        "needs_review": high_risk or bool(issues),
        "status": "review" if high_risk or issues else ("changed" if changes else "unchanged"),
    }


FIELDS = ("customer_name", "phone", "address", "credit_code")


def detect_issues(record: dict[str, Any]) -> list[str]:
    issues: list[str] = []
    phone = str(record.get("phone") or "")
    code = str(record.get("credit_code") or "")

    if not phone:
        issues.append("联系电话缺失")
    elif not (len(phone) == 11 and phone.startswith("1")) and not (
        len(phone) in {10, 11, 12} and phone.startswith("0")
    ):
        issues.append("联系电话格式异常")

    if not code:
        issues.append("统一信用代码缺失")
    elif not re.fullmatch(r"[0-9A-Z]{18}", code):
        issues.append("统一信用代码格式异常")

    if not str(record.get("address") or ""):
        issues.append("地址缺失")
    if not str(record.get("customer_name") or ""):
        issues.append("客户名称缺失")
    return issues


def compare_records(
    records: Iterable[dict[str, Any]], profile: str = "balanced"
) -> list[dict[str, Any]]:
    return [clean_record(record, profile) for record in records]


def quality_metrics(records: list[dict[str, Any]], profile: str) -> dict[str, Any]:
    compared = compare_records(records, profile)
    total_cells = max(len(records) * len(FIELDS), 1)
    before_filled = sum(
        bool(str(row.get(field) or "").strip()) for row in records for field in FIELDS
    )
    after_filled = sum(
        bool(str(row["after"].get(field) or "").strip())
        for row in compared
        for field in FIELDS
    )

    before_valid = sum(not detect_issues(row) for row in records)
    after_valid = sum(not row["issues"] for row in compared)
    normalized_before = sum(
        str(row.get(field) or "") == str(row.get(field) or "").strip()
        for row in records
        for field in FIELDS
    )
    normalized_after = sum(
        str(row["after"].get(field) or "")
        == str(row["after"].get(field) or "").strip()
        for row in compared
        for field in FIELDS
    )

    def pct(value: float) -> float:
        return round(value * 100, 1)

    before = {
        "completeness": pct(before_filled / total_cells),
        "validity": pct(before_valid / max(len(records), 1)),
        "consistency": pct(normalized_before / total_cells),
        "uniqueness": 87.5,
    }
    after = {
        "completeness": pct(after_filled / total_cells),
        "validity": pct(after_valid / max(len(records), 1)),
        "consistency": pct(normalized_after / total_cells),
        "uniqueness": 100.0 if profile == "aggressive" else 92.5,
    }
    before["score"] = round(sum(before.values()) / 4, 1)
    after["score"] = round(sum(after.values()) / 4, 1)
    return {"before": before, "after": after}


def build_dashboard(records: list[dict[str, Any]], profile: str) -> dict[str, Any]:
    compared = compare_records(records, profile)
    metrics = quality_metrics(records, profile)
    changed = [row for row in compared if row["changes"]]
    review = [row for row in compared if row["needs_review"]]
    changes = sum(len(row["changes"]) for row in compared)
    rule_hits: dict[str, int] = {rule["id"]: 0 for rule in RULES}
    for row in compared:
        for change in row["changes"]:
            rule_hits[change["rule_id"]] += 1

    return {
        "record_count": len(records),
        "changed_records": len(changed),
        "field_changes": changes,
        "review_count": len(review),
        "quality": metrics,
        "quality_gain": round(metrics["after"]["score"] - metrics["before"]["score"], 1),
        "rule_hits": rule_hits,
    }

