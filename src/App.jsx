import { useState, useEffect, useCallback, useRef } from "react";

// ===================== [1. 유틸리티 및 초기 데이터] =====================
const genId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
const nowISO = () => new Date().toISOString();
const fDate = (d) => d ? new Date(d).toLocaleDateString("ko-KR") : "-";
const fDateTime = (d) => d ? new Date(d).toLocaleString("ko-KR", { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : "-";
const fMoney = (n) => n ? `₩${Number(n).toLocaleString()}` : "-";

const HW_TYPES = { desktop: "데스크탑", monitor: "모니터", laptop: "노트북" };
const HW_STATUS = { active: "사용중", inactive: "미사용", repair: "수리중", disposed: "폐기" };
const ROLES = { admin: "관리자", user: "사용자", viewer: "조회자" };

const INIT_USERS = [
  { id: "u1", loginId: "admin", password: "admin123", name: "관리자", dept: "IT본부", role: "admin", createdAt: nowISO() },
  { id: "u2", loginId: "user", password: "user123", name: "이영희", dept: "디자인팀", role: "user", createdAt: nowISO() },
];

// CSV 내보내기 함수
const exportCSV = (data, fileName) => {
  if (!data.length) return alert("데이터가 없습니다.");
  const headers = Object.keys(data[0]).join(",");
  const rows = data.map(obj => Object.values(obj).join(",")).join("\n");
  const blob = new Blob([`\ufeff${headers}\n${rows}`], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${fileName}_${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
};

// ===================== [2. 공통 UI 컴포넌트] =====================

// 버튼 컴포넌트
function Btn({ onClick, variant="default", children, style={}, disabled=false, type="button" }) {
  const styles = {
    default: { background:"#fff", color:"#333", border:"1px solid #ddd" },
    primary: { background:"#0f6e56", color:"#fff", border:"none" },
    danger: { background:"#fff1f0", color:"#cf1322", border:"1px solid #ffa39e" },
    warning: { background:"#fffbe6", color:"#d48806", border:"1px solid #ffe58f" },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{ 
      padding:"10px 16px", borderRadius:10, fontSize:13, fontWeight:600, 
      cursor:disabled?"not-allowed":"pointer", opacity:disabled?0.5:1, 
      display:"inline-flex", alignItems:"center", justifyContent:"center",
      transition: "all 0.2s", ...styles[variant], ...style 
    }}>{children}</button>
  );
}

// 반응형 모달
function Modal({ title, onClose, children }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:9999, backdropFilter:"blur(4px)" }} onClick={(e)=>e.target===e.currentTarget && onClose()}>
      <div style={{ 
        background:"#fff", borderTopLeftRadius:24, borderTopRightRadius:24, width:"100%", maxWidth:600, 
        maxHeight:"90vh", overflowY:"auto", paddingBottom:40, boxShadow: "0 -10px 25px rgba(0,0,0,0.1)",
        animation: "slideUp 0.3s ease-out"
      }}>
        <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"20px 24px", borderBottom:"1px solid #f0f0f0", position:"sticky", top:0, background:"#fff", zIndex:2 }}>
          <h2 style={{ margin:0, fontSize:18, fontWeight:700 }}>{title}</h2>
          <button onClick={onClose} style={{ background:"#f5f5f5", border:"none", borderRadius:50, width:32, height:32, cursor:"pointer" }}>✕</button>
        </div>
        <div style={{ padding: "24px" }}>{children}</div>
      </div>
    </div>
  );
}

