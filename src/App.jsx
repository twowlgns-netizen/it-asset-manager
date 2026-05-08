// ================================================================
// 🔑 Supabase 연결 설정
// ================================================================
const BASE_URL = "https://djykkruijwgckiqqqlpp.supabase.co/rest/v1";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqeWtrcnVpandnY2tpcXFxbHBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwODU5MDIsImV4cCI6MjA5MzY2MTkwMn0.wASj9FFOnmYMc3xJcGVuWSK3XreWYi9x3GToyAC6cEI";
const HEADERS = {
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

// ================================================================
// ⚙️ 상수 정의
// ================================================================
import { useState, useEffect, useCallback, useRef } from "react";

// 자산 상태
const ASSET_STATUS_OPTIONS = {
  active:          "사용중",
  inactive:        "미사용",
  repair:          "수리중",
  disposed:        "폐기",
  dispose_target:  "폐기대상",
};

// 자산 구분
const ASSET_TYPE_OPTIONS = {
  laptop:  "노트북",
  desktop: "데스크탑",
  monitor: "모니터",
  tablet:  "태블릿",
  etc:     "기타",
};

// 상태별 뱃지 색상
const STATUS_COLORS = {
  active:         { bg: "#e8f5e9", color: "#0f6e56" },
  inactive:       { bg: "#f1f5f9", color: "#64748b" },
  repair:         { bg: "#fff7ed", color: "#c2410c" },
  disposed:       { bg: "#fff1f0", color: "#cf1322" },
  dispose_target: { bg: "#fef3c7", color: "#d97706" },
};

// 전체 필드 정의 — key는 PostgreSQL 실제 컬럼명(소문자)과 일치시킴
const FIELDS = [
  { key: "num",            label: "번호",              type: "number"   },
  { key: "assetstatus",    label: "자산상태",           type: "select",   options: ASSET_STATUS_OPTIONS },
  { key: "inspectiondate", label: "실사 날짜",          type: "text"     },
  { key: "gccode",         label: "GC자산코드",         type: "text"     },
  { key: "imedcode",       label: "아이메드 자산코드",   type: "text"     },
  { key: "serialnumber",   label: "제조번호",            type: "text"     },
  { key: "ip",             label: "IP",                 type: "text"     },
  { key: "team",           label: "팀(부서명)",          type: "text"     },
  { key: "username",       label: "사용자",              type: "text"     },
  { key: "pcname",         label: "PC 이름",             type: "text"     },
  { key: "modelname",      label: "모델명",              type: "text"     },
  { key: "assettype",      label: "자산구분",            type: "select",   options: ASSET_TYPE_OPTIONS },
  { key: "notes",          label: "비고(이력관리)",      type: "textarea" },
  { key: "macaddress",     label: "MAC Address",        type: "text"     },
  { key: "receiptdate",    label: "자산 수령일",         type: "text"     },
  { key: "purchasedate",   label: "구입일자",            type: "text"     },
  { key: "manufacturer",   label: "제조사",              type: "text"     },
  { key: "cpu",            label: "CPU",                type: "text"     },
  { key: "memory",         label: "Memory",             type: "text"     },
  { key: "hdd",            label: "하드디스크",          type: "text"     },
  { key: "purpose",        label: "목적/기능",           type: "text"     },
  { key: "corporation",    label: "법인",                type: "text"     },
  { key: "location",       label: "위치(건물)",          type: "text"     },
  { key: "purchaseinfo",   label: "구매정보(전자결재)",  type: "text"     },
  { key: "monitorcount",   label: "모니터 수량",         type: "number"   },
  { key: "paidlicense",    label: "유료 라이선스",       type: "text"     },
];
// 한국어 라벨 → key 역매핑 (가져오기 시 사용)
const LABEL_TO_KEY = Object.fromEntries(FIELDS.map(f => [f.label, f.key]));
const FIELD_MAP    = Object.fromEntries(FIELDS.map(f => [f.key,   f   ]));

// 초기 사용자
const INIT_USERS = [
  { loginId: "admin", password: "admin123", name: "관리자", dept: "IT본부",   role: "admin" },
  { loginId: "user",  password: "user123",  name: "이영희", dept: "디자인팀", role: "user"  },
];

// ================================================================
// 🛠️ 유틸리티
// ================================================================
const nowISO = () => new Date().toISOString();
const fDateTime = (d) =>
  d ? new Date(d).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";

// 파일 다운로드 헬퍼
const triggerDownload = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

// 오늘 날짜 문자열 (파일명용)
const todayStr = () => new Date().toLocaleDateString("ko-KR").replace(/\. /g, "").replace(".", "");

// ================================================================
// 🌐 API 헬퍼
// ================================================================
const safeJson = async (res) => {
  if (!res.ok) { const t = await res.text().catch(() => ""); throw new Error(`HTTP ${res.status}: ${t}`); }
  const t = await res.text();
  if (!t || !t.trim()) return {};
  try { return JSON.parse(t); } catch { return {}; }
};

const api = {
  // 자산
  getHardware:    () => fetch(`${BASE_URL}/assets?select=*&order=num.asc.nullslast,created_at.desc&limit=100000`,
                        { headers: { ...HEADERS, "Range-Unit": "items", "Range": "0-99999" } }).then(safeJson),
  addHardware:    (data) => fetch(`${BASE_URL}/assets`,
                        { method: "POST", headers: { ...HEADERS, "Prefer": "return=representation" }, body: JSON.stringify(data) }).then(safeJson),
  updateHardware: (id, data) => fetch(`${BASE_URL}/assets?id=eq.${id}`,
                        { method: "PATCH", headers: { ...HEADERS, "Prefer": "return=representation" }, body: JSON.stringify(data) }).then(safeJson),
  deleteHardware: (id) => fetch(`${BASE_URL}/assets?id=eq.${id}`, { method: "DELETE", headers: HEADERS }).then(safeJson),

  // 사용자
  getUsers: () => fetch(`${BASE_URL}/users?select=*`, { headers: HEADERS }).then(safeJson),

  // 히스토리 (무제한)
  getHistory: () => fetch(`${BASE_URL}/history?select=*&order=ts.desc&limit=1000000`,
                      { headers: { ...HEADERS, "Range-Unit": "items", "Range": "0-999999" } }).then(safeJson),
  addHistory: (data) => fetch(`${BASE_URL}/history`,
                      { method: "POST", headers: HEADERS, body: JSON.stringify(data) }).then(safeJson),

  // 휴지통 (JSONB 방식)
  getTrash:    () => fetch(`${BASE_URL}/trash?select=*&order=created_at.desc`, { headers: HEADERS }).then(safeJson),
  addTrash:    (data) => fetch(`${BASE_URL}/trash`,
                      { method: "POST", headers: { ...HEADERS, "Prefer": "return=representation" }, body: JSON.stringify(data) }).then(safeJson),
  deleteTrash: (id) => fetch(`${BASE_URL}/trash?id=eq.${id}`, { method: "DELETE", headers: HEADERS }).then(safeJson),
};

// ================================================================
// 🏠 [메인 앱]
// ================================================================
export default function App() {
  const [isLoggedIn,  setIsLoggedIn]  = useState(() => localStorage.getItem("isLoggedIn") === "true");
  const [currentUser, setCurrentUser] = useState(() => {
    const s = localStorage.getItem("currentUser"); return s ? JSON.parse(s) : null;
  });
  const [view,     setView]     = useState("dashboard");
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 768 : false);
  const [hardware, setHardware] = useState([]);
  const [users,    setUsers]    = useState(INIT_USERS);
  const [history,  setHistory]  = useState([]);
  const [trash,    setTrash]    = useState([]);

  const handleLogin  = (user) => { setIsLoggedIn(true); setCurrentUser(user); localStorage.setItem("isLoggedIn", "true"); localStorage.setItem("currentUser", JSON.stringify(user)); };
  const handleLogout = ()     => { setIsLoggedIn(false); setCurrentUser(null); localStorage.removeItem("isLoggedIn"); localStorage.removeItem("currentUser"); };

  const fetchAll = useCallback(() => {
    api.getHardware().then(d => setHardware(Array.isArray(d) ? d : [])).catch(console.error);
    api.getUsers().then(d => setUsers(Array.isArray(d) && d.length ? d : INIT_USERS)).catch(console.error);
    api.getHistory().then(d => { const l = Array.isArray(d) ? d : []; setHistory(l.sort((a,b) => new Date(b.ts)-new Date(a.ts))); }).catch(console.error);
    api.getTrash().then(d => setTrash(Array.isArray(d) ? d : [])).catch(console.error);
  }, []);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    fetchAll();
    return () => window.removeEventListener("resize", onResize);
  }, [fetchAll]);

  const addHistory = useCallback((action, aType, aId, aName, detail) => {
    if (!currentUser) return;
    api.addHistory({ ts: nowISO(), action, aType, aId, aName, detail, userName: currentUser.name })
      .then(() => api.getHistory().then(d => { const l = Array.isArray(d)?d:[]; setHistory(l.sort((a,b)=>new Date(b.ts)-new Date(a.ts))); }))
      .catch(console.error);
  }, [currentUser]);

  if (!isLoggedIn) return <LoginPage onLogin={handleLogin} users={users} />;
  const canEdit = currentUser?.role === "admin" || currentUser?.role === "user";

  const menuItems = [
    { id: "dashboard", label: "홈",    icon: "🏠" },
    { id: "hardware",  label: "장비",  icon: "🖥️" },
    { id: "history",   label: "로그",  icon: "📝" },
    { id: "trash",     label: "휴지통", icon: "🗑️" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", height: "100vh", background: "#f8fafc", overflow: "hidden" }}>
      {!isMobile && (
        <div style={{ width: 220, background: "#fff", borderRight: "1px solid #e2e8f0", padding: "24px", display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f6e56", marginBottom: 32 }}>IT Asset Manager</div>
          <div style={{ flex: 1 }}>
            {menuItems.map(m => (
              <div key={m.id} onClick={() => setView(m.id)}
                style={{ padding: "11px 14px", borderRadius: 10, cursor: "pointer", background: view===m.id ? "#e8f5e9" : "transparent", color: view===m.id ? "#0f6e56" : "#64748b", fontWeight: 700, marginBottom: 4, fontSize: 14 }}>
                {m.icon} {m.label}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>{currentUser?.name} ({currentUser?.dept})</div>
          <Btn onClick={handleLogout}>로그아웃</Btn>
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto" }}>
        {isMobile && (
          <div style={{ background: "#fff", padding: "14px 18px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 10 }}>
            <span style={{ fontWeight: 800, color: "#0f6e56", fontSize: 16 }}>Asset Manager</span>
            <Btn onClick={handleLogout} style={{ fontSize: 11, padding: "5px 10px" }}>로그아웃</Btn>
          </div>
        )}
        <main style={{ padding: isMobile ? "16px" : "36px", paddingBottom: 100 }}>
          {view === "dashboard" && <DashboardSection hw={hardware} history={history} isMobile={isMobile} />}
          {view === "hardware"  && <HardwareSection data={hardware} setHardware={setHardware} addHistory={addHistory} canEdit={canEdit} trash={trash} setTrash={setTrash} />}
          {view === "history"   && <HistorySection history={history} />}
          {view === "trash"     && <TrashSection trash={trash} setTrash={setTrash} setHardware={setHardware} addHistory={addHistory} canEdit={canEdit} />}
        </main>
      </div>

      {isMobile && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: 65, background: "#fff", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "space-around", alignItems: "center", zIndex: 1000 }}>
          {menuItems.map(m => (
            <div key={m.id} onClick={() => setView(m.id)} style={{ textAlign: "center", color: view===m.id ? "#0f6e56" : "#94a3b8" }}>
              <div style={{ fontSize: 20 }}>{m.icon}</div>
              <div style={{ fontSize: 10 }}>{m.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ================================================================
// 📊 [대시보드]
// ================================================================
function DashboardSection({ hw, history, isMobile }) {
  const counts = {
    total:          hw.length,
    active:         hw.filter(h => h.assetstatus === "active").length,
    disposed:       hw.filter(h => h.assetstatus === "disposed" || h.assetstatus === "dispose_target").length,
    repair:         hw.filter(h => h.assetstatus === "repair").length,
  };
  const cards = [
    { label: "전체 장비",   value: counts.total,    color: "#0f6e56" },
    { label: "사용중",      value: counts.active,   color: "#2563eb" },
    { label: "폐기/대상",   value: counts.disposed, color: "#cf1322" },
    { label: "수리중",      value: counts.repair,   color: "#d97706" },
    { label: "활동 로그",   value: history.length,  color: "#7c3aed" },
  ];
  return (
    <div>
      <h2 style={{ fontSize: 22, marginBottom: 20, fontWeight: 700 }}>실시간 현황 요약</h2>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(5, 1fr)", gap: 14, marginBottom: 32 }}>
        {cards.map(c => (
          <div key={c.label} style={{ background: "#fff", padding: "18px 20px", borderRadius: 18, border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>
      <h3 style={{ fontSize: 15, marginBottom: 12, fontWeight: 700 }}>최근 활동</h3>
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #eee", overflow: "hidden" }}>
        {history.slice(0, 10).length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: "#94a3b8" }}>활동 기록이 없습니다.</div>
        ) : (
          history.slice(0, 10).map((h, i) => (
            <div key={i} style={{ padding: "12px 18px", borderBottom: "1px solid #f8fafc", display: "flex", gap: 16, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "#94a3b8", flexShrink: 0 }}>{fDateTime(h.ts)}</span>
              <span style={{ fontSize: 13, color: "#334155" }}><b>{h.username}</b> · {h.action} · {h.aName}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ================================================================
// 🖥️ [하드웨어] 메인 섹션
// 전체 컬럼 목록 (key, label)
const ALL_COLS = [
  { key: "num",           label: "번호"         },
  { key: "assetstatus",   label: "자산상태"      },
  { key: "inspectiondate",label: "실사날짜"      },
  { key: "gccode",        label: "GC자산코드"    },
  { key: "imedcode",      label: "아이메드코드"   },
  { key: "serialnumber",  label: "제조번호"      },
  { key: "ip",            label: "IP"           },
  { key: "team",          label: "팀(부서명)"    },
  { key: "username",      label: "사용자"        },
  { key: "pcname",        label: "PC이름"       },
  { key: "modelname",     label: "모델명"        },
  { key: "assettype",     label: "자산구분"      },
  { key: "notes",         label: "비고(이력관리)" },
  { key: "macaddress",    label: "MAC Address"  },
  { key: "receiptdate",   label: "수령일"        },
  { key: "purchasedate",  label: "구입일"        },
  { key: "manufacturer",  label: "제조사"        },
  { key: "cpu",           label: "CPU"          },
  { key: "memory",        label: "Memory"       },
  { key: "hdd",           label: "하드디스크"    },
  { key: "purpose",       label: "목적/기능"     },
  { key: "corporation",   label: "법인"          },
  { key: "location",      label: "위치(건물)"    },
  { key: "purchaseinfo",  label: "구매정보"      },
  { key: "monitorcount",  label: "모니터수량"    },
  { key: "paidlicense",   label: "유료라이선스"  },
];
// 기본으로 보여줄 컬럼
const DEFAULT_VISIBLE = new Set(["num","assetstatus","gccode","team","username","modelname","assettype","location"]);

// ================================================================
function HardwareSection({ data, setHardware, addHistory, canEdit, trash, setTrash }) {
  const [modal,        setModal]        = useState(null);
  const [form,         setForm]         = useState({});
  const [detailItem,   setDetailItem]   = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [importLoading,setImportLoading] = useState(false);
  const [searchText,   setSearchText]   = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType,   setFilterType]   = useState("");
  const [showColMenu,  setShowColMenu]  = useState(false);  // 컬럼 선택 패널 열림/닫힘
  const [visibleCols,  setVisibleCols]  = useState(DEFAULT_VISIBLE); // 보이는 컬럼 Set
  const fileInputRef = useRef(null);
  const colMenuRef   = useRef(null);

  // 컬럼 메뉴 바깥 클릭 시 닫기
  useEffect(() => {
    const handler = (e) => { if (colMenuRef.current && !colMenuRef.current.contains(e.target)) setShowColMenu(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // 컬럼 토글
  const toggleCol = (key) => {
    setVisibleCols(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };
  // 전체 선택/해제
  const toggleAll = (selectAll) => {
    setVisibleCols(selectAll ? new Set(ALL_COLS.map(c => c.key)) : new Set(["gccode"]));
  };

  // ── 검색/필터 ──
  const filtered = data.filter(h => {
    const q = searchText.trim().toLowerCase();
    const matchText = !q || [h.gccode, h.imedcode, h.username, h.team, h.modelname, h.location, h.pcname, h.serialnumber]
      .some(v => (v || "").toLowerCase().includes(q));
    const matchStatus = !filterStatus || h.assetstatus === filterStatus;
    const matchType   = !filterType   || h.assettype   === filterType;
    return matchText && matchStatus && matchType;
  });

  // ── 저장 (등록/수정) ──
  const save = () => {
    if (!form.gccode && !form.modelname && !form.imedcode) return alert("GC자산코드 또는 모델명을 입력하세요.");
    setLoading(true);
    const isAdd = modal === "add";
    const req = isAdd ? api.addHardware(form) : api.updateHardware(form.id, form);
    req.then(() => api.getHardware())
      .then(list => {
        const fresh = Array.isArray(list) ? list : [];
        setHardware(fresh);
        const name = form.gccode || form.modelname || form.imedcode || "자산";
        if (isAdd) { const c = fresh.find(h => h.gccode === form.gccode); addHistory("하드웨어 등록", "hardware", c?.id ?? "", name, "신규 등록"); }
        else         addHistory("하드웨어 수정", "hardware", form.id, name, "정보 수정");
        setModal(null);
      })
      .catch(err => alert(`오류: ${err.message}`))
      .finally(() => setLoading(false));
  };

  // ── 삭제 → 휴지통 ──
  const deleteItem = (item) => {
    const name = item.gccode || item.modelname || "자산";
    if (!window.confirm(`"${name}"을(를) 휴지통으로 이동하시겠습니까?`)) return;
    api.deleteHardware(item.id)
      .then(() => api.addTrash({ item_data: item, deletedAt: nowISO() }))
      .then(added => {
        setHardware(prev => prev.filter(h => h.id !== item.id));
        const t = Array.isArray(added) ? added[0] : added;
        setTrash(prev => [...prev, t]);
        addHistory("하드웨어 삭제", "hardware", item.id, name, "휴지통 이동");
      })
      .catch(err => alert("삭제 중 오류: " + err.message));
  };

  // ── CSV 내보내기 ──
  const exportCSV = () => {
    const header = FIELDS.map(f => f.label).join(",");
    const rows = data.map(item =>
      FIELDS.map(f => `"${String(item[f.key] ?? "").replace(/"/g, '""')}"`).join(",")
    );
    const csv = "\uFEFF" + [header, ...rows].join("\n"); // BOM 추가 (한글 깨짐 방지)
    triggerDownload(new Blob([csv], { type: "text/csv;charset=utf-8" }), `자산목록_${todayStr()}.csv`);
  };

  // ── Excel 내보내기 ──
  const exportExcel = async () => {
    try {
      const XLSX = await import("xlsx");
      const exportData = data.map(item => {
        const row = {};
        FIELDS.forEach(f => { row[f.label] = item[f.key] ?? ""; });
        return row;
      });
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "자산목록");
      XLSX.writeFile(wb, `자산목록_${todayStr()}.xlsx`);
    } catch {
      alert("xlsx 패키지를 설치해주세요: npm install xlsx");
    }
  };

  // ── CSV 파싱 헬퍼 ──
  const parseCSVLine = (line) => {
    const result = []; let cur = ""; let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++; } else { inQ = !inQ; } }
      else if (c === "," && !inQ) { result.push(cur.trim()); cur = ""; }
      else cur += c;
    }
    result.push(cur.trim());
    return result;
  };

  // ── 파일 가져오기 (CSV / Excel) ──
  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportLoading(true);
    try {
      let rawRows = [];

      if (file.name.toLowerCase().endsWith(".csv")) {
        // BOM 제거 후 CSV 파싱
        const text = (await file.text()).replace(/^\uFEFF/, "");
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        const headers = parseCSVLine(lines[0]);
        rawRows = lines.slice(1).map(line => {
          const vals = parseCSVLine(line);
          const obj = {};
          headers.forEach((h, i) => { obj[h] = vals[i] || ""; });
          return obj;
        });
      } else {
        // Excel (.xlsx / .xls)
        const XLSX = await import("xlsx");
        const buf  = await file.arrayBuffer();
        const wb   = XLSX.read(buf, { type: "array", cellDates: true });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        rawRows = XLSX.utils.sheet_to_json(ws, { defval: "" });
      }

      // 헤더를 key로 변환 (한국어 라벨 또는 영문 key 모두 지원)
      const items = rawRows
        .filter(row => Object.values(row).some(v => v !== ""))
        .map(row => {
          const item = { assetstatus: "active", assettype: "laptop" };
          FIELDS.forEach(f => {
            const val = row[f.label] !== undefined ? row[f.label] : (row[f.key] !== undefined ? row[f.key] : "");
            if (val !== "") item[f.key] = val;
          });
          return item;
        });

      if (!items.length) { alert("가져올 데이터가 없습니다."); return; }
      if (!window.confirm(`${items.length}건의 데이터를 가져오시겠습니까?`)) return;

      // Supabase 일괄 삽입
      const res = await fetch(`${BASE_URL}/assets`, {
        method: "POST",
        headers: { ...HEADERS, "Prefer": "return=representation" },
        body: JSON.stringify(items),
      });
      if (!res.ok) { const err = await res.text(); throw new Error(err); }

      await api.getHardware().then(list => setHardware(Array.isArray(list) ? list : []));
      addHistory("파일 가져오기", "hardware", "", `${items.length}건`, `${file.name}`);
      alert(`${items.length}건 가져오기 완료!`);
    } catch (err) {
      console.error(err);
      alert("가져오기 실패: " + err.message);
    } finally {
      setImportLoading(false);
      e.target.value = "";
    }
  };

  return (
    <div>
      {/* ── 상단 툴바 ── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>하드웨어 <span style={{ fontSize: 14, color: "#64748b", fontWeight: 500 }}>전체 {data.length}건 {filtered.length !== data.length ? `· 필터 ${filtered.length}건` : ""}</span></h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {/* 파일 가져오기 */}
            <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleImport} style={{ display: "none" }} />
            <Btn onClick={() => fileInputRef.current?.click()} disabled={importLoading}>
              {importLoading ? "가져오는 중..." : "📂 가져오기"}
            </Btn>
            <Btn onClick={exportCSV}>⬇️ CSV</Btn>
            <Btn onClick={exportExcel}>⬇️ Excel</Btn>

            {/* 컬럼 선택 버튼 */}
            <div ref={colMenuRef} style={{ position: "relative" }}>
              <Btn onClick={() => setShowColMenu(v => !v)}>
                🔧 컬럼 선택 {visibleCols.size}/{ALL_COLS.length}
              </Btn>
              {showColMenu && (
                <div style={{
                  position: "absolute", top: "calc(100% + 6px)", right: 0,
                  background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.12)", zIndex: 500,
                  padding: 16, width: 260,
                }}>
                  {/* 전체 선택/해제 */}
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid #f0f0f0" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>표시할 컬럼 선택</span>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => toggleAll(true)}  style={{ fontSize: 11, color: "#0f6e56", border: "none", background: "none", cursor: "pointer", fontWeight: 600 }}>전체</button>
                      <button onClick={() => toggleAll(false)} style={{ fontSize: 11, color: "#cf1322", border: "none", background: "none", cursor: "pointer", fontWeight: 600 }}>초기화</button>
                    </div>
                  </div>
                  {/* 컬럼 체크박스 목록 */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, maxHeight: 320, overflowY: "auto" }}>
                    {ALL_COLS.map(c => (
                      <label key={c.key} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 4px", borderRadius: 6, cursor: "pointer", fontSize: 12,
                        background: visibleCols.has(c.key) ? "#e8f5e9" : "transparent",
                        color: visibleCols.has(c.key) ? "#0f6e56" : "#64748b", fontWeight: visibleCols.has(c.key) ? 600 : 400,
                      }}>
                        <input type="checkbox" checked={visibleCols.has(c.key)} onChange={() => toggleCol(c.key)}
                          style={{ accentColor: "#0f6e56", width: 13, height: 13 }} />
                        {c.label}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {canEdit && <Btn onClick={() => { setForm({ assetstatus: "active", assettype: "laptop" }); setModal("add"); }} variant="primary">+ 등록</Btn>}
          </div>
        </div>

        {/* ── 검색/필터 바 ── */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}>🔍</span>
            <input
              placeholder="GC코드, 사용자, 팀, 모델명 검색..."
              value={searchText} onChange={e => setSearchText(e.target.value)}
              style={{ width: "100%", padding: "9px 32px 9px 32px", borderRadius: 10, border: "1px solid #ddd", fontSize: 13, boxSizing: "border-box" }}
            />
            {searchText && <button onClick={() => setSearchText("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}>✕</button>}
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            style={{ padding: "9px 12px", borderRadius: 10, border: "1px solid #ddd", fontSize: 13, background: "#fff" }}>
            <option value="">상태 전체</option>
            {Object.entries(ASSET_STATUS_OPTIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            style={{ padding: "9px 12px", borderRadius: 10, border: "1px solid #ddd", fontSize: 13, background: "#fff" }}>
            <option value="">구분 전체</option>
            {Object.entries(ASSET_TYPE_OPTIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          {(searchText || filterStatus || filterType) && (
            <Btn onClick={() => { setSearchText(""); setFilterStatus(""); setFilterType(""); }}>초기화</Btn>
          )}
        </div>
      </div>

      {/* ── 테이블 (전체 컬럼) ── */}
      {(() => {
        // 전체 컬럼 정의
        const allColDefs = [
          { key: "num",           label: "번호",          render: h => <span style={{ color: "#64748b", fontSize: 12 }}>{h.num || "-"}</span> },
          { key: "assetstatus",   label: "자산상태",       render: h => {
            const s = STATUS_COLORS[h.assetstatus] || { bg: "#f1f5f9", color: "#64748b" };
            return <span style={{ background: s.bg, color: s.color, padding: "3px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
              {ASSET_STATUS_OPTIONS[h.assetstatus] || h.assetstatus || "-"}
            </span>;
          }},
          { key: "inspectiondate",label: "실사날짜",       render: h => <span style={{ fontSize: 12 }}>{h.inspectiondate || "-"}</span> },
          { key: "gccode",        label: "GC자산코드",     render: h => <b style={{ fontSize: 12 }}>{h.gccode || "-"}</b> },
          { key: "imedcode",      label: "아이메드코드",    render: h => <span style={{ fontSize: 12 }}>{h.imedcode || "-"}</span> },
          { key: "serialnumber",  label: "제조번호",        render: h => <span style={{ fontSize: 12 }}>{h.serialnumber || "-"}</span> },
          { key: "ip",            label: "IP",             render: h => <span style={{ fontSize: 12 }}>{h.ip || "-"}</span> },
          { key: "team",          label: "팀(부서명)",      render: h => <span style={{ fontSize: 12 }}>{h.team || "-"}</span> },
          { key: "username",      label: "사용자",          render: h => <span style={{ fontSize: 12 }}>{h.username || "-"}</span> },
          { key: "pcname",        label: "PC이름",          render: h => <span style={{ fontSize: 12 }}>{h.pcname || "-"}</span> },
          { key: "modelname",     label: "모델명",          render: h => <span style={{ fontSize: 12 }}>{h.modelname || "-"}</span> },
          { key: "assettype",     label: "자산구분",        render: h => <span style={{ fontSize: 12 }}>{ASSET_TYPE_OPTIONS[h.assettype] || h.assettype || "-"}</span> },
          { key: "notes",         label: "비고(이력관리)",  render: h => <span style={{ fontSize: 12, maxWidth: 140, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.notes || "-"}</span> },
          { key: "macaddress",    label: "MAC Address",    render: h => <span style={{ fontSize: 11 }}>{h.macaddress || "-"}</span> },
          { key: "receiptdate",   label: "수령일",          render: h => <span style={{ fontSize: 12 }}>{h.receiptdate || "-"}</span> },
          { key: "purchasedate",  label: "구입일",          render: h => <span style={{ fontSize: 12 }}>{h.purchasedate || "-"}</span> },
          { key: "manufacturer",  label: "제조사",          render: h => <span style={{ fontSize: 12 }}>{h.manufacturer || "-"}</span> },
          { key: "cpu",           label: "CPU",            render: h => <span style={{ fontSize: 12 }}>{h.cpu || "-"}</span> },
          { key: "memory",        label: "Memory",         render: h => <span style={{ fontSize: 12 }}>{h.memory || "-"}</span> },
          { key: "hdd",           label: "하드디스크",      render: h => <span style={{ fontSize: 12 }}>{h.hdd || "-"}</span> },
          { key: "purpose",       label: "목적/기능",       render: h => <span style={{ fontSize: 12 }}>{h.purpose || "-"}</span> },
          { key: "corporation",   label: "법인",            render: h => <span style={{ fontSize: 12 }}>{h.corporation || "-"}</span> },
          { key: "location",      label: "위치(건물)",      render: h => <span style={{ fontSize: 12 }}>{h.location || "-"}</span> },
          { key: "purchaseinfo",  label: "구매정보",        render: h => <span style={{ fontSize: 12 }}>{h.purchaseinfo || "-"}</span> },
          { key: "monitorcount",  label: "모니터수량",      render: h => <span style={{ fontSize: 12 }}>{h.monitorcount ?? "-"}</span> },
          { key: "paidlicense",   label: "유료라이선스",    render: h => <span style={{ fontSize: 12 }}>{h.paidlicense || "-"}</span> },
        ];

        // visibleCols에 있는 컬럼만 필터링 + 관리 버튼 항상 마지막에 추가
        const visibleColDefs = allColDefs.filter(c => visibleCols.has(c.key));
        if (canEdit) visibleColDefs.push({
          key: "__manage", label: "관리",
          render: h => (
            <div style={{ display: "flex", gap: 4 }}>
              <Btn onClick={() => { setDetailItem(h); setModal("detail"); }} style={{ fontSize: 11, padding: "5px 8px" }}>상세</Btn>
              <Btn onClick={() => { setForm(h); setModal("edit"); }}         style={{ fontSize: 11, padding: "5px 8px" }}>수정</Btn>
              <Btn onClick={() => deleteItem(h)} variant="danger"           style={{ fontSize: 11, padding: "5px 8px" }}>삭제</Btn>
            </div>
          ),
        });

        return (
          <ResponsiveTable
            cols={visibleColDefs}
            rows={filtered}
            empty={searchText || filterStatus || filterType ? "검색 조건에 맞는 항목이 없습니다." : "등록된 자산이 없습니다."}
          />
        );
      })()}

      {/* ── 등록/수정 모달 ── */}
      {(modal === "add" || modal === "edit") && (
        <Modal title={modal === "add" ? "새 자산 등록" : "자산 정보 수정"} onClose={() => setModal(null)}>
          <HardwareForm form={form} setForm={setForm} onSave={save} loading={loading} />
        </Modal>
      )}

      {/* ── 상세 모달 ── */}
      {modal === "detail" && detailItem && (
        <Modal title={`상세 정보 — ${detailItem.gccode || detailItem.modelname || ""}`} onClose={() => setModal(null)}>
          <HardwareDetail item={detailItem} />
        </Modal>
      )}
    </div>
  );
}

// ================================================================
// 📋 [하드웨어 폼] 등록/수정 전용 폼
// ================================================================
const FORM_SECTIONS = [
  { title: "📌 기본 정보",    keys: ["num", "assetstatus", "inspectiondate", "gccode", "imedcode"] },
  { title: "🌐 네트워크/장치", keys: ["ip", "macaddress", "pcname", "modelname", "assettype", "serialnumber"] },
  { title: "👤 사용자/위치",  keys: ["team", "username", "corporation", "location"] },
  { title: "⚙️ 사양",        keys: ["manufacturer", "cpu", "memory", "hdd"] },
  { title: "🛒 구매 정보",    keys: ["receiptdate", "purchasedate", "purpose", "purchaseinfo"] },
  { title: "📎 기타",        keys: ["notes", "monitorcount", "paidlicense"] },
];

function HardwareForm({ form, setForm, onSave, loading }) {
  const inputStyle = { padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 13, width: "100%", boxSizing: "border-box" };

  return (
    <div style={{ maxHeight: "62vh", overflowY: "auto", paddingRight: 6 }}>
      {FORM_SECTIONS.map(sec => (
        <div key={sec.title} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#0f6e56", padding: "4px 0 8px", borderBottom: "1px solid #e2e8f0", marginBottom: 10 }}>
            {sec.title}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {sec.keys.map(key => {
              const f = FIELD_MAP[key]; if (!f) return null;

              if (f.type === "select") return (
                <label key={key} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <span style={{ fontSize: 11, color: "#64748b" }}>{f.label}</span>
                  <select value={form[key] || ""} onChange={e => setForm({ ...form, [key]: e.target.value })} style={inputStyle}>
                    <option value="">선택...</option>
                    {Object.entries(f.options).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </label>
              );

              if (f.type === "textarea") return (
                <label key={key} style={{ display: "flex", flexDirection: "column", gap: 3, gridColumn: "1 / -1" }}>
                  <span style={{ fontSize: 11, color: "#64748b" }}>{f.label}</span>
                  <textarea value={form[key] || ""} onChange={e => setForm({ ...form, [key]: e.target.value })}
                    rows={3} style={{ ...inputStyle, resize: "vertical" }} />
                </label>
              );

              return (
                <label key={key} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <span style={{ fontSize: 11, color: "#64748b" }}>{f.label}</span>
                  <input type={f.type} value={form[key] || ""} onChange={e => setForm({ ...form, [key]: e.target.value })} style={inputStyle} />
                </label>
              );
            })}
          </div>
        </div>
      ))}
      <Btn onClick={onSave} variant="primary" disabled={loading} style={{ width: "100%", padding: 14, marginTop: 4 }}>
        {loading ? "저장 중..." : "저장"}
      </Btn>
    </div>
  );
}

// ================================================================
// 🔍 [하드웨어 상세] 읽기 전용 모든 필드 뷰
// ================================================================
function HardwareDetail({ item }) {
  return (
    <div style={{ maxHeight: "62vh", overflowY: "auto" }}>
      {FORM_SECTIONS.map(sec => {
        const visibleFields = sec.keys.filter(k => item[k] !== undefined && item[k] !== "" && item[k] !== null);
        if (!visibleFields.length) return null;
        return (
          <div key={sec.title} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#0f6e56", padding: "4px 0 8px", borderBottom: "1px solid #e2e8f0", marginBottom: 10 }}>
              {sec.title}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {visibleFields.map(key => {
                const f = FIELD_MAP[key]; if (!f) return null;
                const val = item[key];
                const display = f.type === "select" ? (f.options?.[val] || val) : String(val);
                return (
                  <div key={key} style={{ padding: "8px 12px", background: "#f8fafc", borderRadius: 8, gridColumn: f.type === "textarea" ? "1 / -1" : "auto" }}>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 2 }}>{f.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", wordBreak: "break-all" }}>{display}</div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ================================================================
// 📝 [히스토리] 활동 로그 + 검색
// ================================================================
function HistorySection({ history }) {
  const [query, setQuery] = useState("");
  const [field, setField] = useState("all");

  const filtered = history.filter(h => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    if (field === "userName") return (h.userName || "").toLowerCase().includes(q);
    if (field === "action")   return (h.action   || "").toLowerCase().includes(q);
    if (field === "aName")    return (h.aName    || "").toLowerCase().includes(q);
    return ["userName","action","aName"].some(k => (h[k] || "").toLowerCase().includes(q));
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h2 style={{ margin: 0 }}>활동 로그</h2>
        <span style={{ fontSize: 13, color: "#64748b" }}>
          전체 <b style={{ color: "#0f6e56" }}>{history.length}</b>건{query && ` · 검색 ${filtered.length}건`}
        </span>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <select value={field} onChange={e => setField(e.target.value)}
          style={{ padding: "9px 12px", borderRadius: 10, border: "1px solid #ddd", fontSize: 13, background: "#fff" }}>
          <option value="all">전체</option>
          <option value="userName">수행자</option>
          <option value="action">액션</option>
          <option value="aName">대상</option>
        </select>
        <div style={{ flex: 1, position: "relative" }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}>🔍</span>
          <input type="text" placeholder="검색어 입력..." value={query} onChange={e => setQuery(e.target.value)}
            style={{ width: "100%", padding: "9px 32px 9px 32px", borderRadius: 10, border: "1px solid #ddd", fontSize: 13, boxSizing: "border-box" }} />
          {query && <button onClick={() => setQuery("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}>✕</button>}
        </div>
      </div>
      <ResponsiveTable
        cols={[
          { label: "시간",   render: h => <span style={{ fontSize: 11, whiteSpace: "nowrap" }}>{fDateTime(h.ts)}</span> },
          { label: "수행자", key: "userName" },
          { label: "액션",   key: "action"   },
          { label: "대상",   key: "aName"    },
          { label: "상세",   key: "detail"   },
        ]}
        rows={filtered}
        empty={query ? `"${query}" 검색 결과 없음` : "로그가 없습니다."}
      />
    </div>
  );
}

// ================================================================
// 🗑️ [휴지통] JSONB 방식
// ================================================================
function TrashSection({ trash, setTrash, setHardware, addHistory, canEdit }) {
  const getItemData = t =>
    typeof t.item_data === "string" ? (()=>{ try{return JSON.parse(t.item_data);}catch{return {};} })() : (t.item_data || {});

  const restore = (trashItem) => {
    const orig = getItemData(trashItem);
    const { id, created_at, ...restData } = orig;
    api.deleteTrash(trashItem.id)
      .then(() => fetch(`${BASE_URL}/assets`, {
        method: "POST",
        headers: { ...HEADERS, "Prefer": "return=representation" },
        body: JSON.stringify(restData),
      }).then(safeJson))
      .then(restored => {
        setTrash(prev => prev.filter(t => t.id !== trashItem.id));
        const item = Array.isArray(restored) ? restored[0] : restored;
        setHardware(prev => [...prev, item]);
        const name = restData.gccode || restData.modelname || "자산";
        addHistory("데이터 복구", "assets", item?.id, name, "복구됨");
      })
      .catch(err => alert("복구 오류: " + err.message));
  };

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>휴지통 ({trash.length}건)</h2>
      <ResponsiveTable
        cols={[
          { label: "GC자산코드", render: i => { const d=getItemData(i); return d.gccode || d.modelname || "-"; } },
          { label: "팀",         render: i => getItemData(i).team     || "-" },
          { label: "사용자",     render: i => getItemData(i).username || "-" },
          { label: "자산구분",   render: i => ASSET_TYPE_OPTIONS[getItemData(i).assettype]   || "-" },
          { label: "삭제일",     render: i => fDateTime(i.deletedAt) },
          { label: "관리",       render: i => canEdit && <Btn onClick={() => restore(i)} variant="warning">복구</Btn> },
        ]}
        rows={trash}
        empty="휴지통이 비어있습니다."
      />
    </div>
  );
}

// ================================================================
// 🔑 [로그인]
// ================================================================
function LoginPage({ onLogin, users }) {
  const [id, setId] = useState(""); const [pw, setPw] = useState("");
  const submit = e => {
    e.preventDefault();
    const user = users.find(u => u.loginId === id && u.password === pw);
    if (user) onLogin(user); else alert("아이디 또는 비밀번호가 틀립니다.");
  };
  return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f1f5f9" }}>
      <form onSubmit={submit} style={{ width: 340, background: "#fff", padding: 40, borderRadius: 24, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
        <h1 style={{ textAlign: "center", color: "#0f6e56", marginBottom: 8, fontSize: 24 }}>IT Asset Manager</h1>
        <p style={{ textAlign: "center", color: "#94a3b8", marginBottom: 28, fontSize: 13 }}>GC녹십자아이메드 IT자산관리 (시스템운영)</p>
        <input placeholder="아이디" value={id} onChange={e => setId(e.target.value)} required
          style={{ width: "100%", padding: 14, marginBottom: 10, borderRadius: 10, border: "1px solid #eee", fontSize: 14, boxSizing: "border-box" }} />
        <input type="password" placeholder="비밀번호" value={pw} onChange={e => setPw(e.target.value)} required
          style={{ width: "100%", padding: 14, marginBottom: 20, borderRadius: 10, border: "1px solid #eee", fontSize: 14, boxSizing: "border-box" }} />
        <Btn type="submit" variant="primary" style={{ width: "100%", padding: 15, fontSize: 15 }}>로그인</Btn>
      </form>
    </div>
  );
}

// ================================================================
// 🔘 Btn
// ================================================================
function Btn({ onClick, variant="default", children, style={}, disabled=false, type="button" }) {
  const S = {
    default: { background: "#fff",    color: "#333",    border: "1px solid #ddd"    },
    primary: { background: "#0f6e56", color: "#fff",    border: "none"              },
    danger:  { background: "#fff1f0", color: "#cf1322", border: "1px solid #ffa39e" },
    warning: { background: "#fffbe6", color: "#d48806", border: "1px solid #ffe58f" },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      style={{ padding: "10px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: disabled?"not-allowed":"pointer", opacity: disabled?0.6:1, ...S[variant], ...style }}>
      {children}
    </button>
  );
}

// ================================================================
// 🪟 Modal
// ================================================================
function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 560, padding: 24, maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#94a3b8" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ================================================================
// 📋 ResponsiveTable
// ================================================================
function ResponsiveTable({ cols, rows, empty="데이터가 없습니다." }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #eee", overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
        <thead>
          <tr style={{ background: "#f8fafc" }}>
            {cols.map((c,i) => (
              <th key={i} style={{ padding: "13px 12px", textAlign: "left", fontSize: 11, color: "#94a3b8", borderBottom: "1px solid #f0f0f0", whiteSpace: "nowrap", fontWeight: 600 }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0
            ? <tr><td colSpan={cols.length} style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>{empty}</td></tr>
            : rows.map((row, ri) => (
              <tr key={ri} style={{ borderBottom: "1px solid #f8fafc" }}
                onMouseEnter={e => e.currentTarget.style.background="#fafafa"}
                onMouseLeave={e => e.currentTarget.style.background=""}>
                {cols.map((c,ci) => (
                  <td key={ci} style={{ padding: "12px 12px", fontSize: 13 }}>
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))
          }
        </tbody>
      </table>
    </div>
  );
}
