import {
  ChangeEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  API_BASE,
  decideReview,
  getDashboard,
  getRecords,
  getRules,
  resetDemo,
  uploadCsv
} from "./api";
import type {
  ComparisonRecord,
  Dashboard,
  Profile,
  RecordStatus,
  Rule
} from "./types";

const PROFILE_LABELS: Record<Profile, string> = {
  strict: "严格方案 A",
  balanced: "均衡方案 B",
  aggressive: "智能方案 C"
};

const FIELD_LABELS: Record<string, string> = {
  customer_name: "客户名称",
  phone: "联系电话",
  address: "注册地址",
  credit_code: "统一信用代码"
};

const EMPTY_DASHBOARD: Dashboard = {
  record_count: 0,
  changed_records: 0,
  field_changes: 0,
  review_count: 0,
  quality_gain: 0,
  quality: {
    before: {
      completeness: 0,
      validity: 0,
      consistency: 0,
      uniqueness: 0,
      score: 0
    },
    after: {
      completeness: 0,
      validity: 0,
      consistency: 0,
      uniqueness: 0,
      score: 0
    }
  },
  rule_hits: {}
};

function Icon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
    source: <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7"/></>,
    rule: <><path d="M4 7h11"/><path d="M4 17h16"/><circle cx="18" cy="7" r="3"/><circle cx="8" cy="17" r="3"/></>,
    compare: <><path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 13 4 4-4 4"/><path d="M20 17H4"/></>,
    review: <><path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="m7 12 3 3 7-7"/></>,
    report: <><path d="M6 2h9l4 4v16H6z"/><path d="M14 2v5h5"/><path d="M9 13h6M9 17h6"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    upload: <><path d="M12 16V3"/><path d="m7 8 5-5 5 5"/><path d="M4 15v5h16v-5"/></>,
    export: <><path d="M12 3v13"/><path d="m7 11 5 5 5-5"/><path d="M4 20h16"/></>,
    arrow: <><path d="M5 12h14"/><path d="m14 7 5 5-5 5"/></>,
    close: <><path d="m6 6 12 12M18 6 6 18"/></>
  };
  return (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

function MetricCard({
  label,
  value,
  hint,
  tone
}: {
  label: string;
  value: string | number;
  hint: string;
  tone: string;
}) {
  return (
    <article className="metric-card">
      <div className={`metric-icon ${tone}`}>
        <span />
      </div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{hint}</small>
      </div>
    </article>
  );
}

function QualityRow({
  label,
  before,
  after
}: {
  label: string;
  before: number;
  after: number;
}) {
  return (
    <div className="quality-row">
      <span className="quality-label">{label}</span>
      <div className="quality-bars">
        <div className="bar-line">
          <span className="bar before" style={{ width: `${before}%` }} />
        </div>
        <div className="bar-line">
          <span className="bar after" style={{ width: `${after}%` }} />
        </div>
      </div>
      <div className="quality-values">
        <span>{before}%</span>
        <strong>{after}%</strong>
      </div>
    </div>
  );
}

function App() {
  const [profile, setProfile] = useState<Profile>("balanced");
  const [dashboard, setDashboard] = useState(EMPTY_DASHBOARD);
  const [records, setRecords] = useState<ComparisonRecord[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [status, setStatus] = useState<RecordStatus>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ComparisonRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [dashboardData, recordData, ruleData] = await Promise.all([
        getDashboard(profile),
        getRecords(profile),
        getRules(profile)
      ]);
      setDashboard(dashboardData);
      setRecords(recordData);
      setRules(ruleData);
      if (selected) {
        setSelected(recordData.find((item) => item.id === selected.id) || null);
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "无法连接后端服务"
      );
    } finally {
      setLoading(false);
    }
  }, [profile, selected?.id]);

  useEffect(() => {
    void loadData();
  }, [profile]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const filteredRecords = useMemo(() => {
    const text = query.trim().toLowerCase();
    return records.filter((record) => {
      const matchesStatus = status === "all" || record.status === status;
      const matchesQuery =
        !text ||
        [record.id, record.source, ...Object.values(record.before), ...Object.values(record.after)]
          .join(" ")
          .toLowerCase()
          .includes(text);
      return matchesStatus && matchesQuery;
    });
  }, [records, status, query]);

  async function handleDecision(decision: "approved" | "rejected") {
    if (!selected) return;
    try {
      await decideReview(selected.id, decision);
      setToast(decision === "approved" ? "已确认采用清洗结果" : "已驳回并保留原始值");
      await loadData();
    } catch (requestError) {
      setToast(requestError instanceof Error ? requestError.message : "操作失败");
    }
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const result = await uploadCsv(await file.text());
      setToast(`${result.message}，共 ${result.count} 条`);
      setSelected(null);
      await loadData();
    } catch (requestError) {
      setToast(requestError instanceof Error ? requestError.message : "上传失败");
    } finally {
      event.target.value = "";
    }
  }

  async function handleReset() {
    await resetDemo();
    setSelected(null);
    setToast("演示数据已恢复");
    await loadData();
  }

  const statusCounts = {
    all: records.length,
    changed: records.filter((row) => row.status === "changed").length,
    review: records.filter((row) => row.status === "review").length,
    unchanged: records.filter((row) => row.status === "unchanged").length
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><span /><span /></div>
          <div><strong>DataMirror</strong><small>数据治理工作台</small></div>
        </div>
        <div className="workspace-label">治理工作区</div>
        <nav>
          {[
            ["overview", "项目总览", "active"],
            ["source", "数据源管理", ""],
            ["rule", "规则设计器", ""],
            ["compare", "清洗对比", "count"],
            ["review", "人工复核", "review"],
            ["report", "质量报告", ""]
          ].map(([icon, label, badge]) => (
            <button className={badge === "active" ? "active" : ""} key={label}>
              <Icon name={icon} /><span>{label}</span>
              {badge === "count" && <em>{dashboard.field_changes}</em>}
              {badge === "review" && dashboard.review_count > 0 && <em className="warn">{dashboard.review_count}</em>}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="avatar">顾</div>
          <div><strong>治理顾问</strong><small>项目管理员</small></div>
          <button className="more">•••</button>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <div>
            <span>客户主数据治理</span>
            <i>/</i>
            <strong>2026 Q3 清洗批次</strong>
          </div>
          <div className="top-actions">
            <label className="profile-select">
              <span className={`profile-dot ${profile}`} />
              <select value={profile} onChange={(event) => setProfile(event.target.value as Profile)}>
                {Object.entries(PROFILE_LABELS).map(([value, label]) => (
                  <option value={value} key={value}>{label}</option>
                ))}
              </select>
            </label>
            <button className="secondary" onClick={() => fileInputRef.current?.click()}>
              <Icon name="upload" />上传 CSV
            </button>
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" hidden onChange={handleFile} />
            <a className="primary" href={`${API_BASE}/export.csv?profile=${profile}`}>
              <Icon name="export" />导出结果
            </a>
          </div>
        </header>

        <div className="content">
          <section className="page-heading">
            <div>
              <div className="eyebrow"><span className="live-dot" />批次运行正常 · 最后刷新 刚刚</div>
              <h1>清洗效果总览</h1>
              <p>对比原始数据与清洗结果，定位变化、风险与需要人工确认的记录。</p>
            </div>
            <div className="heading-actions">
              <button className="text-button" onClick={handleReset}>重置演示数据</button>
              <button className="run-button" onClick={() => void loadData()}>
                <span className={loading ? "spinner" : "play"}>{loading ? "" : "▶"}</span>
                {loading ? "正在执行" : "重新执行规则"}
              </button>
            </div>
          </section>

          {error && (
            <div className="error-banner">
              <strong>后端连接失败：</strong>{error}
              <span>请确认 FastAPI 已运行在 8000 端口。</span>
            </div>
          )}

          <section className="metrics">
            <MetricCard label="数据记录" value={dashboard.record_count.toLocaleString()} hint="当前演示批次" tone="violet" />
            <MetricCard label="变化记录" value={dashboard.changed_records.toLocaleString()} hint={`${dashboard.field_changes} 个字段被修改`} tone="blue" />
            <MetricCard label="质量得分" value={dashboard.quality.after.score} hint={`较清洗前 +${dashboard.quality_gain}`} tone="green" />
            <MetricCard label="待人工复核" value={dashboard.review_count} hint="含缺失与高风险推断" tone="amber" />
          </section>

          <section className="insight-grid">
            <article className="panel quality-panel">
              <div className="panel-header">
                <div><h2>质量指标对比</h2><p>四个维度衡量本次清洗效果</p></div>
                <div className="legend"><span className="before-dot" />清洗前 <span className="after-dot" />清洗后</div>
              </div>
              <div className="score-block">
                <div className="score-ring" style={{"--score": `${dashboard.quality.after.score * 3.6}deg`} as React.CSSProperties}>
                  <div><strong>{dashboard.quality.after.score}</strong><span>综合得分</span></div>
                </div>
                <div className="quality-list">
                  <QualityRow label="完整性" before={dashboard.quality.before.completeness} after={dashboard.quality.after.completeness} />
                  <QualityRow label="有效性" before={dashboard.quality.before.validity} after={dashboard.quality.after.validity} />
                  <QualityRow label="一致性" before={dashboard.quality.before.consistency} after={dashboard.quality.after.consistency} />
                  <QualityRow label="唯一性" before={dashboard.quality.before.uniqueness} after={dashboard.quality.after.uniqueness} />
                </div>
              </div>
            </article>

            <article className="panel rules-panel">
              <div className="panel-header">
                <div><h2>规则命中情况</h2><p>{PROFILE_LABELS[profile]} · {rules.filter((rule) => rule.enabled).length} 条已启用</p></div>
                <button className="link-button">查看规则集 <Icon name="arrow" /></button>
              </div>
              <div className="rule-list">
                {rules.slice(0, 5).map((rule) => (
                  <div className={`rule-item ${rule.enabled ? "" : "disabled"}`} key={rule.id}>
                    <span className={`risk-mark risk-${rule.risk}`} />
                    <div><strong>{rule.name}</strong><small>{rule.category} · 风险{rule.risk}</small></div>
                    <div className="rule-hits"><strong>{rule.hits}</strong><small>命中字段</small></div>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="panel workbench">
            <div className="panel-header workbench-header">
              <div><h2>数据变化工作台</h2><p>点击记录查看字段级修改依据和审计信息</p></div>
              <div className="search-box"><Icon name="search" /><input placeholder="搜索客户、来源或信用代码" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
            </div>
            <div className="tabs">
              {([
                ["all", "全部"],
                ["changed", "已变化"],
                ["review", "待复核"],
                ["unchanged", "无变化"]
              ] as [RecordStatus, string][]).map(([value, label]) => (
                <button className={status === value ? "active" : ""} onClick={() => setStatus(value)} key={value}>
                  {label}<span>{statusCounts[value]}</span>
                </button>
              ))}
              <div className="table-caption">显示 {filteredRecords.length} / {records.length} 条记录</div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>记录 / 来源</th>
                    <th>清洗前</th>
                    <th className="change-column">变化</th>
                    <th>清洗后</th>
                    <th>状态</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record) => (
                    <tr key={record.id} onClick={() => setSelected(record)}>
                      <td>
                        <strong className="record-id">{record.id}</strong>
                        <span className="source-tag">{record.source}</span>
                      </td>
                      <td>
                        <strong>{record.before.customer_name || "—"}</strong>
                        <small>{record.before.phone || "联系电话缺失"}</small>
                      </td>
                      <td className="change-column">
                        <span className={`change-count ${record.changes.length ? "" : "zero"}`}>
                          {record.changes.length ? `${record.changes.length} 项` : "—"}
                        </span>
                      </td>
                      <td>
                        <strong>{record.after.customer_name || "—"}</strong>
                        <small>{record.after.phone || "联系电话缺失"}</small>
                      </td>
                      <td>
                        {record.review_decision ? (
                          <span className={`status-pill ${record.review_decision.decision}`}>
                            {record.review_decision.decision === "approved" ? "已确认" : "已驳回"}
                          </span>
                        ) : (
                          <span className={`status-pill ${record.status}`}>
                            {record.status === "review" ? "待复核" : record.status === "changed" ? "已变化" : "无变化"}
                          </span>
                        )}
                      </td>
                      <td><button className="row-arrow"><Icon name="arrow" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filteredRecords.length && <div className="empty-state">没有符合当前条件的数据</div>}
            </div>
          </section>
        </div>
      </main>

      {selected && (
        <>
          <div className="drawer-backdrop" onClick={() => setSelected(null)} />
          <aside className="detail-drawer">
            <div className="drawer-header">
              <div><span className="source-tag">{selected.source}</span><h2>{selected.id} 变更详情</h2></div>
              <button onClick={() => setSelected(null)}><Icon name="close" /></button>
            </div>
            <div className="confidence-card">
              <div><span>系统建议置信度</span><strong>{Math.round(selected.confidence * 100)}%</strong></div>
              <div className="confidence-track"><span style={{width: `${selected.confidence * 100}%`}} /></div>
              <p>{selected.needs_review ? "检测到异常或高风险变更，建议人工确认。" : "规则结果稳定，可直接进入结果集。"}</p>
            </div>
            <div className="drawer-section">
              <h3>字段级变更 <span>{selected.changes.length}</span></h3>
              {selected.changes.length ? selected.changes.map((change, index) => (
                <div className="change-detail" key={`${change.field}-${index}`}>
                  <div className="change-title">
                    <strong>{FIELD_LABELS[change.field]}</strong>
                    <span className={`risk-chip ${change.risk}`}>{change.risk === "high" ? "高风险" : change.risk === "medium" ? "中风险" : "低风险"}</span>
                  </div>
                  <div className="value-diff">
                    <div><span>原始值</span><p>{change.before || "（空）"}</p></div>
                    <Icon name="arrow" />
                    <div className="after-value"><span>清洗值</span><p>{change.after || "（空）"}</p></div>
                  </div>
                  <div className="rule-evidence"><span>{change.rule_id}</span>{change.rule_name}</div>
                </div>
              )) : <div className="empty-change">该记录未产生字段变化</div>}
            </div>
            {selected.issues.length > 0 && (
              <div className="drawer-section">
                <h3>质量问题 <span>{selected.issues.length}</span></h3>
                <div className="issue-list">{selected.issues.map((issue) => <span key={issue}>{issue}</span>)}</div>
              </div>
            )}
            <div className="drawer-footer">
              {selected.review_decision ? (
                <div className="decision-done">
                  已由 {selected.review_decision.operator} {selected.review_decision.decision === "approved" ? "确认采用" : "驳回"}
                </div>
              ) : (
                <>
                  <button className="reject-button" onClick={() => void handleDecision("rejected")}>驳回修改</button>
                  <button className="approve-button" onClick={() => void handleDecision("approved")}>确认采用</button>
                </>
              )}
            </div>
          </aside>
        </>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

export default App;

