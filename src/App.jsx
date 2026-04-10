import { useState, useEffect, useCallback } from "react";
// 1. Firebase 관련 임포트 추가
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, set, push, remove, update } from "firebase/database";

// ===================== [1. Firebase 설정 및 초기화] =====================
// [주의] Firebase Console에서 복사한 본인의 설정값으로 반드시 교체하세요!
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "it-asset-manager-91180.firebaseapp.com",
  databaseURL: "https://it-asset-manager-91180-default-rtdb.firebaseio.com",
  projectId: "it-asset-manager-91180",
  storageBucket: "it-asset-manager-91180.appspot.com",
  messagingSenderId: "200879018497",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ===================== [2. 유틸리티] =====================
const nowISO = () => new Date().toISOString();
const fDateTime = (d) => d ? new Date(d).toLocaleString("ko-KR", { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : "-";
const fMoney = (n) => n ? `₩${Number(n).toLocaleString()}` : "-";

const HW_TYPES = { desktop: "데스크탑", monitor: "모니터", laptop: "노트북" };
const HW_STATUS = { active: "사용중", inactive: "미사용", repair: "수리중", disposed: "폐기" };
const ROLES = { admin: "관리자", user: "사용자", viewer: "조회자" };

// 초기 유저는 DB가 비어있을 때 참조용으로만 사용 (실제 데이터는 DB에서 가져옴)
const INIT_USERS = [
  { loginId: "admin", password: "admin123", name: "관리자", dept: "IT본부", role: "admin" },
  { loginId: "user", password: "user123", name: "이영희", dept: "디자인팀", role: "user" },
];

// ===================== [3. 공통 UI 컴포넌트] =====================
// (기존 코드와 동일하므로 유지 - 가독성을 위해 생략 없이 포함)
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
      transition: "all 0.2s", boxSizing: "border-box", ...styles[variant], ...style 
    }}>{children}</button>
  );
}

function Modal({ title, onClose, children }) {
  const isMobile = window.innerWidth < 768;
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems: isMobile ? "flex-end" : "center", justifyContent:"center", zIndex:9999, backdropFilter:"blur(4px)" }} onClick={(e)=>e.target===e.currentTarget && onClose()}>
      <div style={{ 
        background:"#fff", borderTopLeftRadius:24, borderTopRightRadius:24, 
        borderBottomLeftRadius: isMobile ? 0 : 24, borderBottomRightRadius: isMobile ? 0 : 24,
        width:"100%", maxWidth:600, maxHeight:"90vh", overflowY:"auto", paddingBottom: isMobile ? 60 : 40, 
        boxShadow: "0 -10px 25px rgba(0,0,0,0.1)", boxSizing: "border-box"
      }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"20px 24px", borderBottom:"1px solid #f0f0f0", position:"sticky", top:0, background:"#fff", zIndex:2 }}>
          <h2 style={{ margin:0, fontSize:18, fontWeight:700 }}>{title}</h2>
          <button onClick={onClose} style={{ background:"#f5f5f5", border:"none", borderRadius:50, width:32, height:32, cursor:"pointer" }}>✕</button>
        </div>
        <div style={{ padding: "24px", boxSizing: "border-box" }}>{children}</div>
      </div>
    </div>
  );
}

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

// ===================== [4. 메인 앱 컴포넌트] =====================

