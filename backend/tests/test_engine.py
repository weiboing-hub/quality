from app.engine import SAMPLE_RECORDS, build_dashboard, clean_record


def test_balanced_profile_standardizes_common_fields():
    result = clean_record(SAMPLE_RECORDS[0], "balanced")
    assert result["after"]["customer_name"] == "北京华星科技有限公司"
    assert result["after"]["phone"] == "13800138000"
    assert result["after"]["address"] == "北京市海淀区中关村1号"
    assert len(result["changes"]) >= 3


def test_aggressive_profile_marks_alias_as_high_risk():
    result = clean_record(SAMPLE_RECORDS[2], "aggressive")
    assert result["after"]["customer_name"] == "北京华星科技有限公司"
    assert result["needs_review"] is True
    assert result["confidence"] == 0.78


def test_dashboard_contains_quality_gain():
    dashboard = build_dashboard(SAMPLE_RECORDS, "balanced")
    assert dashboard["record_count"] == len(SAMPLE_RECORDS)
    assert dashboard["changed_records"] > 0
    assert dashboard["quality"]["after"]["score"] >= dashboard["quality"]["before"]["score"]

