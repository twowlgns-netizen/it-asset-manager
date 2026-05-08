// ================================================================
// 🔑 Supabase 연결 설정 (이 두 줄만 본인 것으로 교체하면 됩니다)
// ================================================================
const BASE_URL = "https://djykkruijwgckiqqqlpp.supabase.co/rest/v1";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqeWtrcnVpandnY2tpcXFxbHBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwODU5MDIsImV4cCI6MjA5MzY2MTkwMn0.wASj9FFOnmYMc3xJcGVuWSK3XreWYi9x3GToyAC6cEI";

// Supabase 요청에 필요한 공통 헤더 (모든 API 호출에 자동으로 포함됩니다)
const HEADERS = {
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

// ================================================================
// 📁 App.jsx - IT 자산관리 시스템의 메인 파일
// ================================================================

import { useState, useEffect, useCallback } from "react";

const nowISO = () => new Date().toISOString();

const fDateTime = (d) =>
  d
    ? new Date(d).toLocaleString("ko-KR", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

// 👉 장비 종류를 추가하려면 여기에 줄을 추가하세요.
const HW_TYPES = {
  desktop: "데스크탑",
  monitor: "모니터",
  laptop: "노트북",
  rf: "RF리더기",
};

// 👉 상태를 추가하려면 여기에 줄을 추가하세요.
const HW_STATUS = {
  active: "사용중",
  inactive: "미사용",
  repair: "수리중",
  disposed: "폐기",
};

// 서버에서 사용자 정보를 못 불러올 때 사용하는 기본값
const INIT_USERS = [
  { loginId: "admin", password: "admin123", name: "관리자", dept: "IT본부", role: "admin" },
  { loginId: "user",  password: "user123",  name: "이영희", dept: "디자인팀", role: "user"  },
];



// ================================================================
// 🌐 [API 헬퍼] Supabase REST API 통신 함수 모음
//
// ⚠️ 기존 서버(samjee.duckdns.org)와 다른 점:
//   - 모든 요청에 HEADERS(apikey, Authorization)가 필요합니다
//   - 수정할 때 PUT → PATCH 로 바뀌었습니다
//   - ID로 필터링할 때 /assets/id 대신 /assets?id=eq.id 형식입니다
//   - 저장 후 결과를 받으려면 "Prefer: return=representation" 헤더가 필요합니다
// ================================================================

const safeJson = async (res) => {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  const text = await res.text();
  if (!text || text.trim() === "") return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
};

const api = {

  // ── 하드웨어(자산) ──

  // 전체 자산 목록 가져오기
  getHardware: () =>
    fetch(`${BASE_URL}/assets?select=*&order=created_at.desc`, {
      headers: HEADERS,
    }).then(safeJson),

  // 새 자산 추가 (저장된 데이터를 응답으로 받음)
  addHardware: (data) =>
    fetch(`${BASE_URL}/assets`, {
      method: "POST",
      headers: { ...HEADERS, "Prefer": "return=representation" },
      body: JSON.stringify(data),
    }).then(safeJson),

  // 특정 자산 수정 (?id=eq.${id} : 해당 id 행만 수정)
  updateHardware: (id, data) =>
    fetch(`${BASE_URL}/assets?id=eq.${id}`, {
      method: "PATCH",
      headers: { ...HEADERS, "Prefer": "return=representation" },
      body: JSON.stringify(data),
    }).then(safeJson),

  // 특정 자산 삭제
  deleteHardware: (id) =>
    fetch(`${BASE_URL}/assets?id=eq.${id}`, {
      method: "DELETE",
      headers: HEADERS,
    }).then(safeJson),


  // ── 사용자 ──

  getUsers: () =>
    fetch(`${BASE_URL}/users?select=*`, {
      headers: HEADERS,
    }).then(safeJson),


  // ── 히스토리(활동 로그) ──

  getHistory: () =>
    fetch(`${BASE_URL}/history?select=*&order=ts.desc&limit=1000000`, {
      // limit=1000000 : Supabase 기본 상한(1000건)을 제거해 전체 로그를 불러옵니다
      headers: { ...HEADERS, "Range-Unit": "items", "Range": "0-999999" },
    }).then(safeJson),

  addHistory: (data) =>
    fetch(`${BASE_URL}/history`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify(data),
    }).then(safeJson),


  // ── 휴지통 ──

  getTrash: () =>
    fetch(`${BASE_URL}/trash?select=*`, {
      headers: HEADERS,
    }).then(safeJson),

  addTrash: (data) =>
    fetch(`${BASE_URL}/trash`, {
      method: "POST",
      headers: { ...HEADERS, "Prefer": "return=representation" },
      body: JSON.stringify(data),
    }).then(safeJson),

  deleteTrash: (id) =>
    fetch(`${BASE_URL}/trash?id=eq.${id}`, {
      method: "DELETE",
      headers: HEADERS,
    }).then(safeJson),

  restoreItem: (type, id, data) =>
    fetch(`${BASE_URL}/${type}?id=eq.${id}`, {
      method: "PATCH",
      headers: { ...HEADERS, "Prefer": "return=representation" },
      body: JSON.stringify(data),
    }).then(safeJson),
};



// ================================================================
// 🏠 [메인 앱]
// ================================================================
export default function App() {

  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem("isLoggedIn") === "true";
  });

  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = localStorage.getItem("currentUser");
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [view, setView]       = useState("dashboard");
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );
  const [hardware, setHardware] = useState([]);
  const [users, setUsers]       = useState(INIT_USERS);
  const [history, setHistory]   = useState([]);
  const [trash, setTrash]       = useState([]);


  const handleLogin = (user) => {
    setIsLoggedIn(true);
    setCurrentUser(user);
    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("currentUser", JSON.stringify(user));
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("currentUser");
  };


  const fetchAll = useCallback(() => {
    api.getHardware()
      .then((data) => setHardware(Array.isArray(data) ? data : []))
      .catch((err) => console.error("hardware fetch error:", err));

    api.getUsers()
      .then((data) => setUsers(Array.isArray(data) && data.length > 0 ? data : INIT_USERS))
      .catch((err) => console.error("users fetch error:", err));

    api.getHistory()
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setHistory(list.sort((a, b) => new Date(b.ts) - new Date(a.ts)));
      })
      .catch((err) => console.error("history fetch error:", err));

    api.getTrash()
      .then((data) => setTrash(Array.isArray(data) ? data : []))
      .catch((err) => console.error("trash fetch error:", err));
  }, []);


  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    fetchAll();
    return () => { window.removeEventListener("resize", handleResize); };
  }, [fetchAll]);


  const addHistory = useCallback(
    (action, aType, aId, aName, detail) => {
      if (!currentUser) return;
      api
        .addHistory({ ts: nowISO(), action, aType, aId, aName, detail, userName: currentUser.name })
        .then(() => {
          api.getHistory().then((data) => {
            const list = Array.isArray(data) ? data : [];
            setHistory(list.sort((a, b) => new Date(b.ts) - new Date(a.ts)));
          });
        })
        .catch((err) => console.error("addHistory error:", err));
    },
    [currentUser]
  );


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
        <div style={{ width: 250, background: "#fff", borderRight: "1px solid #e2e8f0", padding: "24px", display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#0f6e56", marginBottom: 40 }}>Asset Manager</div>
          <div style={{ flex: 1 }}>
            {menuItems.map((m) => (
              <div key={m.id} onClick={() => setView(m.id)}
                style={{ padding: "12px 16px", borderRadius: 12, cursor: "pointer", background: view === m.id ? "#e8f5e9" : "transparent", color: view === m.id ? "#0f6e56" : "#64748b", fontWeight: 700, marginBottom: 6 }}>
                {m.icon} {m.label}
              </div>
            ))}
          </div>
          <Btn onClick={handleLogout}>로그아웃</Btn>
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto" }}>
        {isMobile && (
          <div style={{ background: "#fff", padding: "16px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 10 }}>
            <span style={{ fontWeight: 800, color: "#0f6e56", fontSize: 18 }}>Asset Manager</span>
            <Btn onClick={handleLogout} style={{ fontSize: 11, padding: "5px 10px" }}>로그아웃</Btn>
          </div>
        )}

        <main style={{ padding: isMobile ? "20px" : "40px", paddingBottom: 100 }}>
          {view === "dashboard" && <DashboardSection stats={{ hw: hardware, users }} history={history} isMobile={isMobile} />}
          {view === "hardware"  && <HardwareSection data={hardware} setHardware={setHardware} addHistory={addHistory} canEdit={canEdit} trash={trash} setTrash={setTrash} />}
          {view === "history"   && <HistorySection history={history} />}
          {view === "trash"     && <TrashSection trash={trash} setTrash={setTrash} setHardware={setHardware} addHistory={addHistory} canEdit={canEdit} />}
        </main>
      </div>

      {isMobile && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: 70, background: "#fff", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "space-around", alignItems: "center", zIndex: 1000 }}>
          {menuItems.map((m) => (
            <div key={m.id} onClick={() => setView(m.id)} style={{ textAlign: "center", color: view === m.id ? "#0f6e56" : "#94a3b8" }}>
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
function DashboardSection({ stats, history, isMobile }) {
  return (
    <div>
      <h2 style={{ fontSize: 24, marginBottom: 24, fontWeight: 700 }}>실시간 현황 요약</h2>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)", gap: 16 }}>
        <div style={{ background: "#fff", padding: "20px", borderRadius: 20, border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 12, color: "#64748b" }}>전체 장비</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#0f6e56" }}>{stats.hw.length}</div>
        </div>
        <div style={{ background: "#fff", padding: "20px", borderRadius: 20, border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 12, color: "#64748b" }}>최근 로그</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#2563eb" }}>{history.length}</div>
        </div>
      </div>
    </div>
  );
}



// ================================================================
// 🖥️ [하드웨어]
// ================================================================
function HardwareSection({ data, setHardware, addHistory, canEdit, trash, setTrash }) {

  const [modal, setModal]     = useState(null);
  const [form, setForm]       = useState({});
  const [loading, setLoading] = useState(false);

  const save = () => {
    if (!form.name) return alert("자산명을 입력하세요.");
    setLoading(true);

    const isAdd = modal === "add";
    const newItem = isAdd ? { ...form } : form;
    const request = isAdd ? api.addHardware(newItem) : api.updateHardware(form.id, form);

    request
      .then(() => api.getHardware())
      .then((list) => {
        const fresh = Array.isArray(list) ? list : [];
        setHardware(fresh);
        if (isAdd) {
          const created = fresh.find((h) => h.name === form.name);
          addHistory("하드웨어 등록", "hardware", created?.id ?? "", form.name, "신규 등록");
        } else {
          addHistory("하드웨어 수정", "hardware", form.id, form.name, "정보 수정");
        }
        setModal(null);
      })
      .catch((err) => { console.error("save error:", err); alert(`오류가 발생했습니다.\n${err.message}`); })
      .finally(() => setLoading(false));
  };

  const deleteItem = (item) => {
    if (!window.confirm(`"${item.name}"을(를) 휴지통으로 이동하시겠습니까?`)) return;

    const trashItem = {
      name:      item.name,
      type:      item.type,
      status:    item.status,
      deletedAt: nowISO(),
    };

    api.deleteHardware(item.id)
      .then(() => api.addTrash(trashItem))
      .then((addedTrash) => {
        setHardware((prev) => prev.filter((h) => h.id !== item.id));
        // Supabase POST는 배열로 응답 — 첫 번째 항목 사용
        const newTrashItem = Array.isArray(addedTrash) ? addedTrash[0] : addedTrash;
        setTrash((prev) => [...prev, newTrashItem]);
        addHistory("하드웨어 삭제", "hardware", item.id, item.name, "휴지통 이동");
      })
      .catch((err) => { console.error(err); alert("삭제 중 오류가 발생했습니다."); });
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>하드웨어</h2>
        {canEdit && (
          <Btn onClick={() => { setForm({ status: "active", type: "laptop" }); setModal("add"); }} variant="primary">
            + 등록
          </Btn>
        )}
      </div>

      <ResponsiveTable
        cols={[
          { label: "자산명", render: (h) => <b>{h.name}</b> },
          { label: "유형",   render: (h) => HW_TYPES[h.type]   || h.type   },
          { label: "상태",   render: (h) => HW_STATUS[h.status] || h.status },
          {
            label: "관리",
            render: (h) =>
              canEdit && (
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn onClick={() => { setForm(h); setModal("edit"); }}>수정</Btn>
                  <Btn onClick={() => deleteItem(h)} variant="danger">삭제</Btn>
                </div>
              ),
          },
        ]}
        rows={data}
      />

      {modal && (
        <Modal title={modal === "add" ? "새 자산 등록" : "자산 정보 수정"} onClose={() => setModal(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <input placeholder="자산명" value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })}
              style={{ padding: 12, borderRadius: 10, border: "1px solid #ddd" }} />
            <select value={form.type || "laptop"} onChange={(e) => setForm({ ...form, type: e.target.value })}
              style={{ padding: 12, borderRadius: 10, border: "1px solid #ddd" }}>
              {Object.entries(HW_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={form.status || "active"} onChange={(e) => setForm({ ...form, status: e.target.value })}
              style={{ padding: 12, borderRadius: 10, border: "1px solid #ddd" }}>
              {Object.entries(HW_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <Btn onClick={save} variant="primary" disabled={loading}>{loading ? "저장 중..." : "저장"}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}



// ================================================================
// 📝 [히스토리] 활동 로그 목록 + 검색
// ================================================================
function HistorySection({ history }) {
  const [query, setQuery] = useState("");         // 검색어
  const [field, setField] = useState("all");      // 검색 대상 필드

  // 검색 필터 적용
  const filtered = history.filter((h) => {
    if (!query.trim()) return true; // 검색어 없으면 전체 표시
    const q = query.trim().toLowerCase();
    if (field === "userName") return (h.userName || "").toLowerCase().includes(q);
    if (field === "action")   return (h.action   || "").toLowerCase().includes(q);
    if (field === "aName")    return (h.aName    || "").toLowerCase().includes(q);
    // "all": 모든 필드에서 검색
    return (
      (h.userName || "").toLowerCase().includes(q) ||
      (h.action   || "").toLowerCase().includes(q) ||
      (h.aName    || "").toLowerCase().includes(q)
    );
  });

  return (
    <div>
      {/* 상단: 제목 + 전체 건수 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>활동 로그</h2>
        <span style={{ fontSize: 13, color: "#64748b" }}>
          전체 <b style={{ color: "#0f6e56" }}>{history.length}</b>건
          {query && ` · 검색결과 ${filtered.length}건`}
        </span>
      </div>

      {/* 검색 바 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {/* 검색 대상 선택 */}
        <select
          value={field}
          onChange={(e) => setField(e.target.value)}
          style={{
            padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd",
            fontSize: 13, color: "#333", background: "#fff", flexShrink: 0,
          }}
        >
          <option value="all">전체</option>
          <option value="userName">수행자</option>
          <option value="action">액션</option>
          <option value="aName">대상</option>
        </select>

        {/* 검색어 입력 */}
        <div style={{ flex: 1, position: "relative" }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 15, color: "#94a3b8" }}>
            🔍
          </span>
          <input
            type="text"
            placeholder="검색어를 입력하세요..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: "100%", padding: "10px 36px 10px 36px",
              borderRadius: 10, border: "1px solid #ddd",
              fontSize: 13, boxSizing: "border-box",
            }}
          />
          {/* X 버튼: 검색어 있을 때만 표시 */}
          {query && (
            <button
              onClick={() => setQuery("")}
              style={{
                position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#94a3b8",
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 로그 테이블 */}
      <ResponsiveTable
        cols={[
          { label: "시간",   render: (h) => <span style={{ fontSize: 11 }}>{fDateTime(h.ts)}</span> },
          { label: "수행자", key: "userName" },
          { label: "액션",   key: "action"   },
          { label: "대상",   key: "aName"    },
        ]}
        rows={filtered}
        empty={query ? `"${query}"에 대한 검색 결과가 없습니다.` : "로그가 없습니다."}
      />
    </div>
  );
}



// ================================================================
// 🗑️ [휴지통]
// ================================================================
function TrashSection({ trash, setTrash, setHardware, addHistory, canEdit }) {

  const restore = (item) => {
    api.deleteTrash(item.id)
      .then(() =>
        // assets 테이블에 새로 INSERT
        fetch(`${BASE_URL}/assets`, {
          method: "POST",
          headers: { ...HEADERS, "Prefer": "return=representation" },
          body: JSON.stringify({ name: item.name, type: item.type, status: item.status }),
        }).then(safeJson)
      )
      .then((restored) => {
        setTrash((prev) => prev.filter((t) => t.id !== item.id));
        const restoredItem = Array.isArray(restored) ? restored[0] : restored;
        setHardware((prev) => [...prev, restoredItem]);
        addHistory("데이터 복구", "assets", restoredItem?.id, item.name, "복구됨");
      })
      .catch((err) => { console.error(err); alert("복구 중 오류가 발생했습니다."); });
  };

  return (
    <div>
      <h2 style={{ marginBottom: 20 }}>휴지통</h2>
      <ResponsiveTable
        cols={[
          { label: "이름",   key: "name" },
          { label: "삭제일", render: (i) => fDateTime(i.deletedAt) },
          {
            label: "관리",
            render: (i) => canEdit && <Btn onClick={() => restore(i)} variant="warning">복구</Btn>,
          },
        ]}
        rows={trash}
      />
    </div>
  );
}



// ================================================================
// 🔑 [로그인]
// ================================================================
function LoginPage({ onLogin, users }) {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");

  const submit = (e) => {
    e.preventDefault();
    const user = users.find((u) => u.loginId === id && u.password === pw);
    if (user) onLogin(user);
    else alert("아이디 또는 비밀번호가 틀립니다.");
  };

  return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f1f5f9" }}>
      <form onSubmit={submit} style={{ width: 340, background: "#fff", padding: 40, borderRadius: 24 }}>
        <h1 style={{ textAlign: "center", color: "#0f6e56", marginBottom: 30 }}>Asset Pro</h1>
        <input placeholder="아이디" value={id} onChange={(e) => setId(e.target.value)} required
          style={{ width: "100%", padding: 15, marginBottom: 10, borderRadius: 10, border: "1px solid #eee", boxSizing: "border-box" }} />
        <input type="password" placeholder="비밀번호" value={pw} onChange={(e) => setPw(e.target.value)} required
          style={{ width: "100%", padding: 15, marginBottom: 20, borderRadius: 10, border: "1px solid #eee", boxSizing: "border-box" }} />
        <Btn type="submit" variant="primary" style={{ width: "100%", padding: 16 }}>로그인</Btn>
      </form>
    </div>
  );
}



// ================================================================
// 🔘 [공통] Btn
// ================================================================
function Btn({ onClick, variant = "default", children, style = {}, disabled = false, type = "button" }) {
  const styles = {
    default: { background: "#fff",    color: "#333",    border: "1px solid #ddd"    },
    primary: { background: "#0f6e56", color: "#fff",    border: "none"              },
    danger:  { background: "#fff1f0", color: "#cf1322", border: "1px solid #ffa39e" },
    warning: { background: "#fffbe6", color: "#d48806", border: "1px solid #ffe58f" },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      style={{ padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1, ...styles[variant], ...style }}>
      {children}
    </button>
  );
}



// ================================================================
// 🪟 [공통] Modal
// ================================================================
function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
      <div style={{ background: "#fff", borderRadius: 24, width: "90%", maxWidth: 500, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}



// ================================================================
// 📋 [공통] ResponsiveTable
// ================================================================
function ResponsiveTable({ cols, rows, empty = "데이터가 없습니다." }) {
  return (
    <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #eee", overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#fbfcfd" }}>
            {cols.map((c, i) => (
              <th key={i} style={{ padding: "16px 12px", textAlign: "left", fontSize: 12, color: "#888", borderBottom: "1px solid #f0f0f0" }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={cols.length} style={{ padding: 40, textAlign: "center" }}>{empty}</td></tr>
          ) : (
            rows.map((row, ri) => (
              <tr key={ri} style={{ borderBottom: "1px solid #f9f9f9" }}>
                {cols.map((c, ci) => (
                  <td key={ci} style={{ padding: "16px 12px", fontSize: 13 }}>
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