export default function App() {
  const [view, setView] = useState("dashboard");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 768 : false);

  // 실시간 연동 데이터 상태
  const [hardware, setHardware] = useState([]);
  const [users, setUsers] = useState([]);
  const [history, setHistory] = useState([]);
  const [trash, setTrash] = useState([]);

  // Firebase 실시간 리스너 연결
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);

    // 데이터 실시간 동기화 (기기 간 연동 핵심)
    const unsubHW = onValue(ref(db, 'hardware'), (ss) => {
      const data = ss.val();
      setHardware(data ? Object.entries(data).map(([id, v]) => ({ ...v, id })) : []);
    });
    const unsubUsers = onValue(ref(db, 'users'), (ss) => {
      const data = ss.val();
      setUsers(data ? Object.entries(data).map(([id, v]) => ({ ...v, id })) : INIT_USERS);
    });
    const unsubHist = onValue(ref(db, 'history'), (ss) => {
      const data = ss.val();
      const list = data ? Object.entries(data).map(([id, v]) => ({ ...v, id })) : [];
      setHistory(list.sort((a,b) => new Date(b.ts) - new Date(a.ts)));
    });
    const unsubTrash = onValue(ref(db, 'trash'), (ss) => {
      const data = ss.val();
      setTrash(data ? Object.entries(data).map(([id, v]) => ({ ...v, id })) : []);
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      unsubHW(); unsubUsers(); unsubHist(); unsubTrash();
    };
  }, []);

  const addHistory = useCallback((action, aType, aId, aName, detail) => {
    if (!currentUser) return;
    push(ref(db, 'history'), { ts: nowISO(), action, aType, aId, aName, detail, userName: currentUser.name });
  }, [currentUser]);

  if (!isLoggedIn) return <LoginPage onLogin={(u) => { setCurrentUser(u); setIsLoggedIn(true); }} users={users} />;

  const canEdit = currentUser.role === "admin" || currentUser.role === "user";

  return (
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", height: "100vh", background: "#f8fafc", overflow: "hidden" }}>
      {/* 사이드바/상단바 UI는 기존과 동일하게 유지 */}
      {!isMobile && (
        <div style={{ width: 250, background: "#fff", borderRight: "1px solid #e2e8f0", padding: "24px", display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#0f6e56", marginBottom: 40 }}>Asset Manager</div>
          <div style={{ flex: 1 }}>
            {["dashboard", "hardware", "users", "history", "trash"].map(m => (
              <div key={m} onClick={() => setView(m)} style={{ padding: "12px", cursor: "pointer", color: view === m ? "#0f6e56" : "#64748b", fontWeight: 700 }}>
                {m.toUpperCase()}
              </div>
            ))}
          </div>
          <Btn onClick={() => setIsLoggedIn(false)}>로그아웃</Btn>
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", position: "relative" }}>
        {isMobile && (
          <header style={{ background: "#fff", padding: "16px", borderBottom: "1px solid #e2e8f0", position: "sticky", top: 0, zIndex: 10 }}>
            <span style={{ fontWeight: 800, color: "#0f6e56" }}>Asset Manager</span>
          </header>
        )}

        <main style={{ padding: isMobile ? "20px" : "40px", boxSizing: "border-box", paddingBottom: 100 }}>
          {view === "dashboard" && <DashboardSection stats={{hw: hardware, users}} history={history} isMobile={isMobile} />}
          {view === "hardware" && <HardwareSection data={hardware} addHistory={addHistory} canEdit={canEdit} isMobile={isMobile} />}
          {view === "history" && <HistorySection history={history} />}
          {view === "trash" && <TrashSection trash={trash} addHistory={addHistory} canEdit={canEdit} />}
        </main>
      </div>

      {isMobile && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: 70, background: "#fff", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "space-around", alignItems: "center", zIndex: 1000 }}>
          <div onClick={() => setView("dashboard")}>🏠</div>
          <div onClick={() => setView("hardware")}>🖥️</div>
          <div onClick={() => setView("history")}>📝</div>
          <div onClick={() => setView("trash")}>🗑️</div>
        </div>
      )}
    </div>
  );
}

// ===================== [5. 섹션 컴포넌트 (Firebase 데이터 처리)] =====================