// 반응형 테이블
function ResponsiveTable({ cols, rows, empty="데이터가 없습니다." }) {
  return (
    <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #eee", overflow: "hidden" }}>
      <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
          <thead>
            <tr style={{ background: "#fbfcfd" }}>
              {cols.map((c, i) => <th key={i} style={{ padding: "16px 12px", textAlign: "left", fontSize: 12, color: "#888", fontWeight: 600, borderBottom: "1px solid #f0f0f0" }}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? <tr><td colSpan={cols.length} style={{ padding: 60, textAlign: "center", color: "#bbb" }}>{empty}</td></tr> : 
              rows.map((row, ri) => (
                <tr key={ri} style={{ borderBottom: "1px solid #f9f9f9" }}>
                  {cols.map((c, ci) => <td key={ci} style={{ padding: "16px 12px", fontSize: 13, color: "#333" }}>{c.render ? c.render(row) : row[c.key]}</td>)}
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ===================== [3. 메인 앱 컴포넌트] =====================

export default function App() {
  const [view, setView] = useState("dashboard");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 768 : false);

  // 데이터 상태 관리
  const [hardware, setHardware] = useState(() => JSON.parse(localStorage.getItem("itam-hw") || "[]"));
  const [users, setUsers] = useState(() => {
    const saved = JSON.parse(localStorage.getItem("itam-users") || "null");
    if (!saved) return INIT_USERS;
    return saved.find(u => u.loginId === "admin") ? saved : [...INIT_USERS, ...saved];
  });
  const [licenses, setLicenses] = useState(() => JSON.parse(localStorage.getItem("itam-lic") || "[]"));
  const [history, setHistory] = useState(() => JSON.parse(localStorage.getItem("itam-hist") || "[]"));
  const [trash, setTrash] = useState(() => JSON.parse(localStorage.getItem("itam-trash") || "[]"));

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    localStorage.setItem("itam-hw", JSON.stringify(hardware));
    localStorage.setItem("itam-users", JSON.stringify(users));
    localStorage.setItem("itam-lic", JSON.stringify(licenses));
    localStorage.setItem("itam-hist", JSON.stringify(history));
    localStorage.setItem("itam-trash", JSON.stringify(trash));
  }, [hardware, users, licenses, history, trash]);

  const addHistory = useCallback((action, aType, aId, aName, detail) => {
    if (!currentUser) return;
    setHistory(prev => [{ id: genId(), ts: nowISO(), action, aType, aId, aName, detail, userName: currentUser.name }, ...prev]);
  }, [currentUser]);

  if (!isLoggedIn) return <LoginPage onLogin={(u) => { setCurrentUser(u); setIsLoggedIn(true); }} users={users} />;

  const canEdit = currentUser.role === "admin" || currentUser.role === "user";

  // 공통 메뉴 정의
  const menuItems = [
    { id: "dashboard", label: "홈", icon: "🏠" },
    { id: "hardware", label: "장비", icon: "🖥️" },
    { id: "license", label: "라이선스", icon: "📋" },
    { id: "users", label: "멤버", icon: "👤" },
    { id: "history", label: "로그", icon: "📝" },
    { id: "trash", label: "휴지통", icon: "🗑️" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", height: "100vh", background: "#f8fafc" }}>
      
      {/* 데스크탑 사이드바 */}
      {!isMobile && (
        <div style={{ width: 250, background: "#fff", borderRight: "1px solid #e2e8f0", padding: "24px", display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#0f6e56", marginBottom: 40, letterSpacing: "-0.5px" }}>Asset Manager</div>
          <div style={{ flex: 1 }}>
            {menuItems.map(m => (
              <div key={m.id} onClick={() => setView(m.id)} style={{
                padding: "12px 16px", borderRadius: 12, cursor: "pointer", marginBottom: 6,
                background: view === m.id ? "#e8f5e9" : "transparent",
                color: view === m.id ? "#0f6e56" : "#64748b",
                fontWeight: view === m.id ? 700 : 500,
                transition: "0.2s"
              }}>
                <span style={{ marginRight: 10 }}>{m.icon}</span> {m.label}
              </div>
            ))}
          </div>
          <div style={{ padding: "16px", background: "#f1f5f9", borderRadius: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{currentUser.name}</div>
            <div style={{ fontSize: 11, color: "#64748b" }}>{ROLES[currentUser.role]}</div>
          </div>
          <Btn onClick={() => setIsLoggedIn(false)} style={{ width: "100%" }}>로그아웃</Btn>
        </div>
      )}

      {/* 컨텐츠 영역 */}
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: isMobile ? 80 : 0 }}>
        {isMobile && (
          <div style={{ background: "#fff", padding: "16px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 10 }}>
            <span style={{ fontWeight: 800, color: "#0f6e56", fontSize: 18 }}>Asset Manager</span>
            <div style={{ fontSize: 12, background: "#e8f5e9", color: "#0f6e56", padding: "4px 10px", borderRadius: 20, fontWeight: 600 }}>{currentUser.name}</div>
          </div>
        )}

        <main style={{ padding: isMobile ? "20px" : "40px", maxWidth: 1200, margin: "0 auto" }}>
          {view === "dashboard" && <DashboardSection stats={{hw: hardware, lic: licenses, users: users}} history={history} isMobile={isMobile} />}
          {view === "hardware" && <HardwareSection data={hardware} setData={setHardware} setTrash={setTrash} addHistory={addHistory} canEdit={canEdit} isMobile={isMobile} />}
          {view === "license" && <LicenseSection data={licenses} setData={setLicenses} setTrash={setTrash} addHistory={addHistory} canEdit={canEdit} />}
          {view === "users" && <UsersSection data={users} setData={setUsers} setTrash={setTrash} addHistory={addHistory} canEdit={currentUser.role==='admin'} />}
          {view === "history" && <HistorySection history={history} />}
          {view === "trash" && <TrashSection trash={trash} setTrash={setTrash} setHardware={setHardware} setLicenses={setLicenses} setUsers={setUsers} addHistory={addHistory} canEdit={canEdit} />}
        </main>
      </div>

      {/* 모바일 하단 탭 바 */}
      {isMobile && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: 70, background: "#fff", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "space-around", alignItems: "center", zIndex: 1000, paddingBottom: 10 }}>
          {menuItems.slice(0, 5).map(m => (
            <div key={m.id} onClick={() => setView(m.id)} style={{ textAlign: "center", color: view === m.id ? "#0f6e56" : "#94a3b8", flex: 1 }}>
              <div style={{ fontSize: 22 }}>{m.icon}</div>
              <div style={{ fontSize: 10, fontWeight: view === m.id ? 700 : 500, marginTop: 4 }}>{m.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===================== [4. 각 섹션 컴포넌트 (상세 로직 포함)] =====================

// 대시보드
function DashboardSection({ stats, history, isMobile }) {
  const cards = [
    { label: "전체 하드웨어", val: stats.hw.length, color: "#0f6e56", icon: "💻" },
    { label: "활성 라이선스", val: stats.lic.length, color: "#2563eb", icon: "🔑" },
    { label: "등록 사용자", val: stats.users.length, color: "#7c3aed", icon: "👥" },
    { label: "최근 7일 활동", val: history.length, color: "#ea580c", icon: "📝" },
  ];
  return (
    <div>
      <h2 style={{ fontSize: 24, marginBottom: 24, fontWeight: 700 }}>현황 요약</h2>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
        {cards.map((c, i) => (
          <div key={i} style={{ background: "#fff", padding: "20px", borderRadius: 20, border: "1px solid #e2e8f0", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
            <div style={{ fontSize: 20, marginBottom: 8 }}>{c.icon}</div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: c.color }}>{c.val}</div>
          </div>
        ))}
      </div>
      <div style={{ background: "#fff", padding: "24px", borderRadius: 20, border: "1px solid #e2e8f0" }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 16 }}>최근 활동 피드</h3>
        {history.slice(0, 5).map((h, i) => (
          <div key={i} style={{ padding: "12px 0", borderBottom: i === 4 ? "none" : "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{h.action} <span style={{ fontWeight: 400, color: "#64748b" }}>({h.aName})</span></div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{h.userName} • {fDateTime(h.ts)}</div>
            </div>
            <div style={{ fontSize: 18 }}>👉</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 하드웨어 관리
function HardwareSection({ data, setData, setTrash, addHistory, canEdit, isMobile }) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [filter, setFilter] = useState("");

  const filtered = data.filter(h => h.name.toLowerCase().includes(filter.toLowerCase()) || h.brand?.toLowerCase().includes(filter.toLowerCase()));

  const save = () => {
    if (!form.name) return alert("자산명을 입력하세요.");
    if (modal === "add") {
      const newItem = { ...form, id: genId(), createdAt: nowISO() };
      setData([newItem, ...data]);
      addHistory("하드웨어 등록", "hardware", newItem.id, newItem.name, "신규 등록");
    } else {
      setData(data.map(item => item.id === form.id ? form : item));
      addHistory("하드웨어 수정", "hardware", form.id, form.name, "정보 수정");
    }
    setModal(null);
  };

  const del = (item) => {
    if (!window.confirm("삭제하시겠습니까?")) return;
    setData(data.filter(i => i.id !== item.id));
    setTrash(prev => [{ ...item, type: "hardware", deletedAt: nowISO() }, ...prev]);
    addHistory("하드웨어 삭제", "hardware", item.id, item.name, "휴지통 이동");
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexDirection: isMobile ? "column" : "row", gap: 16 }}>
        <h2 style={{ margin: 0 }}>하드웨어</h2>
        <div style={{ display: "flex", gap: 8, width: isMobile ? "100%" : "auto" }}>
          <input placeholder="자산 검색..." value={filter} onChange={e => setFilter(e.target.value)} style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #e2e8f0", flex: 1 }} />
          {canEdit && <Btn onClick={() => { setForm({ status: "active", type: "laptop" }); setModal("add"); }} variant="primary">+ 등록</Btn>}
        </div>
      </div>

      <ResponsiveTable 
        cols={[
          { label: "자산명", render: h => <div style={{ fontWeight: 700 }}>{h.name}</div> },
          { label: "유형", render: h => HW_TYPES[h.type] || h.type },
          { label: "상태", render: h => <span style={{ fontSize: 11, padding: "4px 8px", borderRadius: 6, background: h.status === 'active' ? "#e8f5e9" : "#f1f5f9", color: h.status === 'active' ? "#0f6e56" : "#64748b" }}>{HW_STATUS[h.status]}</span> },
          { label: "비용", render: h => fMoney(h.cost) },
          { label: "관리", render: h => (
            <div style={{ display: "flex", gap: 4 }}>
              {canEdit && <Btn onClick={() => { setForm(h); setModal("edit"); }} style={{ padding: "6px 10px", fontSize: 11 }}>수정</Btn>}
              {canEdit && <Btn onClick={() => del(h)} variant="danger" style={{ padding: "6px 10px", fontSize: 11 }}>삭제</Btn>}
            </div>
          )}
        ]} 
        rows={filtered}
      />

      {modal && (
        <Modal title={modal === "add" ? "새 자산 등록" : "자산 정보 수정"} onClose={() => setModal(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>자산명 *</label>
              <input value={form.name || ""} onChange={e => setForm({ ...form, name: e.target.value })} style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #ddd", boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>유형</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #ddd" }}>
                  {Object.entries(HW_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>상태</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #ddd" }}>
                  {Object.entries(HW_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>비용 (원)</label>
              <input type="number" value={form.cost || ""} onChange={e => setForm({ ...form, cost: Number(e.target.value) })} style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #ddd", boxSizing: "border-box" }} />
            </div>
            <Btn onClick={save} variant="primary" style={{ marginTop: 10, padding: 16 }}>저장하기</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// 라이선스 섹션 (간략화된 로직 포함)
function LicenseSection({ data, setData, setTrash, addHistory, canEdit }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>라이선스</h2>
        {canEdit && <Btn variant="primary">+ 추가</Btn>}
      </div>
      <ResponsiveTable 
        cols={[
          { label: "제품명", render: l => <b>{l.name}</b> },
          { label: "공급사", key: "vendor" },
          { label: "총 좌석", key: "totalSeats" },
          { label: "비용", render: l => fMoney(l.cost) },
        ]} 
        rows={data} 
      />
    </div>
  );
}

// 사용자 섹션
function UsersSection({ data, setData, setTrash, addHistory, canEdit }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>사용자 멤버</h2>
        {canEdit && <Btn variant="primary">+ 초대</Btn>}
      </div>
      <ResponsiveTable 
        cols={[
          { label: "이름", render: u => <b>{u.name}</b> },
          { label: "아이디", key: "loginId" },
          { label: "부서", key: "dept" },
          { label: "권한", render: u => ROLES[u.role] },
        ]} 
        rows={data} 
      />
    </div>
  );
}

// 이력 관리
function HistorySection({ history }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>활동 로그</h2>
        <Btn onClick={() => exportCSV(history, "활동로그")}>CSV 내보내기</Btn>
      </div>
      <ResponsiveTable 
        cols={[
          { label: "시간", render: h => <span style={{ fontSize: 11 }}>{fDateTime(h.ts)}</span> },
          { label: "수행자", key: "userName" },
          { label: "액션", key: "action" },
          { label: "대상", key: "aName" },
          { label: "내용", key: "detail" },
        ]} 
        rows={history} 
      />
    </div>
  );
}

// 휴지통 섹션
function TrashSection({ trash, setTrash, setHardware, setLicenses, setUsers, addHistory, canEdit }) {
  const restore = (item) => {
    if (item.type === "hardware") setHardware(p => [item, ...p]);
    else if (item.type === "license") setLicenses(p => [item, ...p]);
    else if (item.type === "user") setUsers(p => [item, ...p]);
    
    setTrash(trash.filter(i => i.id !== item.id));
    addHistory("데이터 복구", item.type, item.id, item.name, "휴지통에서 복구됨");
  };

  return (
    <div>
      <h2 style={{ marginBottom: 20 }}>🗑️ 휴지통</h2>
      <ResponsiveTable 
        cols={[
          { label: "이름", key: "name" },
          { label: "유형", render: i => i.type === 'hardware' ? '장비' : i.type === 'license' ? '라이선스' : '사용자' },
          { label: "삭제일", render: i => fDateTime(i.deletedAt) },
          { label: "관리", render: i => canEdit && <Btn onClick={() => restore(i)} variant="warning" style={{ fontSize: 11, padding: "6px 12px" }}>복구</Btn> }
        ]} 
        rows={trash}
      />
    </div>
  );
}

// 로그인 페이지
function LoginPage({ onLogin, users }) {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");

  const submit = (e) => {
    e.preventDefault();
    const user = users.find(u => u.loginId === id && u.password === pw);
    if (user) onLogin(user);
    else alert("아이디 또는 비밀번호가 올바르지 않습니다.");
  };

  return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f1f5f9", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 380, background: "#fff", padding: "40px 30px", borderRadius: 24, boxShadow: "0 20px 40px rgba(0,0,0,0.05)" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🛡️</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0f6e56", margin: "0 0 8px" }}>Asset Pro</h1>
          <p style={{ color: "#64748b", fontSize: 14 }}>IT 자산 관리 시스템 로그인</p>
        </div>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <input placeholder="아이디" value={id} onChange={e => setId(e.target.value)} required style={{ padding: 16, borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 15 }} />
          <input type="password" placeholder="비밀번호" value={pw} onChange={e => setPw(e.target.value)} required style={{ padding: 16, borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 15 }} />
          <Btn type="submit" variant="primary" style={{ padding: 16, fontSize: 16, marginTop: 10 }}>시작하기</Btn>
        </form>
        <div style={{ marginTop: 24, padding: 16, background: "#f8fafc", borderRadius: 12, fontSize: 12, lineHeight: 1.6 }}>
          <div style={{ fontWeight: 700, marginBottom: 4, color: "#0f6e56" }}>테스트 계정 정보</div>
          <div>• 관리자: admin / admin123</div>
          <div>• 사용자: user / user123</div>
        </div>
      </div>
    </div>
  );
}