function HardwareSection({ data, addHistory, canEdit, isMobile }) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});

  const save = () => {
    if (!form.name) return alert("자산명을 입력하세요.");
    if (modal === "add") {
      const newRef = push(ref(db, 'hardware'));
      set(newRef, { ...form, createdAt: nowISO() });
      addHistory("하드웨어 등록", "hardware", newRef.key, form.name, "신규 등록");
    } else {
      update(ref(db, `hardware/${form.id}`), form);
      addHistory("하드웨어 수정", "hardware", form.id, form.name, "정보 수정");
    }
    setModal(null);
  };

  const del = (item) => {
    if (!window.confirm("삭제하시겠습니까?")) return;
    remove(ref(db, `hardware/${item.id}`));
    push(ref(db, 'trash'), { ...item, type: "hardware", deletedAt: nowISO() });
    addHistory("하드웨어 삭제", "hardware", item.id, item.name, "휴지통 이동");
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
        <h2>하드웨어 ({data.length})</h2>
        {canEdit && <Btn onClick={() => { setForm({ status: "active", type: "laptop" }); setModal("add"); }} variant="primary">+ 등록</Btn>}
      </div>
      <ResponsiveTable 
        cols={[
          { label: "자산명", render: h => <div style={{ fontWeight: 700 }}>{h.name}</div> },
          { label: "유형", render: h => HW_TYPES[h.type] || h.type },
          { label: "상태", render: h => HW_STATUS[h.status] },
          { label: "비용", render: h => fMoney(h.cost) },
          { label: "관리", render: h => canEdit && (
            <div style={{ display: "flex", gap: 4 }}>
              <Btn onClick={() => { setForm(h); setModal("edit"); }} style={{ padding: "6px 10px" }}>수정</Btn>
              <Btn onClick={() => del(h)} variant="danger" style={{ padding: "6px 10px" }}>삭제</Btn>
            </div>
          )}
        ]} 
        rows={data}
      />
      {modal && (
        <Modal title={modal === "add" ? "새 자산 등록" : "자산 정보 수정"} onClose={() => setModal(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <input placeholder="자산명" value={form.name || ""} onChange={e => setForm({ ...form, name: e.target.value })} style={{ padding: 12, borderRadius: 10, border: "1px solid #ddd", width: "100%", boxSizing: "border-box" }} />
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={{ padding: 12, borderRadius: 10, border: "1px solid #ddd" }}>
              {Object.entries(HW_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <Btn onClick={save} variant="primary" style={{ padding: 16 }}>저장하기</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ... DashboardSection, HistorySection, TrashSection은 위 HardwareSection과 유사하게 
// ref(db, '경로')를 참조하도록 유지합니다 ...

function DashboardSection({ stats, history, isMobile }) {
  return (
    <div>
      <h2 style={{ fontSize: 24, marginBottom: 24 }}>실시간 현황 요약</h2>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)", gap: 16 }}>
        <div style={{ background: "#fff", padding: 20, borderRadius: 20, border: "1px solid #eee" }}>
          <div style={{ fontSize: 12, color: "#666" }}>전체 하드웨어</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#0f6e56" }}>{stats.hw.length}</div>
        </div>
        <div style={{ background: "#fff", padding: 20, borderRadius: 20, border: "1px solid #eee" }}>
          <div style={{ fontSize: 12, color: "#666" }}>최근 활동</div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{history.length}</div>
        </div>
      </div>
    </div>
  );
}

function HistorySection({ history }) {
  return (
    <div>
      <h2 style={{ marginBottom: 20 }}>활동 로그</h2>
      <ResponsiveTable 
        cols={[
          { label: "시간", render: h => <span style={{ fontSize: 11 }}>{fDateTime(h.ts)}</span> },
          { label: "수행자", key: "userName" },
          { label: "액션", key: "action" },
          { label: "대상", key: "aName" }
        ]} 
        rows={history} 
      />
    </div>
  );
}

function TrashSection({ trash, addHistory, canEdit }) {
  const restore = (item) => {
    remove(ref(db, `trash/${item.id}`));
    const { type, deletedAt, ...rest } = item;
    set(ref(db, `${type}/${item.id}`), rest);
    addHistory("데이터 복구", item.type, item.id, item.name, "복구됨");
  };

  return (
    <div>
      <h2 style={{ marginBottom: 20 }}>휴지통</h2>
      <ResponsiveTable 
        cols={[
          { label: "이름", key: "name" },
          { label: "삭제일", render: i => fDateTime(i.deletedAt) },
          { label: "관리", render: i => canEdit && <Btn onClick={() => restore(i)} variant="warning">복구</Btn> }
        ]} 
        rows={trash}
      />
    </div>
  );
}

function LoginPage({ onLogin, users }) {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const submit = (e) => {
    e.preventDefault();
    const user = users.find(u => u.loginId === id && u.password === pw);
    if (user) onLogin(user);
    else alert("로그인 실패!");
  };
  return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f1f5f9" }}>
      <form onSubmit={submit} style={{ width: 340, background: "#fff", padding: 40, borderRadius: 24, boxShadow: "0 10px 30px rgba(0,0,0,0.05)" }}>
        <h1 style={{ textAlign: "center", color: "#0f6e56", marginBottom: 30 }}>Asset Pro</h1>
        <input placeholder="아이디" value={id} onChange={e => setId(e.target.value)} required style={{ width: "100%", padding: 15, marginBottom: 10, borderRadius: 10, border: "1px solid #eee", boxSizing: "border-box" }} />
        <input type="password" placeholder="비밀번호" value={pw} onChange={e => setPw(e.target.value)} required style={{ width: "100%", padding: 15, marginBottom: 20, borderRadius: 10, border: "1px solid #eee", boxSizing: "border-box" }} />
        <Btn type="submit" variant="primary" style={{ width: "100%", padding: 16 }}>로그인</Btn>
      </form>
    </div>
  );
}
