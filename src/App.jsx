import { useState, useEffect, useCallback, useRef } from "react";

// ================================================================
// 🔑 Supabase 연결 설정
// ================================================================
const BASE_URL   = "https://djykkruijwgckiqqqlpp.supabase.co/rest/v1";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqeWtrcnVpandnY2tpcXFxbHBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwODU5MDIsImV4cCI6MjA5MzY2MTkwMn0.wASj9FFOnmYMc3xJcGVuWSK3XreWYi9x3GToyAC6cEI";
const H = { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

// ================================================================
// ⚙️ 상수
// ================================================================
const CLINICS = { all: "전체", gangnam: "강남의원", gangbuk: "강북의원", seoulsup: "서울숲의원" };
const ASSET_STATUS  = { active: "사용중", inactive: "미사용", repair: "수리중", disposed: "폐기", dispose_target: "폐기대상" };
const ASSET_TYPES   = { laptop: "노트북", desktop: "데스크탑", monitor: "모니터", tablet: "태블릿", phone: "스마트폰", etc: "기타" };
const SW_STATUS     = { active: "사용중", expired: "만료", inactive: "미사용", disposed: "폐기" };
const SW_CATEGORIES = { os: "운영체제", office: "오피스", security: "보안", erp: "ERP", design: "디자인", dev: "개발", etc: "기타" };
const ROLES         = { admin: "관리자", user: "일반사용자", readonly: "읽기전용" };
const STATUS_BADGE  = {
  active:         { bg: "#e8f5e9", color: "#0f6e56" },
  inactive:       { bg: "#f1f5f9", color: "#64748b" },
  repair:         { bg: "#fff7ed", color: "#c2410c" },
  disposed:       { bg: "#fff1f0", color: "#cf1322" },
  dispose_target: { bg: "#fef3c7", color: "#d97706" },
  expired:        { bg: "#fff1f0", color: "#cf1322" },
};

// 사용자 계정은 Supabase DB에서만 관리합니다.

// 하드웨어 필드
const HW_FIELDS = [
  { key: "num",           label: "번호",           type: "number"   },
  { key: "assetstatus",   label: "자산상태",        type: "select",  options: ASSET_STATUS  },
  { key: "clinic",        label: "지점",            type: "select",  options: CLINICS       },
  { key: "inspectiondate",label: "실사날짜",         type: "text"     },
  { key: "gccode",        label: "GC자산코드(SAP)",  type: "text"     },
  { key: "imedcode",      label: "아이메드코드",      type: "text"     },
  { key: "serialnumber",  label: "제조번호",          type: "text"     },
  { key: "ip",            label: "IP",              type: "text"     },
  { key: "team",          label: "팀(부서명)",        type: "text"     },
  { key: "username",      label: "사용자",            type: "text"     },
  { key: "pcname",        label: "PC 이름",           type: "text"     },
  { key: "modelname",     label: "모델명",            type: "text"     },
  { key: "assettype",     label: "자산구분",          type: "select",  options: ASSET_TYPES  },
  { key: "notes",         label: "비고(이력관리)",    type: "textarea" },
  { key: "macaddress",    label: "MAC Address",      type: "text"     },
  { key: "receiptdate",   label: "자산 수령일",       type: "text"     },
  { key: "purchasedate",  label: "구입일자",          type: "text"     },
  { key: "manufacturer",  label: "제조사",            type: "text"     },
  { key: "cpu",           label: "CPU",              type: "text"     },
  { key: "memory",        label: "Memory",           type: "text"     },
  { key: "hdd",           label: "하드디스크",        type: "text"     },
  { key: "purpose",       label: "목적/기능",         type: "text"     },
  { key: "corporation",   label: "법인",              type: "text"     },
  { key: "location",      label: "위치(건물)",        type: "text"     },
  { key: "purchaseinfo",  label: "구매정보(전자결재)", type: "text"    },
];
const HW_FIELD_MAP = Object.fromEntries(HW_FIELDS.map(f => [f.key, f]));

const HW_SECTIONS = [
  { title: "📌 기본 정보",     keys: ["num","assetstatus","clinic","inspectiondate","gccode","imedcode"] },
  { title: "🌐 네트워크/장치", keys: ["ip","macaddress","pcname","modelname","assettype","serialnumber"] },
  { title: "👤 사용자/위치",   keys: ["team","username","corporation","location"] },
  { title: "⚙️ 사양",         keys: ["manufacturer","cpu","memory","hdd"] },
  { title: "🛒 구매 정보",     keys: ["receiptdate","purchasedate","purpose","purchaseinfo"] },
  { title: "📎 기타",          keys: ["notes"] },
];

const ALL_HW_COLS = HW_FIELDS.map(f => ({ key: f.key, label: f.label }));
const DEFAULT_HW_COLS = new Set(["num","assetstatus","clinic","gccode","team","username","modelname","assettype","location"]);

// ================================================================
// 🛠️ 유틸리티
// ================================================================
const nowISO = () => new Date().toISOString();
const fDT = (d) => d ? new Date(d).toLocaleString("ko-KR", { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" }) : "-";
const fDate = (d) => d ? new Date(d).toLocaleDateString("ko-KR") : "-";
const todayStr = () => new Date().toISOString().slice(0,10);

const safeJson = async (res) => {
  if (!res.ok) { const t = await res.text().catch(()=>""); throw new Error(`HTTP ${res.status}: ${t}`); }
  const t = await res.text();
  if (!t || !t.trim()) return {};
  try { return JSON.parse(t); } catch { return {}; }
};

// 클라이언트 IP 조회 (공인 IP)
const getClientIP = async () => {
  try {
    const r = await fetch("https://api.ipify.org?format=json");
    const d = await r.json();
    return d.ip || "알 수 없음";
  } catch {
    return "알 수 없음";
  }
};

// 브라우저/OS 간략 정보
const getClientInfo = () => {
  const ua = navigator.userAgent;
  let os = "기타";
  if (/Windows/.test(ua))      os = "Windows";
  else if (/Mac OS/.test(ua))  os = "macOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/iPhone|iPad/.test(ua)) os = "iOS";
  else if (/Linux/.test(ua))   os = "Linux";
  let browser = "기타";
  if (/Edg\//.test(ua))        browser = "Edge";
  else if (/Chrome\//.test(ua))browser = "Chrome";
  else if (/Firefox\//.test(ua))browser="Firefox";
  else if (/Safari\//.test(ua))browser = "Safari";
  return `${browser} / ${os}`;
};

const triggerDownload = (blob, name) => {
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
};

// ================================================================
// 🌐 API
// ================================================================
const api = {
  // 자산
  getHW:    () => fetch(`${BASE_URL}/assets?select=*&order=num.asc.nullslast,created_at.desc&limit=100000`, { headers: {...H,"Range-Unit":"items","Range":"0-99999"} }).then(safeJson),
  addHW:    (d) => fetch(`${BASE_URL}/assets`, { method:"POST", headers:{...H,"Prefer":"return=representation"}, body:JSON.stringify(d) }).then(safeJson),
  updateHW: (id,d) => fetch(`${BASE_URL}/assets?id=eq.${id}`, { method:"PATCH", headers:{...H,"Prefer":"return=representation"}, body:JSON.stringify(d) }).then(safeJson),
  deleteHW: (id) => fetch(`${BASE_URL}/assets?id=eq.${id}`, { method:"DELETE", headers:H }).then(safeJson),
  // 소프트웨어
  getSW:    () => fetch(`${BASE_URL}/software?select=*&order=created_at.desc&limit=100000`, { headers: {...H,"Range-Unit":"items","Range":"0-99999"} }).then(safeJson),
  addSW:    (d) => fetch(`${BASE_URL}/software`, { method:"POST", headers:{...H,"Prefer":"return=representation"}, body:JSON.stringify(d) }).then(safeJson),
  updateSW: (id,d) => fetch(`${BASE_URL}/software?id=eq.${id}`, { method:"PATCH", headers:{...H,"Prefer":"return=representation"}, body:JSON.stringify(d) }).then(safeJson),
  deleteSW: (id) => fetch(`${BASE_URL}/software?id=eq.${id}`, { method:"DELETE", headers:H }).then(safeJson),
  // 사용자
  getUsers:    () => fetch(`${BASE_URL}/users?select=*`, { headers:H }).then(safeJson),
  addUser:     (d) => fetch(`${BASE_URL}/users`, { method:"POST", headers:{...H,"Prefer":"return=representation"}, body:JSON.stringify(d) }).then(safeJson),
  updateUser:  (id,d) => fetch(`${BASE_URL}/users?id=eq.${id}`, { method:"PATCH", headers:{...H,"Prefer":"return=representation"}, body:JSON.stringify(d) }).then(safeJson),
  deleteUser:  (id) => fetch(`${BASE_URL}/users?id=eq.${id}`, { method:"DELETE", headers:H }).then(safeJson),
  // 히스토리
  getHistory: () => fetch(`${BASE_URL}/history?select=*&order=ts.desc&limit=1000000`, { headers:{...H,"Range-Unit":"items","Range":"0-999999"} }).then(safeJson),
  addHistory: (d) => fetch(`${BASE_URL}/history`, { method:"POST", headers:H, body:JSON.stringify(d) }).then(safeJson),
  // 휴지통
  getTrash:    () => fetch(`${BASE_URL}/trash?select=*&order=created_at.desc`, { headers:H }).then(safeJson),
  addTrash:    (d) => fetch(`${BASE_URL}/trash`, { method:"POST", headers:{...H,"Prefer":"return=representation"}, body:JSON.stringify({...d, item_data: typeof d.item_data === "string" ? d.item_data : JSON.stringify(d.item_data)}) }).then(safeJson),
  deleteTrash: (id) => fetch(`${BASE_URL}/trash?id=eq.${id}`, { method:"DELETE", headers:H }).then(safeJson),
};

// ================================================================
// 🏠 [메인 앱]
// ================================================================
export default function App() {
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      html, body { overflow: hidden; height: 100%; margin: 0; padding: 0; }
      .hw-no-sb::-webkit-scrollbar { display: none; }
      ::-webkit-scrollbar { width: 4px; height: 4px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);
  const [isLoggedIn,  setIsLoggedIn]  = useState(() => localStorage.getItem("isLoggedIn") === "true");
  const [currentUser, setCurrentUser] = useState(() => { const s = localStorage.getItem("currentUser"); return s ? JSON.parse(s) : null; });
  const [view,    setView]    = useState("dashboard");
  const [isMobile,setIsMobile]= useState(typeof window!=="undefined" ? window.innerWidth<768 : false);
  const [hw,      setHw]      = useState([]);
  const [sw,      setSw]      = useState([]);
  const [users,   setUsers]   = useState([]);
  const [history, setHistory] = useState([]);
  const [trash,   setTrash]   = useState([]);

  const handleLogin  = async (user) => {
    setIsLoggedIn(true);
    setCurrentUser(user);
    localStorage.setItem("isLoggedIn","true");
    localStorage.setItem("currentUser",JSON.stringify(user));
    // 로그인 로그 기록
    const ip = await getClientIP();
    const clientInfo = getClientInfo();
    const detail = `IP: ${ip} / 환경: ${clientInfo}`;
    api.addHistory({
      ts: nowISO(), action:"로그인", aType:"user", aId: user.id||"", aName: user.name,
      detail, before:"", after:"",
      userName: user.name, userRole: user.role, clinic: user.clinic||""
    }).catch(console.error);
  };

  const handleLogout = async () => {
    // 로그아웃 로그: currentUser가 있는 동안 먼저 기록
    if (currentUser) {
      const ip = await getClientIP();
      const clientInfo = getClientInfo();
      const detail = `IP: ${ip} / 환경: ${clientInfo}`;
      await api.addHistory({
        ts: nowISO(), action:"로그아웃", aType:"user", aId: currentUser.id||"", aName: currentUser.name,
        detail, before:"", after:"",
        userName: currentUser.name, userRole: currentUser.role, clinic: currentUser.clinic||""
      }).catch(console.error);
    }
    setIsLoggedIn(false);
    setCurrentUser(null);
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("currentUser");
  };

  const fetchAll = useCallback(() => {
    api.getHW().then(d=>setHw(Array.isArray(d)?d:[])).catch(console.error);
    api.getSW().then(d=>setSw(Array.isArray(d)?d:[])).catch(console.error);
    api.getUsers().then(d=>setUsers(Array.isArray(d)?d:[])).catch(console.error);
    api.getHistory().then(d=>{ const l=Array.isArray(d)?d:[]; setHistory(l.sort((a,b)=>new Date(b.ts)-new Date(a.ts))); }).catch(console.error);
    api.getTrash().then(d=>setTrash(Array.isArray(d)?d:[])).catch(console.error);
  }, []);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth<768);
    window.addEventListener("resize", onResize);
    fetchAll();
    return () => window.removeEventListener("resize", onResize);
  }, [fetchAll]);

  const addHistory = useCallback((action, aType, aId, aName, detail, before="", after="") => {
    if (!currentUser) return;
    api.addHistory({ ts: nowISO(), action, aType, aId, aName, detail, before, after, userName: currentUser.name, userRole: currentUser.role, clinic: currentUser.clinic || "" })
      .then(() => api.getHistory().then(d => { const l=Array.isArray(d)?d:[]; setHistory(l.sort((a,b)=>new Date(b.ts)-new Date(a.ts))); }))
      .catch(console.error);
  }, [currentUser]);

  if (!isLoggedIn) return <LoginPage onLogin={handleLogin} users={users} />;
  const canEdit = currentUser?.role === "admin" || currentUser?.role === "user";
  const isAdmin = currentUser?.role === "admin";

  const menuItems = [
    { id: "dashboard", label: "홈",       icon: "🏠" },
    { id: "hardware",  label: "장비",     icon: "🖥️" },
    { id: "software",  label: "소프트웨어", icon: "💿" },
    { id: "users",     label: "사용자",   icon: "👤" },
    { id: "qrscan",    label: "QR 스캔",  icon: "📷" },
    { id: "history",   label: "로그",     icon: "📝" },
    { id: "trash",     label: "휴지통",   icon: "🗑️" },
  ];

  return (
    <div style={{ display:"flex", flexDirection:isMobile?"column":"row", height:"100vh", background:"#f8fafc", overflow:"hidden" }}>
      {!isMobile && (
        <div style={{ width:220, background:"#fff", borderRight:"1px solid #e2e8f0", padding:"24px 16px", display:"flex", flexDirection:"column" }}>
          <div onClick={()=>{ setView("dashboard"); window.location.reload(); }} style={{ fontSize:16, fontWeight:800, color:"#0f6e56", marginBottom:28, cursor:"pointer", userSelect:"none" }}>IT Asset Manager</div>
          <div style={{ flex:1 }}>
            {menuItems.map(m => (
              <div key={m.id} onClick={()=>setView(m.id)}
                style={{ padding:"10px 14px", borderRadius:10, cursor:"pointer", display:"flex", alignItems:"center", gap:8,
                  background:view===m.id?"#e8f5e9":"transparent", color:view===m.id?"#0f6e56":"#64748b",
                  fontWeight:700, marginBottom:3, fontSize:13 }}>
                <span>{m.icon}</span>{m.label}
              </div>
            ))}
          </div>
          <div style={{ fontSize:11, color:"#94a3b8", marginBottom:6 }}>{currentUser?.name} ({CLINICS[currentUser?.clinic]||currentUser?.clinic||"전체"})</div>
          <Btn onClick={handleLogout} style={{ fontSize:12 }}>로그아웃</Btn>
        </div>
      )}

      <div style={{ flex:1, overflowY:"auto", overflowX:"hidden", minWidth:0 }}>
        {isMobile && (
          <div style={{ background:"#fff", padding:"14px 18px", borderBottom:"1px solid #e2e8f0", display:"flex", justifyContent:"space-between", alignItems:"center", position:"sticky", top:0, zIndex:10 }}>
            <span onClick={()=>{ setView("dashboard"); window.location.reload(); }} style={{ fontWeight:800, color:"#0f6e56", fontSize:16, cursor:"pointer", userSelect:"none" }}>IT Asset Manager</span>
            <Btn onClick={handleLogout} style={{ fontSize:11, padding:"5px 10px" }}>로그아웃</Btn>
          </div>
        )}
        <main style={{ padding:isMobile?"16px":"32px", paddingBottom:40 }}>
          {view==="dashboard"  && <DashboardSection  hw={hw} sw={sw} history={history} isMobile={isMobile} />}
          {view==="hardware"   && <HardwareSection   data={hw} setHw={setHw} addHistory={addHistory} canEdit={canEdit} trash={trash} setTrash={setTrash} currentUser={currentUser} />}
          {view==="software"   && <SoftwareSection   data={sw} setSw={setSw} addHistory={addHistory} canEdit={canEdit} trash={trash} setTrash={setTrash} currentUser={currentUser} />}
          {view==="users"      && <UsersSection      users={users} setUsers={setUsers} addHistory={addHistory} isAdmin={isAdmin} currentUser={currentUser} />}
          {view==="history"    && <HistorySection    history={history} />}
          {view==="qrscan"    && <QRScanSection     hw={hw} />}
          {view==="trash"      && <TrashSection      trash={trash} setTrash={setTrash} setHw={setHw} setSw={setSw} addHistory={addHistory} canEdit={canEdit} />}
        </main>
      </div>

      {isMobile && (
        <div style={{ position:"fixed", bottom:0, left:0, right:0, height:65, background:"#fff", borderTop:"1px solid #e2e8f0", display:"flex", justifyContent:"space-around", alignItems:"center", zIndex:1000 }}>
          {menuItems.map(m => (
            <div key={m.id} onClick={()=>setView(m.id)} style={{ textAlign:"center", color:view===m.id?"#0f6e56":"#94a3b8" }}>
              <div style={{ fontSize:18 }}>{m.icon}</div>
              <div style={{ fontSize:9 }}>{m.label}</div>
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
function DashboardSection({ hw, sw, history, isMobile }) {
  const [clinicFilter, setClinicFilter] = useState("all");
  const filtered = clinicFilter === "all" ? hw : hw.filter(h => h.clinic === clinicFilter);

  const hwStats = {
    total:          filtered.length,
    active:         filtered.filter(h=>h.assetstatus==="active").length,
    inactive:       filtered.filter(h=>h.assetstatus==="inactive").length,
    repair:         filtered.filter(h=>h.assetstatus==="repair").length,
    disposed:       filtered.filter(h=>h.assetstatus==="disposed").length,
    dispose_target: filtered.filter(h=>h.assetstatus==="dispose_target").length,
  };
  const clinicCounts = Object.entries(CLINICS).filter(([k])=>k!=="all").map(([k,v])=>({
    key:k, name:v, count: hw.filter(h=>h.clinic===k).length,
  }));

  // 상태별 카드 — statusKey를 직접 사용해 badge 색상/텍스트를 STATUS_BADGE·ASSET_STATUS에서 가져옴
  const statusCards = [
    { label:"전체 장비",  statusKey:null,             value:hwStats.total,          textColor:"#0f6e56" },
    { label:"사용중",     statusKey:"active",          value:hwStats.active,          textColor:"#2563eb" },
    { label:"미사용",     statusKey:"inactive",        value:hwStats.inactive,        textColor:"#64748b" },
    { label:"수리중",     statusKey:"repair",          value:hwStats.repair,          textColor:"#c2410c" },
    { label:"폐기",       statusKey:"disposed",        value:hwStats.disposed,        textColor:"#cf1322" },
    { label:"폐기대상",   statusKey:"dispose_target",  value:hwStats.dispose_target,  textColor:"#d97706" },
    { label:"소프트웨어", statusKey:null,              value:sw.length,               textColor:"#7c3aed" },
    { label:"활동 로그",  statusKey:null,              value:history.length,          textColor:"#0891b2" },
  ];

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <h2 style={{ fontSize:22, fontWeight:700, margin:0 }}>실시간 현황</h2>
        <select value={clinicFilter} onChange={e=>setClinicFilter(e.target.value)}
          style={{ padding:"8px 12px", borderRadius:10, border:"1px solid #ddd", fontSize:13 }}>
          {Object.entries(CLINICS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* 지점별 카운트 */}
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(3,1fr)", gap:12, marginBottom:20 }}>
        {clinicCounts.map(c => (
          <div key={c.key} onClick={()=>setClinicFilter(c.key)}
            style={{ background: clinicFilter===c.key?"#e8f5e9":"#fff", padding:"16px 20px", borderRadius:16, border:`1.5px solid ${clinicFilter===c.key?"#0f6e56":"#e2e8f0"}`, cursor:"pointer" }}>
            <div style={{ fontSize:11, color:"#64748b", marginBottom:4 }}>🏥 {c.name}</div>
            <div style={{ fontSize:28, fontWeight:800, color:"#0f6e56" }}>{c.count}</div>
            <div style={{ fontSize:11, color:"#94a3b8" }}>등록 장비</div>
          </div>
        ))}
      </div>

      {/* 상태별 요약 */}
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":`repeat(4,1fr)`, gap:12, marginBottom:16 }}>
        {statusCards.map(c => {
          const badge = c.statusKey ? STATUS_BADGE[c.statusKey] : null;
          return (
            <div key={c.label} style={{ background:"#fff", padding:"14px 16px", borderRadius:16, border:"1px solid #e2e8f0", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div>
                <div style={{ fontSize:11, color:"#64748b", marginBottom:4 }}>{c.label}</div>
                <div style={{ fontSize:24, fontWeight:800, color:c.textColor }}>{c.value}</div>
              </div>
              {badge && (
                <span style={{ background:badge.bg, color:badge.color, padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:700 }}>
                  {ASSET_STATUS[c.statusKey]}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* 최근 활동 */}
      <h3 style={{ fontSize:14, fontWeight:700, marginBottom:10 }}>최근 활동 로그</h3>
      <div style={{ background:"#fff", borderRadius:14, border:"1px solid #eee", overflow:"hidden" }}>
        {history.slice(0,10).length===0
          ? <div style={{ padding:30, textAlign:"center", color:"#94a3b8" }}>활동 기록이 없습니다.</div>
          : history.slice(0,10).map((h,i) => (
            <div key={i} style={{ padding:"11px 16px", borderBottom:"1px solid #f8fafc", display:"flex", gap:12, alignItems:"center", flexWrap:"wrap" }}>
              <span style={{ fontSize:11, color:"#94a3b8", flexShrink:0 }}>{fDT(h.ts)}</span>
              <span style={{ fontSize:12 }}><b style={{color:"#0f6e56"}}>{h.userName}</b></span>
              <span style={{ fontSize:12, background:"#f1f5f9", padding:"2px 8px", borderRadius:10 }}>{h.action}</span>
              <span style={{ fontSize:12, color:"#334155" }}>{h.aName}</span>
              {h.detail && <span style={{ fontSize:11, color:"#94a3b8" }}>{h.detail}</span>}
            </div>
          ))
        }
      </div>
    </div>
  );
}

// ================================================================
// 🖥️ [하드웨어]
// ================================================================
function HardwareSection({ data, setHw, addHistory, canEdit, trash, setTrash, currentUser }) {
  const [modal,        setModal]        = useState(null);
  const [form,         setForm]         = useState({});
  const [detailItem,   setDetailItem]   = useState(null);
  const [qrItem,       setQrItem]       = useState(null);
  const [showQRScan,   setShowQRScan]   = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [importLoading,setImportLoading]= useState(false);
  const [searchText,   setSearchText]   = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType,   setFilterType]   = useState("");
  const [filterClinic, setFilterClinic] = useState("all");
  const [showColMenu,  setShowColMenu]  = useState(false);
  const [selectedIds,  setSelectedIds]  = useState(new Set()); // 선택된 항목 ID
  const [pageSize,     setPageSize]     = useState(20);         // 페이지당 표시 수
  const [currentPage,  setCurrentPage]  = useState(1);         // 현재 페이지
  const hwColPrefKey = `hw_cols_${currentUser?.loginid||"default"}`;
  const [visibleCols,  setVisibleCols]  = useState(()=>loadColPref(hwColPrefKey, DEFAULT_HW_COLS));
  const fileInputRef = useRef(null);
  const colMenuRef   = useRef(null);

  useEffect(() => {
    const h = (e) => { if (colMenuRef.current && !colMenuRef.current.contains(e.target)) setShowColMenu(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);

  const toggleCol = (key) => setVisibleCols(prev => {
    const n=new Set(prev); n.has(key)?n.delete(key):n.add(key);
    saveColPref(hwColPrefKey, n); return n;
  });
  const toggleAll = (all) => {
    const n=all?new Set(ALL_HW_COLS.map(c=>c.key)):new Set(["gccode"]);
    saveColPref(hwColPrefKey, n); setVisibleCols(n);
  };

  const filtered = data.filter(h => {
    const q = searchText.trim().toLowerCase();
    const matchText = !q || [h.gccode,h.imedcode,h.username,h.team,h.modelname,h.location,h.pcname,h.serialnumber,h.notes]
      .some(v=>(v||"").toLowerCase().includes(q));
    const matchStatus = !filterStatus || h.assetstatus===filterStatus;
    const matchType   = !filterType   || h.assettype===filterType;
    const matchClinic = filterClinic==="all" || h.clinic===filterClinic;
    return matchText && matchStatus && matchType && matchClinic;
  });

  // 페이지네이션
  const totalPages = pageSize === 0 ? 1 : Math.ceil(filtered.length / pageSize);
  const pagedRows  = pageSize === 0 ? filtered : filtered.slice((currentPage-1)*pageSize, currentPage*pageSize);

  // 필터 바뀌면 1페이지로
  useEffect(() => setCurrentPage(1), [searchText, filterStatus, filterType, filterClinic, pageSize]);



  const deleteSelected = async () => {
    if (selectedIds.size === 0) return alert("삭제할 항목을 선택하세요.");
    if (!window.confirm(`선택한 ${selectedIds.size}건을 휴지통으로 이동하시겠습니까?`)) return;
    const items = data.filter(h => selectedIds.has(h.id));
    for (const item of items) {
      const name = item.gccode||item.modelname||"자산";
      try {
        await api.deleteHW(item.id);
        await api.addTrash({ item_data: JSON.stringify(item), table_name:"assets", deletedat:nowISO() });
        addHistory("하드웨어 삭제","hardware",item.id,name,"선택삭제-휴지통",JSON.stringify(item),"");
      } catch(e) { console.error(e); alert(`삭제 오류 (${name}): ${e.message}`); }
    }
    setSelectedIds(new Set());
    const fresh = await api.getHW();
    setHw(Array.isArray(fresh)?fresh:[]);
    const newTrash = await api.getTrash();
    setTrash(Array.isArray(newTrash)?newTrash:[]);
  };

  const save = () => {
    if (!form.gccode && !form.modelname && !form.imedcode) return alert("GC자산코드 또는 모델명을 입력하세요.");
    setLoading(true);
    const isAdd = modal==="add";
    // 번호 자동입력: 등록 시 현재 최대 번호 + 1
    let formData = form;
    if (isAdd && !form.num) {
      const maxNum = Math.max(0, ...data.map(h => parseInt(h.num) || 0));
      formData = { ...form, num: maxNum + 1 };
    }
    const before = isAdd ? "" : JSON.stringify(data.find(h=>h.id===formData.id)||{});
    const req = isAdd ? api.addHW(formData) : api.updateHW(formData.id, formData);
    req.then(()=>api.getHW()).then(list=>{
      const fresh = Array.isArray(list)?list:[];
      setHw(fresh);
      const name = formData.gccode||formData.modelname||formData.imedcode||"자산";
      const after = JSON.stringify(formData);
      if (isAdd) { const c=fresh.find(h=>h.gccode===formData.gccode); addHistory("하드웨어 등록","hardware",c?.id??"",name,"신규 등록","",after); }
      else         addHistory("하드웨어 수정","hardware",formData.id,name,"정보 수정",before,after);
      setModal(null);
    }).catch(err=>alert(`오류: ${err.message}`)).finally(()=>setLoading(false));
  };

  const deleteItem = (item) => {
    const name = item.gccode||item.modelname||"자산";
    if (!window.confirm(`"${name}"을(를) 휴지통으로 이동하시겠습니까?`)) return;
    api.deleteHW(item.id)
      .then(()=>api.addTrash({ item_data: JSON.stringify(item), table_name:"assets", deletedat:nowISO() }))
      .then(added=>{
        setHw(prev=>prev.filter(h=>h.id!==item.id));
        const t=Array.isArray(added)?added[0]:added;
        if(t) setTrash(prev=>[...prev,t]);
        addHistory("하드웨어 삭제","hardware",item.id,name,"휴지통 이동",JSON.stringify(item),"");
      }).catch(err=>alert("삭제 오류: "+err.message));
  };

  // 📋 가져오기 양식 다운로드
  const downloadTemplate = () => {
    const header = HW_FIELDS.filter(f => f.key !== "num").map(f => f.label).join(",");
    const example = HW_FIELDS.filter(f => f.key !== "num").map(f => {
      const ex = {
        "자산상태":"사용중","지점":"강남의원","실사날짜":"2025-01-15",
        "GC자산코드(SAP)":"5800001141","아이메드코드":"GCSF-PC-001",
        "제조번호":"SN123456","IP":"192.168.1.100","팀(부서명)":"HIS개발팀",
        "사용자":"홍길동","PC 이름":"O034052","모델명":"NT901X5J",
        "자산구분":"노트북","비고(이력관리)":"정상사용중","MAC Address":"AA:BB:CC:DD:EE:FF",
        "자산 수령일":"2023-01-01","구입일자":"2023-01-01","제조사":"삼성",
        "CPU":"i5-7200U","Memory":"8GB","하드디스크":"SSD 256GB",
        "목적/기능":"업무용","법인":"GC케어","위치(건물)":"여의도파크원",
        "구매정보(전자결재)":"전자결재001"
      };
      return `"${(ex[f.label]||"").replace(/"/g,'""')}"`;
    }).join(",");
    const csv = "\uFEFF" + [header, example].join("\n");
    triggerDownload(new Blob([csv],{type:"text/csv;charset=utf-8"}), "장비가져오기_양식.csv");
  };

  const exportCSV = () => {
    const header = HW_FIELDS.map(f=>f.label).join(",");
    const rows = data.map(item=>HW_FIELDS.map(f=>`"${String(item[f.key]??"").replace(/"/g,'""')}"`).join(","));
    triggerDownload(new Blob(["\uFEFF"+[header,...rows].join("\n")],{type:"text/csv;charset=utf-8"}),`장비목록_${todayStr()}.csv`);
  };
  const exportExcel = async () => {
    try {
      const XLSX = await import("xlsx");
      const d = data.map(item=>{ const r={}; HW_FIELDS.forEach(f=>{r[f.label]=item[f.key]??""}); return r; });
      const ws = XLSX.utils.json_to_sheet(d); const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb,ws,"장비목록"); XLSX.writeFile(wb,`장비목록_${todayStr()}.xlsx`);
    } catch { alert("xlsx 패키지를 설치하세요: npm install xlsx"); }
  };
  const parseCSVLine = (line) => {
    const res=[]; let cur=""; let inQ=false;
    for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(inQ&&line[i+1]==='"'){cur+='"';i++;}else inQ=!inQ;}else if(c===","&&!inQ){res.push(cur.trim());cur="";}else cur+=c;}
    res.push(cur.trim()); return res;
  };
  const handleImport = async (e) => {
    const file=e.target.files[0]; if(!file) return;
    setImportLoading(true);
    try {
      let rawRows=[];
      if(file.name.toLowerCase().endsWith(".csv")){
        const text=(await file.text()).replace(/^\uFEFF/,"");
        const lines=text.split(/\r?\n/).filter(l=>l.trim());
        const headers=parseCSVLine(lines[0]);
        rawRows=lines.slice(1).map(line=>{const v=parseCSVLine(line);const o={};headers.forEach((h,i)=>{o[h]=v[i]||"";});return o;});
      } else {
        const XLSX=await import("xlsx");
        const buf=await file.arrayBuffer(); const wb=XLSX.read(buf,{type:"array"});
        rawRows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:""});
      }
      const existingMaxNum = Math.max(0, ...data.map(h => parseInt(h.num) || 0));
      const items=rawRows.filter(r=>Object.values(r).some(v=>v!=="")).map((row,idx)=>{
        const item={};
        HW_FIELDS.forEach(f=>{
          const val=row[f.label]!==undefined?row[f.label]:(row[f.key]!==undefined?row[f.key]:"");
          item[f.key] = val!=="" ? val : null;
        });
        if(!item.assetstatus) item.assetstatus = "active";
        if(!item.assettype)   item.assettype   = "laptop";
        item.num = existingMaxNum + idx + 1;
        return item;
      });
      if(!items.length){alert("데이터 없음");return;}
      const MAX_IMPORT = 1000;
      if(items.length > MAX_IMPORT){
        alert(`한 번에 최대 ${MAX_IMPORT}건까지 가져올 수 있습니다.\n현재 ${items.length}건 → 처음 ${MAX_IMPORT}건만 가져옵니다.`);
        items.splice(MAX_IMPORT);
      }
      if(!window.confirm(`${items.length}건을 가져오시겠습니까?\n\n⚠️ 한 번에 최대 1000건까지 등록 가능합니다.`)) return;
      const res=await fetch(`${BASE_URL}/assets`,{method:"POST",headers:{...H,"Prefer":"return=representation"},body:JSON.stringify(items)});
      if(!res.ok){throw new Error(await res.text());}
      const inserted = await res.clone().json().catch(()=>items);
      await api.getHW().then(list=>setHw(Array.isArray(list)?list:[]));
      // 파일 전체 요약 로그
      const gcCodes = items.map(it=>it.gccode||it.modelname||it.imedcode||"-").join(", ");
      const summary = `파일명: ${file.name} / ${items.length}건 / GC코드: ${gcCodes.length>200?gcCodes.slice(0,200)+"...":gcCodes}`;
      addHistory("파일 가져오기","hardware","",`${items.length}건`,summary,"",JSON.stringify(items.map(it=>({num:it.num,gccode:it.gccode,imedcode:it.imedcode,modelname:it.modelname,assetstatus:it.assetstatus,clinic:it.clinic,team:it.team,username:it.username}))));
      // 항목별 개별 로그
      items.forEach((it,idx)=>{
        const name=it.gccode||it.modelname||it.imedcode||`항목${idx+1}`;
        const detail=`파일가져오기 (${file.name}) / 지점:${it.clinic||"-"} / 팀:${it.team||"-"} / 사용자:${it.username||"-"} / 상태:${it.assetstatus||"-"}`;
        addHistory("장비 등록(가져오기)","hardware","",name,detail,"",JSON.stringify(it));
      });
      alert(`${items.length}건 완료!`);
    } catch(err){ alert("가져오기 실패: "+err.message); }
    finally{ setImportLoading(false); e.target.value=""; }
  };

  // 컬럼 렌더러
  const COL_RENDERERS = {
    num:           h=><span style={{color:"#64748b",fontSize:12}}>{h.num||"-"}</span>,
    assetstatus:   h=>{ const s=STATUS_BADGE[h.assetstatus]||{bg:"#f1f5f9",color:"#64748b"}; return <span style={{background:s.bg,color:s.color,padding:"3px 8px",borderRadius:20,fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>{ASSET_STATUS[h.assetstatus]||h.assetstatus||"-"}</span>; },
    clinic:        h=><span style={{fontSize:12}}>{CLINICS[h.clinic]||h.clinic||"-"}</span>,
    inspectiondate:h=><span style={{fontSize:12}}>{h.inspectiondate||"-"}</span>,
    gccode:        h=><b style={{fontSize:12}}>{h.gccode||"-"}</b>,
    imedcode:      h=><span style={{fontSize:12}}>{h.imedcode||"-"}</span>,
    serialnumber:  h=><span style={{fontSize:12}}>{h.serialnumber||"-"}</span>,
    ip:            h=><span style={{fontSize:12}}>{h.ip||"-"}</span>,
    team:          h=><span style={{fontSize:12}}>{h.team||"-"}</span>,
    username:      h=><span style={{fontSize:12}}>{h.username||"-"}</span>,
    pcname:        h=><span style={{fontSize:12}}>{h.pcname||"-"}</span>,
    modelname:     h=><span style={{fontSize:12}}>{h.modelname||"-"}</span>,
    assettype:     h=><span style={{fontSize:12}}>{ASSET_TYPES[h.assettype]||h.assettype||"-"}</span>,
    notes:         h=><span style={{fontSize:12,maxWidth:120,display:"block",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h.notes||"-"}</span>,
    macaddress:    h=><span style={{fontSize:11}}>{h.macaddress||"-"}</span>,
    receiptdate:   h=><span style={{fontSize:12}}>{h.receiptdate||"-"}</span>,
    purchasedate:  h=><span style={{fontSize:12}}>{h.purchasedate||"-"}</span>,
    manufacturer:  h=><span style={{fontSize:12}}>{h.manufacturer||"-"}</span>,
    cpu:           h=><span style={{fontSize:12}}>{h.cpu||"-"}</span>,
    memory:        h=><span style={{fontSize:12}}>{h.memory||"-"}</span>,
    hdd:           h=><span style={{fontSize:12}}>{h.hdd||"-"}</span>,
    purpose:       h=><span style={{fontSize:12}}>{h.purpose||"-"}</span>,
    corporation:   h=><span style={{fontSize:12}}>{h.corporation||"-"}</span>,
    location:      h=><span style={{fontSize:12}}>{h.location||"-"}</span>,
    purchaseinfo:  h=><span style={{fontSize:12}}>{h.purchaseinfo||"-"}</span>,
  };

  const allPageIds = pagedRows.map(h=>h.id);
  const isAllChecked = allPageIds.length>0 && allPageIds.every(id=>selectedIds.has(id));
  const activeCols = [
    {
      label: () => (
        <input type="checkbox" checked={isAllChecked}
          onChange={e=>{ const n=new Set(selectedIds); if(e.target.checked){allPageIds.forEach(id=>n.add(id));}else{allPageIds.forEach(id=>n.delete(id));} setSelectedIds(n); }}
          style={{accentColor:"#0f6e56",width:13,height:13,cursor:"pointer"}} />
      ),
      minWidth:36, noClip:true,
      render: h=>(
        <input type="checkbox" checked={selectedIds.has(h.id)}
          onChange={e=>{ const n=new Set(selectedIds); e.target.checked?n.add(h.id):n.delete(h.id); setSelectedIds(n); }}
          onClick={e=>e.stopPropagation()}
          style={{accentColor:"#0f6e56",width:13,height:13,cursor:"pointer"}} />
      )
    },
    ...ALL_HW_COLS.filter(c=>visibleCols.has(c.key)).map(c=>({ label:c.label, render:COL_RENDERERS[c.key]||(h=>h[c.key]||"-") }))
  ];
  if (canEdit) activeCols.push({ label:"관리", minWidth:190, noClip:true, render: h=>(
    <div style={{display:"flex",gap:4,flexWrap:"nowrap"}}>
      <Btn onClick={()=>{setDetailItem(h);setModal("detail");}} style={{fontSize:11,padding:"5px 7px"}}>상세</Btn>
      <Btn onClick={()=>{setQrItem(h);setModal("qr");}}         style={{fontSize:11,padding:"5px 7px"}}>QR</Btn>
      <Btn onClick={()=>{setForm({...h});setModal("edit");}}    style={{fontSize:11,padding:"5px 7px"}}>수정</Btn>
      <Btn onClick={()=>deleteItem(h)} variant="danger"         style={{fontSize:11,padding:"5px 7px"}}>삭제</Btn>
    </div>
  )});

  return (
    <div>
      <div style={{marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8,marginBottom:12}}>
          <h2 style={{margin:0,fontSize:20}}>하드웨어 <span style={{fontSize:13,color:"#64748b",fontWeight:500}}>전체 {data.length}건{filtered.length!==data.length?` · 필터 ${filtered.length}건`:""}{selectedIds.size>0?` · 선택 ${selectedIds.size}건`:""}</span></h2>
          <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
            <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleImport} style={{display:"none"}}/>
            <Btn onClick={()=>fileInputRef.current?.click()} disabled={importLoading}>{importLoading?"가져오는 중...":"📂 가져오기"}</Btn>
            <Btn onClick={downloadTemplate}>📋 양식 다운로드</Btn>
            <Btn onClick={exportCSV}>⬇️ CSV</Btn>
            <Btn onClick={exportExcel}>⬇️ Excel</Btn>
            <div ref={colMenuRef} style={{position:"relative"}}>
              <Btn onClick={()=>setShowColMenu(v=>!v)}>🔧 컬럼 {visibleCols.size}/{ALL_HW_COLS.length}</Btn>
              {showColMenu && (
                <div style={{position:"absolute",top:"calc(100% + 6px)",right:0,background:"#fff",border:"1px solid #e2e8f0",borderRadius:14,boxShadow:"0 8px 32px rgba(0,0,0,0.12)",zIndex:500,padding:14,width:260}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:8,paddingBottom:8,borderBottom:"1px solid #f0f0f0"}}>
                    <span style={{fontSize:12,fontWeight:700}}>컬럼 선택</span>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>toggleAll(true)}  style={{fontSize:11,color:"#0f6e56",border:"none",background:"none",cursor:"pointer",fontWeight:600}}>전체</button>
                      <button onClick={()=>toggleAll(false)} style={{fontSize:11,color:"#cf1322",border:"none",background:"none",cursor:"pointer",fontWeight:600}}>초기화</button>
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:2,maxHeight:300,overflowY:"auto"}}>
                    {ALL_HW_COLS.map(c=>(
                      <label key={c.key} style={{display:"flex",alignItems:"center",gap:5,padding:"4px",borderRadius:6,cursor:"pointer",fontSize:12,
                        background:visibleCols.has(c.key)?"#e8f5e9":"transparent",color:visibleCols.has(c.key)?"#0f6e56":"#64748b",fontWeight:visibleCols.has(c.key)?600:400}}>
                        <input type="checkbox" checked={visibleCols.has(c.key)} onChange={()=>toggleCol(c.key)} style={{accentColor:"#0f6e56",width:12,height:12}}/>
                        {c.label}
                      </label>
                    ))}
                  </div>
                  <div style={{marginTop:8,paddingTop:8,borderTop:"1px solid #f0f0f0",fontSize:11,color:"#94a3b8"}}>💾 계정별 자동 저장됩니다</div>
                </div>
              )}
            </div>
            {canEdit && selectedIds.size>0 && (
              <Btn onClick={deleteSelected} variant="danger">🗑️ 선택삭제 ({selectedIds.size})</Btn>
            )}
            <Btn onClick={()=>setShowQRScan(true)} style={{background:"#0f6e56",color:"#fff",border:"none"}}>📷 QR 스캔</Btn>
            {canEdit && <Btn onClick={()=>{setForm({assetstatus:"active",assettype:"laptop"});setModal("add");}} variant="primary">+ 등록</Btn>}
          </div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <div style={{position:"relative",flex:1,minWidth:160}}>
            <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"#94a3b8"}}>🔍</span>
            <input placeholder="GC코드, 사용자, 팀, 모델명 검색..." value={searchText} onChange={e=>setSearchText(e.target.value)}
              style={{width:"100%",padding:"9px 30px",borderRadius:10,border:"1px solid #ddd",fontSize:13,boxSizing:"border-box"}}/>
            {searchText && <button onClick={()=>setSearchText("")} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#94a3b8"}}>✕</button>}
          </div>
          <select value={filterClinic} onChange={e=>setFilterClinic(e.target.value)} style={{padding:"9px 10px",borderRadius:10,border:"1px solid #ddd",fontSize:13,background:"#fff"}}>
            {Object.entries(CLINICS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
          </select>
          <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{padding:"9px 10px",borderRadius:10,border:"1px solid #ddd",fontSize:13,background:"#fff"}}>
            <option value="">상태 전체</option>
            {Object.entries(ASSET_STATUS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
          </select>
          <select value={filterType} onChange={e=>setFilterType(e.target.value)} style={{padding:"9px 10px",borderRadius:10,border:"1px solid #ddd",fontSize:13,background:"#fff"}}>
            <option value="">구분 전체</option>
            {Object.entries(ASSET_TYPES).map(([k,v])=><option key={k} value={k}>{v}</option>)}
          </select>
          {(searchText||filterStatus||filterType||filterClinic!=="all") && <Btn onClick={()=>{setSearchText("");setFilterStatus("");setFilterType("");setFilterClinic("all");}}>초기화</Btn>}
        </div>
      </div>

      {/* 페이지 크기 + 페이지네이션 */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:"#64748b"}}>
          <span>페이지당</span>
          <select value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setCurrentPage(1);}}
            style={{padding:"5px 8px",borderRadius:8,border:"1px solid #ddd",fontSize:13,background:"#fff"}}>
            {[10,20,30,50,100].map(n=><option key={n} value={n}>{n}개</option>)}
          </select>
          <span style={{fontSize:12}}>({(currentPage-1)*pageSize+1}–{Math.min(currentPage*pageSize,filtered.length)} / {filtered.length}건)</span>
        </div>
        {totalPages>1 && (
          <div style={{display:"flex",gap:4,alignItems:"center"}}>
            <Btn onClick={()=>setCurrentPage(1)}          disabled={currentPage===1}          style={{padding:"5px 10px",fontSize:12}}>«</Btn>
            <Btn onClick={()=>setCurrentPage(p=>p-1)}     disabled={currentPage===1}          style={{padding:"5px 10px",fontSize:12}}>‹</Btn>
            {Array.from({length:Math.min(5,totalPages)},(_,i)=>{
              let p = currentPage<=3 ? i+1 : currentPage+i-2;
              if(p>totalPages) return null;
              return <Btn key={p} onClick={()=>setCurrentPage(p)}
                style={{padding:"5px 10px",fontSize:12,background:p===currentPage?"#0f6e56":"#fff",color:p===currentPage?"#fff":"#333",border:"1px solid #ddd"}}>{p}</Btn>;
            })}
            <Btn onClick={()=>setCurrentPage(p=>p+1)}     disabled={currentPage===totalPages} style={{padding:"5px 10px",fontSize:12}}>›</Btn>
            <Btn onClick={()=>setCurrentPage(totalPages)} disabled={currentPage===totalPages} style={{padding:"5px 10px",fontSize:12}}>»</Btn>
          </div>
        )}
      </div>
      <ResponsiveTable cols={activeCols} rows={pagedRows} empty="등록된 자산이 없습니다." />

      {(modal==="add"||modal==="edit") && (
        <Modal title={modal==="add"?"새 자산 등록":"자산 정보 수정"} onClose={()=>setModal(null)}>
          <HWForm form={form} setForm={setForm} onSave={save} loading={loading} isEdit={modal==="edit"} />
        </Modal>
      )}
      {modal==="detail" && detailItem && (
        <Modal title={`상세 — ${detailItem.gccode||detailItem.modelname||""}`} onClose={()=>setModal(null)}>
          <HWDetail item={detailItem} />
        </Modal>
      )}
      {modal==="qr" && qrItem && (
        <Modal title={`QR 코드 — ${qrItem.gccode||qrItem.modelname||""}`} onClose={()=>setModal(null)}>
          <QRModal item={qrItem} />
        </Modal>
      )}

      {/* 장비 목록 내 QR 스캔 모달 */}
      {showQRScan && (
        <Modal title="📷 QR 스캔 — 아이메드코드 인식" onClose={()=>setShowQRScan(false)}>
          <QRScanSection hw={data} onClose={()=>setShowQRScan(false)} />
        </Modal>
      )}
    </div>
  );
}

// ── 하드웨어 폼
function HWForm({ form, setForm, onSave, loading, isEdit }) {
  const inp = { padding:"8px 10px", borderRadius:8, border:"1px solid #ddd", fontSize:13, width:"100%", boxSizing:"border-box" };
  return (
    <div style={{maxHeight:"62vh",overflowY:"auto",paddingRight:4}}>
      {HW_SECTIONS.map(sec=>(
        <div key={sec.title} style={{marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:700,color:"#0f6e56",padding:"3px 0 7px",borderBottom:"1px solid #e2e8f0",marginBottom:8}}>{sec.title}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {sec.keys.map(key=>{
              const f=HW_FIELD_MAP[key]; if(!f) return null;
              // 번호(num)는 신규 등록 시 자동 부여되므로 숨김
              if(key==="num" && !isEdit) return null;
              // 번호(num) 수정 시엔 읽기전용으로 표시
              if(key==="num" && isEdit) return (
                <label key={key} style={{display:"flex",flexDirection:"column",gap:3}}>
                  <span style={{fontSize:11,color:"#64748b"}}>{f.label} <span style={{color:"#94a3b8"}}>(자동)</span></span>
                  <input type="number" value={form[key]||""} readOnly style={{...inp,background:"#f8fafc",color:"#94a3b8",cursor:"not-allowed"}}/>
                </label>
              );
              if(f.type==="select") return (
                <label key={key} style={{display:"flex",flexDirection:"column",gap:3}}>
                  <span style={{fontSize:11,color:"#64748b"}}>{f.label}</span>
                  <select value={form[key]||""} onChange={e=>setForm({...form,[key]:e.target.value})} style={inp}>
                    <option value="">선택...</option>
                    {Object.entries(f.options).filter(([k])=>k!=="all").map(([k,v])=><option key={k} value={k}>{v}</option>)}
                  </select>
                </label>
              );
              if(f.type==="textarea") return (
                <label key={key} style={{display:"flex",flexDirection:"column",gap:3,gridColumn:"1 / -1"}}>
                  <span style={{fontSize:11,color:"#64748b"}}>{f.label}</span>
                  <textarea value={form[key]||""} onChange={e=>setForm({...form,[key]:e.target.value})} rows={3} style={{...inp,resize:"vertical"}}/>
                </label>
              );
              return (
                <label key={key} style={{display:"flex",flexDirection:"column",gap:3}}>
                  <span style={{fontSize:11,color:"#64748b"}}>{f.label}</span>
                  <input type={f.type} value={form[key]||""} onChange={e=>setForm({...form,[key]:e.target.value})} style={inp}/>
                </label>
              );
            })}
          </div>
        </div>
      ))}
      <Btn onClick={onSave} variant="primary" disabled={loading} style={{width:"100%",padding:13,marginTop:4}}>{loading?"저장 중...":"저장"}</Btn>
    </div>
  );
}
// ── 하드웨어 상세
function HWDetail({ item }) {
  return (
    <div style={{maxHeight:"62vh",overflowY:"auto"}}>
      {HW_SECTIONS.map(sec=>{
        const vis=sec.keys.filter(k=>item[k]!==undefined&&item[k]!==""&&item[k]!==null);
        if(!vis.length) return null;
        return (
          <div key={sec.title} style={{marginBottom:16}}>
            <div style={{fontSize:12,fontWeight:700,color:"#0f6e56",padding:"3px 0 7px",borderBottom:"1px solid #e2e8f0",marginBottom:8}}>{sec.title}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {vis.map(key=>{
                const f=HW_FIELD_MAP[key]; if(!f) return null;
                const val=item[key]; const d=f.type==="select"?(f.options?.[val]||val):String(val);
                return (
                  <div key={key} style={{padding:"8px 10px",background:"#f8fafc",borderRadius:8,gridColumn:f.type==="textarea"?"1 / -1":"auto"}}>
                    <div style={{fontSize:11,color:"#94a3b8",marginBottom:2}}>{f.label}</div>
                    <div style={{fontSize:13,fontWeight:600,color:"#1e293b",wordBreak:"break-all"}}>{d}</div>
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
// ── QR 코드 모달
function QRModal({ item }) {
  const info = [
    `GC코드: ${item.gccode||"-"}`,
    `모델: ${item.modelname||"-"}`,
    `사용자: ${item.username||"-"}`,
    `팀: ${item.team||"-"}`,
    `지점: ${CLINICS[item.clinic]||item.clinic||"-"}`,
    `상태: ${ASSET_STATUS[item.assetstatus]||item.assetstatus||"-"}`,
    `IP: ${item.ip||"-"}`,
    `S/N: ${item.serialnumber||"-"}`,
  ].join("\n");
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(info)}&charset-source=UTF-8`;
  return (
    <div style={{textAlign:"center",padding:"8px 0"}}>
      <img src={qrUrl} alt="QR" style={{width:220,height:220,border:"1px solid #e2e8f0",borderRadius:12,marginBottom:16}}/>
      <div style={{background:"#f8fafc",borderRadius:10,padding:"12px 16px",textAlign:"left",fontSize:12,lineHeight:1.8,marginBottom:16}}>
        {info.split("\n").map((l,i)=><div key={i}>{l}</div>)}
      </div>
      <Btn onClick={()=>window.open(qrUrl,"_blank")} variant="primary">🖨️ QR 이미지 열기</Btn>
    </div>
  );
}

// ================================================================
// 💿 [소프트웨어]
// ================================================================
const SW_FIELDS = [
  { key:"name",        label:"소프트웨어명",   type:"text"     },
  { key:"category",    label:"카테고리",       type:"select",  options:SW_CATEGORIES },
  { key:"version",     label:"버전",           type:"text"     },
  { key:"vendor",      label:"제조사/벤더",    type:"text"     },
  { key:"licensetype", label:"라이선스 유형",  type:"text"     },
  { key:"licensekey",  label:"라이선스 키",    type:"text"     },
  { key:"quantity",    label:"수량",           type:"number"   },
  { key:"cost",        label:"비용",           type:"text"     },
  { key:"purchasedate",label:"구입일",         type:"text"     },
  { key:"expirydate",  label:"만료일",         type:"text"     },
  { key:"assignedto",  label:"담당자",         type:"text"     },
  { key:"clinic",      label:"지점",           type:"select",  options:CLINICS },
  { key:"status",      label:"상태",           type:"select",  options:SW_STATUS },
  { key:"notes",       label:"비고",           type:"textarea" },
];
const SW_FIELD_MAP  = Object.fromEntries(SW_FIELDS.map(f=>[f.key,f]));
const ALL_SW_COLS   = SW_FIELDS.map(f=>({key:f.key,label:f.label}));
const DEFAULT_SW_COLS = new Set(["name","category","version","vendor","quantity","expirydate","assignedto","clinic","status"]);

// localStorage 컬럼 설정 저장/불러오기
const loadColPref = (key, def) => {
  try { const s=localStorage.getItem(key); return s?new Set(JSON.parse(s)):def; } catch { return def; }
};
const saveColPref = (key, set) => {
  try { localStorage.setItem(key, JSON.stringify([...set])); } catch {}
};

function SoftwareSection({ data, setSw, addHistory, canEdit, trash, setTrash, currentUser }) {
  const colPrefKey = `sw_cols_${currentUser?.loginid||"default"}`;
  const [modal,        setModal]       = useState(null);
  const [form,         setForm]        = useState({});
  const [loading,      setLoading]     = useState(false);
  const [importLoading,setImportLoading]=useState(false);
  const [search,       setSearch]      = useState("");
  const [filterClinic, setFilterClinic]= useState("all");
  const [filterStatus, setFilterStatus]= useState("");
  const [filterCat,    setFilterCat]   = useState("");
  const [showColMenu,  setShowColMenu] = useState(false);
  const [visibleCols,  setVisibleCols] = useState(()=>loadColPref(colPrefKey, DEFAULT_SW_COLS));
  const [selectedIds,  setSelectedIds] = useState(new Set());
  const [pageSize,     setPageSize]    = useState(20);
  const [currentPage,  setCurrentPage] = useState(1);
  const fileInputRef = useRef(null);
  const colMenuRef   = useRef(null);

  useEffect(()=>{
    const h=(e)=>{if(colMenuRef.current&&!colMenuRef.current.contains(e.target))setShowColMenu(false);};
    document.addEventListener("mousedown",h); return()=>document.removeEventListener("mousedown",h);
  },[]);

  const toggleCol = (key) => setVisibleCols(prev=>{
    const n=new Set(prev); n.has(key)?n.delete(key):n.add(key);
    saveColPref(colPrefKey, n); return n;
  });
  const toggleAll = (all) => { const n=all?new Set(ALL_SW_COLS.map(c=>c.key)):new Set(["name"]); saveColPref(colPrefKey,n); setVisibleCols(n); };

  const filtered = data.filter(s=>{
    const q=search.trim().toLowerCase();
    const mt=!q||[s.name,s.vendor,s.assignedto,s.licensekey,s.version].some(v=>(v||"").toLowerCase().includes(q));
    const mc=filterClinic==="all"||s.clinic===filterClinic;
    const ms=!filterStatus||s.status===filterStatus;
    const mk=!filterCat||s.category===filterCat;
    return mt&&mc&&ms&&mk;
  });

  const totalPages  = pageSize===0?1:Math.ceil(filtered.length/pageSize);
  const pagedRows   = pageSize===0?filtered:filtered.slice((currentPage-1)*pageSize,currentPage*pageSize);
  useEffect(()=>setCurrentPage(1),[search,filterClinic,filterStatus,filterCat,pageSize]);



  const deleteSelected = async () => {
    if (selectedIds.size === 0) return alert("삭제할 항목을 선택하세요.");
    if (!window.confirm(`선택한 ${selectedIds.size}건을 휴지통으로 이동하시겠습니까?`)) return;
    const items = data.filter(s => selectedIds.has(s.id));
    for (const item of items) {
      try {
        await api.deleteSW(item.id);
        await api.addTrash({ item_data: JSON.stringify(item), table_name:"software", deletedat:nowISO() });
        addHistory("소프트웨어 삭제","software",item.id,item.name,"선택삭제-휴지통",JSON.stringify(item),"");
      } catch(e) { console.error(e); alert(`삭제 오류 (${item.name}): ${e.message}`); }
    }
    setSelectedIds(new Set());
    const fresh = await api.getSW();
    setSw(Array.isArray(fresh)?fresh:[]);
    const newTrash = await api.getTrash();
    setTrash(Array.isArray(newTrash)?newTrash:[]);
  };

  const save = () => {
    setLoading(true);
    const isAdd=modal==="add";
    const before=isAdd?"":JSON.stringify(data.find(s=>s.id===form.id)||{});
    const req=isAdd?api.addSW(form):api.updateSW(form.id,form);
    req.then(()=>api.getSW()).then(list=>{
      setSw(Array.isArray(list)?list:[]);
      addHistory(isAdd?"소프트웨어 등록":"소프트웨어 수정","software",form.id||"",form.name,isAdd?"신규 등록":"정보 수정",before,JSON.stringify(form));
      setModal(null);
    }).catch(err=>alert("오류: "+err.message)).finally(()=>setLoading(false));
  };

  const deleteItem = (item) => {
    if(!window.confirm(`"${item.name}" 휴지통으로 이동?`)) return;
    api.deleteSW(item.id)
      .then(()=>api.addTrash({item_data: JSON.stringify(item), table_name:"software", deletedat:nowISO()}))
      .then(added=>{
        setSw(prev=>prev.filter(s=>s.id!==item.id));
        const t=Array.isArray(added)?added[0]:added;
        if(t) setTrash(prev=>[...prev,t]);
        addHistory("소프트웨어 삭제","software",item.id,item.name,"휴지통 이동",JSON.stringify(item),"");
      }).catch(err=>alert("삭제 오류: "+err.message));
  };

  // 소프트웨어 양식 다운로드
  const downloadSWTemplate = () => {
    const header = SW_FIELDS.map(f=>f.label).join(",");
    const example = SW_FIELDS.map(f=>{
      const ex={"소프트웨어명":"Microsoft Office","카테고리":"오피스","버전":"2021","제조사/벤더":"Microsoft",
        "라이선스 유형":"볼륨라이선스","라이선스 키":"XXXXX-XXXXX-XXXXX","수량":"10","비용":"500000",
        "구입일":"2023-01-01","만료일":"2026-01-01","담당자":"홍길동","지점":"강남의원",
        "상태":"사용중","비고":"연간갱신필요"};
      return `"${(ex[f.label]||"").replace(/"/g,'""')}"`;
    }).join(",");
    const csv="\uFEFF"+[header,example].join("\n");
    triggerDownload(new Blob([csv],{type:"text/csv;charset=utf-8"}),"소프트웨어가져오기_양식.csv");
  };
  const exportCSV = () => {
    const header=SW_FIELDS.map(f=>f.label).join(",");
    const rows=data.map(item=>SW_FIELDS.map(f=>`"${String(item[f.key]??"").replace(/"/g,'""')}"`).join(","));
    triggerDownload(new Blob(["\uFEFF"+[header,...rows].join("\n")],{type:"text/csv;charset=utf-8"}),`소프트웨어목록_${todayStr()}.csv`);
  };
  const exportExcel = async () => {
    try {
      const XLSX=await import("xlsx");
      const d=data.map(item=>{const r={};SW_FIELDS.forEach(f=>{r[f.label]=item[f.key]??""});return r;});
      const ws=XLSX.utils.json_to_sheet(d);const wb=XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb,ws,"소프트웨어목록");XLSX.writeFile(wb,`소프트웨어목록_${todayStr()}.xlsx`);
    } catch{alert("xlsx 패키지를 설치하세요: npm install xlsx");}
  };
  const parseCSVLine=(line)=>{
    const res=[];let cur="";let inQ=false;
    for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(inQ&&line[i+1]==='"'){cur+='"';i++;}else inQ=!inQ;}else if(c===","&&!inQ){res.push(cur.trim());cur="";}else cur+=c;}
    res.push(cur.trim());return res;
  };
  const handleImport = async (e) => {
    const file=e.target.files[0]; if(!file) return;
    setImportLoading(true);
    try {
      let rawRows=[];
      if(file.name.toLowerCase().endsWith(".csv")){
        const text=(await file.text()).replace(/^\uFEFF/,"");
        const lines=text.split(/\r?\n/).filter(l=>l.trim());
        const headers=parseCSVLine(lines[0]);
        rawRows=lines.slice(1).map(line=>{const v=parseCSVLine(line);const o={};headers.forEach((h,i)=>{o[h]=v[i]||"";});return o;});
      } else {
        const XLSX=await import("xlsx");
        const buf=await file.arrayBuffer();const wb=XLSX.read(buf,{type:"array"});
        rawRows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:""});
      }
      const items=rawRows.filter(r=>Object.values(r).some(v=>v!=="")).map(row=>{
        const item={status:"active"};
        SW_FIELDS.forEach(f=>{const val=row[f.label]!==undefined?row[f.label]:(row[f.key]!==undefined?row[f.key]:"");if(val!=="")item[f.key]=val;});
        return item;
      });
      if(!items.length){alert("데이터 없음");return;}
      const MAX=500;
      if(items.length>MAX){alert(`최대 ${MAX}건까지 가져올 수 있습니다.\n처음 ${MAX}건만 가져옵니다.`);items.splice(MAX);}
      if(!window.confirm(`${items.length}건을 가져오시겠습니까?`)) return;
      const res=await fetch(`${BASE_URL}/software`,{method:"POST",headers:{...H,"Prefer":"return=representation"},body:JSON.stringify(items)});
      if(!res.ok)throw new Error(await res.text());
      await api.getSW().then(list=>setSw(Array.isArray(list)?list:[]));
      // 파일 전체 요약 로그
      const names = items.map(it=>it.name||"-").join(", ");
      const summary = `파일명: ${file.name} / ${items.length}건 / 소프트웨어: ${names.length>200?names.slice(0,200)+"...":names}`;
      addHistory("파일 가져오기","software","",`${items.length}건`,summary,"",JSON.stringify(items.map(it=>({name:it.name,category:it.category,vendor:it.vendor,status:it.status,clinic:it.clinic,quantity:it.quantity}))));
      // 항목별 개별 로그
      items.forEach((it,idx)=>{
        const name=it.name||`항목${idx+1}`;
        const detail=`파일가져오기 (${file.name}) / 지점:${it.clinic||"-"} / 담당자:${it.assignedto||"-"} / 상태:${it.status||"-"} / 만료일:${it.expirydate||"-"}`;
        addHistory("소프트웨어 등록(가져오기)","software","",name,detail,"",JSON.stringify(it));
      });
      alert(`${items.length}건 완료!`);
    } catch(err){alert("가져오기 실패: "+err.message);}
    finally{setImportLoading(false);e.target.value="";}
  };

  // 컬럼 렌더러
  const SW_RENDERERS = {
    name:        s=><b style={{fontSize:13}}>{s.name||"-"}</b>,
    category:    s=>SW_CATEGORIES[s.category]||s.category||"-",
    version:     s=>s.version||"-",
    vendor:      s=>s.vendor||"-",
    licensetype: s=>s.licensetype||"-",
    licensekey:  s=><span style={{fontSize:11,fontFamily:"monospace"}}>{s.licensekey||"-"}</span>,
    quantity:    s=>s.quantity||"-",
    cost:        s=>s.cost||"-",
    purchasedate:s=>s.purchasedate||"-",
    expirydate:  s=>{const exp=s.expirydate;const isExp=exp&&new Date(exp)<new Date();return <span style={{color:isExp?"#cf1322":"inherit",fontWeight:isExp?700:400}}>{exp||"-"}</span>;},
    assignedto:  s=>s.assignedto||"-",
    clinic:      s=>CLINICS[s.clinic]||s.clinic||"-",
    status:      s=>{const b=STATUS_BADGE[s.status]||{bg:"#f1f5f9",color:"#64748b"};return <span style={{background:b.bg,color:b.color,padding:"3px 8px",borderRadius:20,fontSize:11,fontWeight:700}}>{SW_STATUS[s.status]||s.status||"-"}</span>;},
    notes:       s=><span style={{fontSize:12,maxWidth:120,display:"block",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.notes||"-"}</span>,
  };
  const allPageSWIds = pagedRows.map(s=>s.id);
  const isAllSWChecked = allPageSWIds.length>0 && allPageSWIds.every(id=>selectedIds.has(id));
  const activeSWCols = [
    {
      label: ()=>(
        <input type="checkbox" checked={isAllSWChecked}
          onChange={e=>{const n=new Set(selectedIds);if(e.target.checked){allPageSWIds.forEach(id=>n.add(id));}else{allPageSWIds.forEach(id=>n.delete(id));}setSelectedIds(n);}}
          style={{accentColor:"#0f6e56",width:13,height:13,cursor:"pointer"}}/>
      ),
      minWidth:36, noClip:true,
      render:s=>(
        <input type="checkbox" checked={selectedIds.has(s.id)}
          onChange={e=>{const n=new Set(selectedIds);e.target.checked?n.add(s.id):n.delete(s.id);setSelectedIds(n);}}
          onClick={e=>e.stopPropagation()}
          style={{accentColor:"#0f6e56",width:13,height:13,cursor:"pointer"}}/>
      )
    },
    ...ALL_SW_COLS.filter(c=>visibleCols.has(c.key)).map(c=>({label:c.label,render:SW_RENDERERS[c.key]||(s=>s[c.key]||"-")}))
  ];
  if(canEdit) activeSWCols.push({label:"관리", minWidth:140, noClip:true, render:s=>(
    <div style={{display:"flex",gap:4,flexWrap:"nowrap"}}>
      <Btn onClick={()=>{setForm({...s});setModal("edit");}} style={{fontSize:11,padding:"5px 7px"}}>수정</Btn>
      <Btn onClick={()=>deleteItem(s)} variant="danger" style={{fontSize:11,padding:"5px 7px"}}>삭제</Btn>
    </div>
  )});

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8,marginBottom:12}}>
        <h2 style={{margin:0,fontSize:20}}>소프트웨어 <span style={{fontSize:13,color:"#64748b",fontWeight:500}}>전체 {data.length}건{filtered.length!==data.length?` · 필터 ${filtered.length}건`:""}{selectedIds.size>0?` · 선택 ${selectedIds.size}건`:""}</span></h2>
        <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleImport} style={{display:"none"}}/>
          <Btn onClick={()=>fileInputRef.current?.click()} disabled={importLoading}>{importLoading?"가져오는 중...":"📂 가져오기"}</Btn>
          <Btn onClick={downloadSWTemplate}>📋 양식</Btn>
          <Btn onClick={exportCSV}>⬇️ CSV</Btn>
          <Btn onClick={exportExcel}>⬇️ Excel</Btn>
          {/* 컬럼 선택 */}
          <div ref={colMenuRef} style={{position:"relative"}}>
            <Btn onClick={()=>setShowColMenu(v=>!v)}>🔧 컬럼 {visibleCols.size}/{ALL_SW_COLS.length}</Btn>
            {showColMenu && (
              <div style={{position:"absolute",top:"calc(100% + 6px)",right:0,background:"#fff",border:"1px solid #e2e8f0",borderRadius:14,boxShadow:"0 8px 32px rgba(0,0,0,0.12)",zIndex:500,padding:14,width:240}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:8,paddingBottom:8,borderBottom:"1px solid #f0f0f0"}}>
                  <span style={{fontSize:12,fontWeight:700}}>컬럼 선택 (자동저장)</span>
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={()=>toggleAll(true)}  style={{fontSize:11,color:"#0f6e56",border:"none",background:"none",cursor:"pointer",fontWeight:600}}>전체</button>
                    <button onClick={()=>toggleAll(false)} style={{fontSize:11,color:"#cf1322",border:"none",background:"none",cursor:"pointer",fontWeight:600}}>초기화</button>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:2,maxHeight:280,overflowY:"auto"}}>
                  {ALL_SW_COLS.map(c=>(
                    <label key={c.key} style={{display:"flex",alignItems:"center",gap:5,padding:"4px",borderRadius:6,cursor:"pointer",fontSize:12,
                      background:visibleCols.has(c.key)?"#e8f5e9":"transparent",color:visibleCols.has(c.key)?"#0f6e56":"#64748b",fontWeight:visibleCols.has(c.key)?600:400}}>
                      <input type="checkbox" checked={visibleCols.has(c.key)} onChange={()=>toggleCol(c.key)} style={{accentColor:"#0f6e56",width:12,height:12}}/>
                      {c.label}
                    </label>
                  ))}
                </div>
                <div style={{marginTop:8,paddingTop:8,borderTop:"1px solid #f0f0f0",fontSize:11,color:"#94a3b8"}}>💾 계정별 자동 저장됩니다</div>
              </div>
            )}
          </div>
          {canEdit && selectedIds.size>0 && <Btn onClick={deleteSelected} variant="danger">🗑️ 선택삭제 ({selectedIds.size})</Btn>}
          {canEdit && <Btn onClick={()=>{setForm({status:"active"});setModal("add");}} variant="primary">+ 등록</Btn>}
        </div>
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
        <div style={{position:"relative",flex:1,minWidth:160}}>
          <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"#94a3b8"}}>🔍</span>
          <input placeholder="이름, 벤더, 담당자 검색..." value={search} onChange={e=>setSearch(e.target.value)}
            style={{width:"100%",padding:"9px 30px",borderRadius:10,border:"1px solid #ddd",fontSize:13,boxSizing:"border-box"}}/>
          {search&&<button onClick={()=>setSearch("")} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#94a3b8"}}>✕</button>}
        </div>
        <select value={filterClinic} onChange={e=>setFilterClinic(e.target.value)} style={{padding:"9px 10px",borderRadius:10,border:"1px solid #ddd",fontSize:13,background:"#fff"}}>
          {Object.entries(CLINICS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{padding:"9px 10px",borderRadius:10,border:"1px solid #ddd",fontSize:13,background:"#fff"}}>
          <option value="">상태 전체</option>
          {Object.entries(SW_STATUS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} style={{padding:"9px 10px",borderRadius:10,border:"1px solid #ddd",fontSize:13,background:"#fff"}}>
          <option value="">카테고리 전체</option>
          {Object.entries(SW_CATEGORIES).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
        {(search||filterClinic!=="all"||filterStatus||filterCat)&&<Btn onClick={()=>{setSearch("");setFilterClinic("all");setFilterStatus("");setFilterCat("");}}>초기화</Btn>}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:"#64748b"}}>
          <span>페이지당</span>
          <select value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setCurrentPage(1);}}
            style={{padding:"5px 8px",borderRadius:8,border:"1px solid #ddd",fontSize:13,background:"#fff"}}>
            {[10,20,30,50,100].map(n=><option key={n} value={n}>{n}개</option>)}
          </select>
          <span style={{fontSize:12}}>({(currentPage-1)*pageSize+1}–{Math.min(currentPage*pageSize,filtered.length)} / {filtered.length}건)</span>
        </div>
        {totalPages>1 && (
          <div style={{display:"flex",gap:4,alignItems:"center"}}>
            <Btn onClick={()=>setCurrentPage(1)}          disabled={currentPage===1}          style={{padding:"5px 10px",fontSize:12}}>«</Btn>
            <Btn onClick={()=>setCurrentPage(p=>p-1)}     disabled={currentPage===1}          style={{padding:"5px 10px",fontSize:12}}>‹</Btn>
            {Array.from({length:Math.min(5,totalPages)},(_,i)=>{
              let p=currentPage<=3?i+1:currentPage+i-2; if(p>totalPages)return null;
              return <Btn key={p} onClick={()=>setCurrentPage(p)}
                style={{padding:"5px 10px",fontSize:12,background:p===currentPage?"#0f6e56":"#fff",color:p===currentPage?"#fff":"#333",border:"1px solid #ddd"}}>{p}</Btn>;
            })}
            <Btn onClick={()=>setCurrentPage(p=>p+1)}     disabled={currentPage===totalPages} style={{padding:"5px 10px",fontSize:12}}>›</Btn>
            <Btn onClick={()=>setCurrentPage(totalPages)} disabled={currentPage===totalPages} style={{padding:"5px 10px",fontSize:12}}>»</Btn>
          </div>
        )}
      </div>
      <ResponsiveTable cols={activeSWCols} rows={pagedRows} empty="등록된 소프트웨어가 없습니다."/>
      {(modal==="add"||modal==="edit")&&(
        <Modal title={modal==="add"?"소프트웨어 등록":"소프트웨어 수정"} onClose={()=>setModal(null)}>
          <SWForm form={form} setForm={setForm} onSave={save} loading={loading}/>
        </Modal>
      )}
    </div>
  );
}
function SWForm({ form, setForm, onSave, loading }) {
  const inp={padding:"8px 10px",borderRadius:8,border:"1px solid #ddd",fontSize:13,width:"100%",boxSizing:"border-box"};
  return (
    <div style={{maxHeight:"62vh",overflowY:"auto",paddingRight:4}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
        {SW_FIELDS.map(f=>{
          if(f.type==="select") return (
            <label key={f.key} style={{display:"flex",flexDirection:"column",gap:3}}>
              <span style={{fontSize:11,color:"#64748b"}}>{f.label}</span>
              <select value={form[f.key]||""} onChange={e=>setForm({...form,[f.key]:e.target.value})} style={inp}>
                <option value="">선택...</option>
                {Object.entries(f.options).filter(([k])=>k!=="all").map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          );
          if(f.type==="textarea") return (
            <label key={f.key} style={{display:"flex",flexDirection:"column",gap:3,gridColumn:"1 / -1"}}>
              <span style={{fontSize:11,color:"#64748b"}}>{f.label}</span>
              <textarea value={form[f.key]||""} onChange={e=>setForm({...form,[f.key]:e.target.value})} rows={3} style={{...inp,resize:"vertical"}}/>
            </label>
          );
          return (
            <label key={f.key} style={{display:"flex",flexDirection:"column",gap:3}}>
              <span style={{fontSize:11,color:"#64748b"}}>{f.label}</span>
              <input type={f.type} value={form[f.key]||""} onChange={e=>setForm({...form,[f.key]:e.target.value})} style={inp}/>
            </label>
          );
        })}
      </div>
      <Btn onClick={onSave} variant="primary" disabled={loading} style={{width:"100%",padding:13}}>{loading?"저장 중...":"저장"}</Btn>
    </div>
  );
}

// ================================================================
// 👤 [사용자 관리]
// ================================================================
function UsersSection({ users, setUsers, addHistory, isAdmin, currentUser }) {
  const [modal,   setModal]  = useState(null);
  const [form,    setForm]   = useState({});
  const [loading, setLoading]= useState(false);

  // 읽기전용 또는 일반사용자는 관리 불가
  if(!isAdmin) return (
    <div>
      <h2 style={{fontSize:20,marginBottom:20}}>사용자 계정 ({users.length}명)</h2>
      <div style={{background:"#fffbe6",border:"1px solid #ffe58f",borderRadius:14,padding:"16px 20px",marginBottom:16,display:"flex",gap:12,alignItems:"center"}}>
        <span style={{fontSize:20}}>⚠️</span>
        <div>
          <div style={{fontWeight:700,fontSize:14,color:"#d48806",marginBottom:3}}>접근 제한</div>
          <div style={{fontSize:13,color:"#64748b"}}>사용자 계정 등록·수정·삭제는 <b>관리자</b>만 가능합니다.</div>
        </div>
      </div>
      <ResponsiveTable
        cols={[
          { label:"아이디",  key:"loginid", minWidth:130 },
          { label:"이름",    key:"name",    minWidth:110 },
          { label:"부서",    key:"dept",    minWidth:130 },
          { label:"지점",    minWidth:140,  render:u=>CLINICS[u.clinic]||u.clinic||"-" },
          { label:"권한",    minWidth:120,  render:u=>{ const r={admin:{bg:"#e8f5e9",c:"#0f6e56"},user:{bg:"#eff6ff",c:"#2563eb"},readonly:{bg:"#f1f5f9",c:"#64748b"}}[u.role]||{bg:"#f1f5f9",c:"#64748b"}; return <span style={{background:r.bg,color:r.c,padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700}}>{ROLES[u.role]||u.role}</span>; }},
        ]}
        rows={users} empty="사용자가 없습니다."
      />
    </div>
  );

  const save = () => {
    if(!form.loginid||!form.name) return alert("아이디와 이름을 입력하세요.");
    if(modal==="add"&&!form.password) return alert("비밀번호를 입력하세요.");
    setLoading(true);
    const isAdd=modal==="add";
    const req=isAdd?api.addUser(form):api.updateUser(form.id,form);
    req.then(()=>api.getUsers()).then(list=>{
      setUsers(Array.isArray(list)&&list.length?list:INIT_USERS);
      addHistory(isAdd?"사용자 등록":"사용자 수정","user",form.id||"",form.name,isAdd?"신규 등록":"정보 수정");
      setModal(null);
    }).catch(err=>alert("오류: "+err.message)).finally(()=>setLoading(false));
  };

  const deleteUser = (user) => {
    if(user.id===currentUser?.id) return alert("본인 계정은 삭제할 수 없습니다.");
    if(!window.confirm(`"${user.name}" 계정을 삭제하시겠습니까?`)) return;
    api.deleteUser(user.id).then(()=>api.getUsers()).then(list=>{
      setUsers(Array.isArray(list)&&list.length?list:INIT_USERS);
      addHistory("사용자 삭제","user",user.id,user.name,"계정 삭제");
    }).catch(err=>alert("삭제 오류: "+err.message));
  };

  const inp={padding:"9px 12px",borderRadius:9,border:"1px solid #ddd",fontSize:13,width:"100%",boxSizing:"border-box"};
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <h2 style={{margin:0,fontSize:20}}>사용자 계정 ({users.length}명)</h2>
        {isAdmin && <Btn onClick={()=>{setForm({role:"user"});setModal("add");}} variant="primary">+ 계정 등록</Btn>}
      </div>
      <ResponsiveTable
        cols={[
          { label:"아이디",   key:"loginid", minWidth:130 },
          { label:"이름",     key:"name",    minWidth:110 },
          { label:"부서",     key:"dept",    minWidth:130 },
          { label:"지점",     minWidth:140,  render:u=>CLINICS[u.clinic]||u.clinic||"-" },
          { label:"권한",     minWidth:120,  render:u=>{ const r={admin:{bg:"#e8f5e9",c:"#0f6e56"},user:{bg:"#eff6ff",c:"#2563eb"},readonly:{bg:"#f1f5f9",c:"#64748b"}}[u.role]||{bg:"#f1f5f9",c:"#64748b"}; return <span style={{background:r.bg,color:r.c,padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700}}>{ROLES[u.role]||u.role}</span>; }},
          { label:"관리",     minWidth:150,  noClip:true, render:u=>isAdmin&&(
            <div style={{display:"flex",gap:5,flexWrap:"nowrap"}}>
              <Btn onClick={()=>{setForm({...u});setModal("edit");}} style={{fontSize:11,padding:"5px 8px"}}>수정</Btn>
              <Btn onClick={()=>deleteUser(u)} variant="danger"     style={{fontSize:11,padding:"5px 8px"}}>삭제</Btn>
            </div>
          )},
        ]}
        rows={users} empty="사용자가 없습니다."
      />
      {(modal==="add"||modal==="edit") && (
        <Modal title={modal==="add"?"계정 등록":"계정 수정"} onClose={()=>setModal(null)}>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {[{key:"loginid",label:"아이디",type:"text"},{key:"name",label:"이름",type:"text"},{key:"dept",label:"부서",type:"text"}].map(f=>(
              <label key={f.key} style={{display:"flex",flexDirection:"column",gap:4}}>
                <span style={{fontSize:12,color:"#64748b"}}>{f.label}</span>
                <input type={f.type} value={form[f.key]||""} onChange={e=>setForm({...form,[f.key]:e.target.value})} style={inp}/>
              </label>
            ))}
            <label style={{display:"flex",flexDirection:"column",gap:4}}>
              <span style={{fontSize:12,color:"#64748b"}}>{modal==="edit"?"새 비밀번호 (변경 시만 입력)":"비밀번호"}</span>
              <input type="password" value={form.password||""} onChange={e=>setForm({...form,password:e.target.value})} style={inp}/>
            </label>
            <label style={{display:"flex",flexDirection:"column",gap:4}}>
              <span style={{fontSize:12,color:"#64748b"}}>지점</span>
              <select value={form.clinic||""} onChange={e=>setForm({...form,clinic:e.target.value})} style={inp}>
                {Object.entries(CLINICS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label style={{display:"flex",flexDirection:"column",gap:4}}>
              <span style={{fontSize:12,color:"#64748b"}}>권한</span>
              <select value={form.role||"user"} onChange={e=>setForm({...form,role:e.target.value})} style={inp}>
                {Object.entries(ROLES).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <Btn onClick={save} variant="primary" disabled={loading} style={{padding:13}}>{loading?"저장 중...":"저장"}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ================================================================
// 📝 [히스토리] 카테고리 + 상세 검색
// ================================================================
const HISTORY_CATEGORIES = {
  all:      "전체",
  hardware: "🖥️ 장비",
  software: "💿 소프트웨어",
  user:     "👤 사용자/로그인",
  assets:   "🖥️ 장비(복구)",
  trash:    "🗑️ 휴지통",
};
const CATEGORY_BADGE = {
  hardware: { bg:"#eff6ff", color:"#2563eb" },
  software: { bg:"#f0fdf4", color:"#0f6e56" },
  user:     { bg:"#faf5ff", color:"#7c3aed" },
  assets:   { bg:"#eff6ff", color:"#2563eb" },
  trash:    { bg:"#fff1f0", color:"#cf1322" },
};

function HistorySection({ history }) {
  const [query,      setQuery]      = useState("");
  const [field,      setField]      = useState("all");
  const [filterCat,  setFilterCat]  = useState("all");
  const [filterAction,setFilterAction] = useState("");
  const [showDetail, setShowDetail] = useState(null);

  const actions = [...new Set(history.map(h=>h.action).filter(Boolean))].sort();

  const filtered = history.filter(h=>{
    const q = query.trim().toLowerCase();
    const matchQ = !q || (field==="all"
      ? ["userName","action","aName","detail","clinic"].some(k=>(h[k]||"").toLowerCase().includes(q))
      : (h[field]||"").toLowerCase().includes(q));
    const matchCat = filterCat==="all" || h.aType===filterCat;
    const matchAct = !filterAction || h.action===filterAction;
    return matchQ && matchCat && matchAct;
  });

  // 카테고리별 카운트
  const catCounts = {};
  history.forEach(h=>{ const k=h.aType||"etc"; catCounts[k]=(catCounts[k]||0)+1; });

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <h2 style={{margin:0}}>활동 로그</h2>
        <span style={{fontSize:13,color:"#64748b"}}>
          전체 <b style={{color:"#0f6e56"}}>{history.length}</b>건
          {(query||filterCat!=="all"||filterAction) && ` · 검색 ${filtered.length}건`}
        </span>
      </div>

      {/* 카테고리 탭 */}
      <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
        {Object.entries(HISTORY_CATEGORIES).map(([k,v])=>{
          const cnt = k==="all" ? history.length : (catCounts[k]||0);
          if(k!=="all" && cnt===0) return null;
          return (
            <button key={k} onClick={()=>setFilterCat(k)}
              style={{padding:"6px 14px",borderRadius:20,border:"none",cursor:"pointer",fontSize:12,fontWeight:700,
                background:filterCat===k?"#0f6e56":"#f1f5f9",
                color:filterCat===k?"#fff":"#64748b"}}>
              {v} <span style={{opacity:0.7}}>({cnt})</span>
            </button>
          );
        })}
      </div>

      {/* 검색 바 */}
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
        <select value={field} onChange={e=>setField(e.target.value)}
          style={{padding:"9px 10px",borderRadius:10,border:"1px solid #ddd",fontSize:13,background:"#fff"}}>
          <option value="all">전체 필드</option>
          <option value="userName">수행자</option>
          <option value="action">액션</option>
          <option value="aName">대상</option>
          <option value="detail">상세</option>
          <option value="clinic">지점</option>
        </select>
        <select value={filterAction} onChange={e=>setFilterAction(e.target.value)}
          style={{padding:"9px 10px",borderRadius:10,border:"1px solid #ddd",fontSize:13,background:"#fff"}}>
          <option value="">액션 전체</option>
          {actions.map(a=><option key={a} value={a}>{a}</option>)}
        </select>
        <div style={{flex:1,position:"relative",minWidth:160}}>
          <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"#94a3b8"}}>🔍</span>
          <input type="text" placeholder="수행자, 대상, 상세내용 검색..." value={query} onChange={e=>setQuery(e.target.value)}
            style={{width:"100%",padding:"9px 32px",borderRadius:10,border:"1px solid #ddd",fontSize:13,boxSizing:"border-box"}}/>
          {query&&<button onClick={()=>setQuery("")}
            style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#94a3b8"}}>✕</button>}
        </div>
        {(query||filterCat!=="all"||filterAction) &&
          <Btn onClick={()=>{setQuery("");setFilterCat("all");setFilterAction("");}}>초기화</Btn>}
      </div>

      <ResponsiveTable
        cols={[
          { label:"시간",    minWidth:155, render:h=><span style={{fontSize:11,whiteSpace:"nowrap",color:"#64748b"}}>{fDT(h.ts)}</span> },
          { label:"수행자",  minWidth:100, key:"userName" },
          { label:"카테고리",minWidth:130, render:h=>{
            const b=CATEGORY_BADGE[h.aType]||{bg:"#f1f5f9",color:"#64748b"};
            return <span style={{background:b.bg,color:b.color,padding:"2px 8px",borderRadius:10,fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>
              {HISTORY_CATEGORIES[h.aType]||h.aType||"-"}
            </span>;
          }},
          { label:"액션",    minWidth:170, render:h=><span style={{background:"#f1f5f9",padding:"2px 8px",borderRadius:10,fontSize:12}}>{h.action}</span> },
          { label:"대상",    minWidth:130, key:"aName" },
          { label:"상세",    minWidth:240, key:"detail" },
          { label:"지점",    minWidth:120, render:h=>CLINICS[h.clinic]||h.clinic||"-" },
          { label:"변경내용",minWidth:90,  noClip:true, render:h=>(h.before||h.after)&&(
            <Btn onClick={()=>setShowDetail(h)} style={{fontSize:11,padding:"4px 8px"}}>보기</Btn>
          )},
        ]}
        rows={filtered} empty={query||filterCat!=="all"?"검색 결과 없음":"로그가 없습니다."}
      />
      {showDetail && (
        <Modal title="변경 내용 상세" onClose={()=>setShowDetail(null)}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {["before","after"].map(k=>(
              <div key={k}>
                <div style={{fontSize:12,fontWeight:700,color:k==="before"?"#cf1322":"#0f6e56",marginBottom:6}}>
                  {k==="before"?"변경 전":"변경 후"}
                </div>
                <pre style={{background:"#f8fafc",padding:10,borderRadius:8,fontSize:11,overflow:"auto",maxHeight:260,margin:0,whiteSpace:"pre-wrap",wordBreak:"break-all"}}>
                  {(() => { try { return showDetail[k]?JSON.stringify(JSON.parse(showDetail[k]),null,2):"(없음)"; } catch { return showDetail[k]||"(없음)"; } })()}
                </pre>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}


// ================================================================
// 📷 [QR 스캔] 스마트폰 카메라로 아이메드코드 인식
// ================================================================
function QRScannerLoader({ onLoad }) {
  useEffect(() => {
    if (window.jsQR) { onLoad(); return; }
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js";
    s.onload = onLoad;
    s.onerror = () => console.error("jsQR 로드 실패");
    document.head.appendChild(s);
  }, []);
  return null;
}

function QRScanSection({ hw, onClose }) {
  const [jsQRReady, setJsQRReady] = useState(!!window.jsQR);
  const [scanning,  setScanning]  = useState(false);
  const [scanned,   setScanned]   = useState(null);   // 스캔된 QR 텍스트
  const [asset,     setAsset]     = useState(null);   // 찾은 자산
  const [notFound,  setNotFound]  = useState(false);
  const [camError,  setCamError]  = useState("");
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animRef   = useRef(null);

  const stopScan = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (animRef.current)   cancelAnimationFrame(animRef.current);
    streamRef.current = null;
    setScanning(false);
  };

  useEffect(() => () => stopScan(), []);

  const startScan = async () => {
    setCamError(""); setScanned(null); setAsset(null); setNotFound(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setScanning(true);
      const tick = () => {
        const v = videoRef.current; const c = canvasRef.current;
        if (!v || !c || v.readyState < 2) { animRef.current = requestAnimationFrame(tick); return; }
        c.width = v.videoWidth; c.height = v.videoHeight;
        const ctx = c.getContext("2d"); ctx.drawImage(v, 0, 0);
        const img = ctx.getImageData(0, 0, c.width, c.height);
        if (window.jsQR) {
          const code = window.jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
          if (code?.data) {
            const text = code.data.trim();
            setScanned(text);
            // 아이메드코드(imedcode)가 QR코드 값과 일치하는 자산 검색
            // 예: QR코드 값 "GCSF-PC-039" → imedcode 컬럼에서 검색
            const found = hw.find(h =>
              (h.imedcode || "").trim().toUpperCase() === text.toUpperCase()
            );
            setAsset(found || null);
            setNotFound(!found);
            stopScan(); return;
          }
        }
        animRef.current = requestAnimationFrame(tick);
      };
      animRef.current = requestAnimationFrame(tick);
    } catch (err) {
      setCamError("카메라 접근 오류: " + err.message);
    }
  };

  const reset = () => { setScanned(null); setAsset(null); setNotFound(false); setCamError(""); };

  return (
    <div>
      <QRScannerLoader onLoad={() => setJsQRReady(true)} />
      {!onClose && <h2 style={{ fontSize:22, fontWeight:700, marginBottom:6 }}>📷 QR 스캔</h2>}
      {/* 안내 박스 */}
      <div style={{ background:"#e8f5e9", borderRadius:14, padding:"14px 18px", marginBottom:20, border:"1px solid #a7d7a8" }}>
        <div style={{ fontSize:13, fontWeight:700, color:"#0f6e56", marginBottom:6 }}>📋 사용 방법</div>
        <div style={{ fontSize:12, color:"#334155", lineHeight:1.8 }}>
          1. 자산 스티커에서 QR코드를 찾으세요<br/>
          2. QR코드 값 = <b>아이메드 코드</b> (예: GCSF-PC-039)<br/>
          3. 스캔 시작 버튼을 누르고 카메라를 QR코드에 갖다 대세요<br/>
          4. 자동 인식 후 자산 상세정보가 표시됩니다
        </div>
      </div>

      {/* 스캔 영역 */}
      {!scanned && (
        <div style={{ textAlign:"center" }}>
          <div style={{ position:"relative", display:"inline-block", borderRadius:20, overflow:"hidden", background:"#000",
            width:"100%", maxWidth:400, aspectRatio:"1/1", marginBottom:16 }}>
            <video ref={videoRef} playsInline muted style={{ width:"100%", height:"100%", objectFit:"cover", display:scanning?"block":"none" }} />
            {!scanning && (
              <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:12 }}>
                <span style={{ fontSize:64 }}>📷</span>
                <span style={{ color:"#fff", fontSize:14 }}>카메라가 여기에 표시됩니다</span>
              </div>
            )}
            {/* 스캔 가이드 박스 */}
            {scanning && (
              <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", pointerEvents:"none" }}>
                <div style={{ width:"60%", height:"60%", border:"3px solid #0f6e56", borderRadius:12, boxShadow:"0 0 0 9999px rgba(0,0,0,0.35)" }} />
              </div>
            )}
          </div>
          <canvas ref={canvasRef} style={{ display:"none" }} />

          {camError && <div style={{ color:"#cf1322", fontSize:13, marginBottom:12, padding:"10px 16px", background:"#fff1f0", borderRadius:10 }}>{camError}</div>}

          {!scanning
            ? <Btn onClick={startScan} variant="primary" disabled={!jsQRReady} style={{ fontSize:15, padding:"14px 40px", borderRadius:14 }}>
                {jsQRReady ? "📷 스캔 시작" : "라이브러리 로딩 중..."}
              </Btn>
            : <Btn onClick={stopScan} variant="danger" style={{ fontSize:15, padding:"14px 40px", borderRadius:14 }}>⏹ 중지</Btn>
          }
          {scanning && <p style={{ color:"#64748b", fontSize:12, marginTop:12 }}>QR코드를 카메라 중앙 박스에 맞춰주세요</p>}
        </div>
      )}

      {/* 스캔 결과 */}
      {scanned && (
        <div>
          <div style={{ background:"#f8fafc", borderRadius:14, padding:"14px 18px", marginBottom:16, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <div style={{ fontSize:11, color:"#94a3b8", marginBottom:3 }}>인식된 코드</div>
              <div style={{ fontSize:16, fontWeight:700, color:"#0f6e56" }}>{scanned}</div>
            </div>
            <Btn onClick={reset} style={{ fontSize:12 }}>🔄 다시 스캔</Btn>
          </div>

          {/* 자산 정보 카드 */}
          {asset ? (
            <div style={{ background:"#fff", borderRadius:20, border:"2px solid #0f6e56", padding:24 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
                <h3 style={{ margin:0, fontSize:18, color:"#0f6e56" }}>✅ 자산 정보</h3>
                {(() => { const s = STATUS_BADGE[asset.assetstatus]||{bg:"#f1f5f9",color:"#64748b"};
                  return <span style={{ background:s.bg, color:s.color, padding:"4px 14px", borderRadius:20, fontSize:12, fontWeight:700 }}>{ASSET_STATUS[asset.assetstatus]||asset.assetstatus}</span>; })()}
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                {[
                  { label:"GC자산코드",   value: asset.gccode      },
                  { label:"아이메드코드",  value: asset.imedcode    },
                  { label:"모델명",        value: asset.modelname   },
                  { label:"자산구분",      value: ASSET_TYPES[asset.assettype]||asset.assettype },
                  { label:"제조번호",      value: asset.serialnumber},
                  { label:"IP",           value: asset.ip          },
                  { label:"팀(부서명)",    value: asset.team        },
                  { label:"사용자",        value: asset.username    },
                  { label:"지점",          value: CLINICS[asset.clinic]||asset.clinic },
                  { label:"위치",          value: asset.location    },
                  { label:"제조사",        value: asset.manufacturer},
                  { label:"CPU",          value: asset.cpu         },
                  { label:"Memory",       value: asset.memory      },
                  { label:"하드디스크",    value: asset.hdd         },
                  { label:"수령일",        value: asset.receiptdate },
                  { label:"구입일",        value: asset.purchasedate},
                ].filter(r => r.value).map((row, i) => (
                  <div key={i} style={{ background:"#f8fafc", borderRadius:10, padding:"10px 12px" }}>
                    <div style={{ fontSize:11, color:"#94a3b8", marginBottom:3 }}>{row.label}</div>
                    <div style={{ fontSize:13, fontWeight:600, color:"#1e293b", wordBreak:"break-all" }}>{row.value}</div>
                  </div>
                ))}
              </div>
              {asset.notes && (
                <div style={{ marginTop:12, background:"#fffbe6", borderRadius:10, padding:"10px 14px" }}>
                  <div style={{ fontSize:11, color:"#94a3b8", marginBottom:3 }}>비고(이력관리)</div>
                  <div style={{ fontSize:13, color:"#334155" }}>{asset.notes}</div>
                </div>
              )}
              <div style={{ marginTop:16, display:"flex", gap:10 }}>
                <Btn onClick={reset} style={{ flex:1, textAlign:"center" }}>🔄 다시 스캔</Btn>
                {onClose && <Btn onClick={onClose} variant="primary" style={{ flex:1, textAlign:"center" }}>✕ 닫기</Btn>}
              </div>
            </div>
          ) : notFound && (
            <div style={{ background:"#fff1f0", borderRadius:16, padding:30, textAlign:"center", border:"1px solid #ffa39e" }}>
              <div style={{ fontSize:40, marginBottom:12 }}>❌</div>
              <div style={{ fontSize:16, fontWeight:700, color:"#cf1322", marginBottom:6 }}>자산을 찾을 수 없습니다</div>
              <div style={{ fontSize:13, color:"#64748b", marginBottom:8 }}>
                아이메드 코드 <b style={{color:"#cf1322"}}>{scanned}</b> 에 해당하는 자산이 없습니다.
              </div>
              <div style={{ fontSize:12, color:"#94a3b8" }}>DB에 해당 아이메드 코드가 등록되어 있는지 확인해주세요.</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ================================================================
// 🗑️ [휴지통]
// ================================================================
function TrashSection({ trash, setTrash, setHw, setSw, addHistory, canEdit }) {
  const [search,     setSearch]     = useState("");
  const [filterType, setFilterType] = useState("all"); // "all" | "assets" | "software"

  // DB 자동생성 컬럼 제거 — 복구 시 이 컬럼들을 포함하면 INSERT 오류 발생
  const DB_AUTO_COLS = ["id","created_at","updated_at","deleted_at"];

  const getData = t => {
    if (typeof t.item_data === "string") {
      try { return JSON.parse(t.item_data); } catch { return {}; }
    }
    return t.item_data || {};
  };
  const getTable = t => t.table_name || "assets";

  const filtered = trash.filter(t => {
    const d = getData(t);
    const tb = getTable(t);
    const matchType = filterType === "all" || tb === filterType;
    const q = search.trim().toLowerCase();
    const matchSearch = !q || [d.gccode, d.modelname, d.name, d.team, d.assignedto, d.clinic, d.username]
      .some(v => (v || "").toLowerCase().includes(q));
    return matchType && matchSearch;
  });

  const restore = (trashItem) => {
    const orig  = getData(trashItem);
    const table = getTable(trashItem);
    // DB 자동생성 컬럼 전부 제거
    const rest  = Object.fromEntries(Object.entries(orig).filter(([k]) => !DB_AUTO_COLS.includes(k)));
    const name  = rest.gccode || rest.modelname || rest.name || "항목";
    const typeLabel = table === "assets" ? "장비" : "소프트웨어";
    const aType     = table === "assets" ? "hardware" : "software";
    if (!window.confirm(`"${name}"을(를) 복구하시겠습니까?`)) return;
    api.deleteTrash(trashItem.id)
      .then(() => fetch(`${BASE_URL}/${table}`, {
        method:"POST",
        headers:{...H,"Prefer":"return=representation"},
        body: JSON.stringify(rest)
      }).then(safeJson))
      .then(restored => {
        setTrash(prev => prev.filter(t => t.id !== trashItem.id));
        const item = Array.isArray(restored) ? restored[0] : restored;
        if (table === "assets")   setHw(prev => [...prev, item]);
        else if (table === "software") setSw(prev => [...prev, item]);
        addHistory("데이터 복구", aType, item?.id, name,
          `${typeLabel} 휴지통에서 복구`, "", JSON.stringify(rest));
      }).catch(err => alert("복구 오류: " + err.message));
  };

  const deleteForever = (trashItem) => {
    if (!window.confirm("영구 삭제하시겠습니까? 복구 불가합니다.")) return;
    const orig  = getData(trashItem);
    const name  = orig.gccode || orig.modelname || orig.name || "항목";
    const table = getTable(trashItem);
    const aType = table === "assets" ? "hardware" : "software";
    api.deleteTrash(trashItem.id).then(() => {
      setTrash(prev => prev.filter(t => t.id !== trashItem.id));
      addHistory("영구 삭제", aType, trashItem.id, name,
        "휴지통에서 영구 삭제", JSON.stringify(orig), "");
    }).catch(err => alert("영구삭제 오류: " + err.message));
  };

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
        <h2 style={{margin:0}}>휴지통 <span style={{fontSize:13,color:"#64748b",fontWeight:500}}>전체 {trash.length}건{filtered.length!==trash.length?` · 필터 ${filtered.length}건`:""}</span></h2>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          {/* 구분 필터 */}
          <select value={filterType} onChange={e=>setFilterType(e.target.value)}
            style={{padding:"8px 10px",borderRadius:10,border:"1px solid #ddd",fontSize:13,background:"#fff"}}>
            <option value="all">전체</option>
            <option value="assets">장비</option>
            <option value="software">소프트웨어</option>
          </select>
          {/* 검색 */}
          <div style={{position:"relative"}}>
            <span style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",color:"#94a3b8",fontSize:13}}>🔍</span>
            <input placeholder="GC코드, 모델명, 사용자 검색..." value={search} onChange={e=>setSearch(e.target.value)}
              style={{padding:"8px 10px 8px 28px",borderRadius:10,border:"1px solid #ddd",fontSize:13,width:220}}/>
            {search && <button onClick={()=>setSearch("")}
              style={{position:"absolute",right:6,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#94a3b8"}}>✕</button>}
          </div>
        </div>
      </div>
      <ResponsiveTable
        cols={[
          { label:"구분",   minWidth:110, render:t=>{ const tb=getTable(t); return <span style={{background:tb==="assets"?"#eff6ff":"#f0fdf4",color:tb==="assets"?"#2563eb":"#0f6e56",padding:"2px 8px",borderRadius:10,fontSize:11,fontWeight:700}}>{tb==="assets"?"🖥️ 장비":"💿 소프트웨어"}</span>; }},
          { label:"이름/코드", minWidth:180, render:t=>{ const d=getData(t); return <span style={{fontWeight:600,fontSize:13}}>{d.gccode||d.modelname||d.name||"-"}</span>; }},
          { label:"모델/버전", minWidth:140, render:t=>{ const d=getData(t); return d.modelname||d.version||"-"; }},
          { label:"팀/담당",  minWidth:130, render:t=>{ const d=getData(t); return d.team||d.assignedto||"-"; }},
          { label:"사용자",   minWidth:110, render:t=>{ const d=getData(t); return d.username||"-"; }},
          { label:"지점",     minWidth:120, render:t=>{ const d=getData(t); return CLINICS[d.clinic]||d.clinic||"-"; }},
          { label:"상태",     minWidth:110, render:t=>{ const d=getData(t); const sk=d.assetstatus||d.status; const b=STATUS_BADGE[sk]||{bg:"#f1f5f9",color:"#64748b"}; return sk?<span style={{background:b.bg,color:b.color,padding:"2px 8px",borderRadius:10,fontSize:11,fontWeight:700}}>{ASSET_STATUS[sk]||SW_STATUS[sk]||sk}</span>:"-"; }},
          { label:"삭제일",   minWidth:155, render:t=>fDT(t.deletedat||t.deletedAt||t.created_at) },
          { label:"관리",     minWidth:180, noClip:true, render:t=>canEdit&&(
            <div style={{display:"flex",gap:5,flexWrap:"nowrap"}}>
              <Btn onClick={()=>restore(t)} variant="warning" style={{fontSize:11,padding:"5px 8px"}}>🔄 복구</Btn>
              <Btn onClick={()=>deleteForever(t)} variant="danger" style={{fontSize:11,padding:"5px 8px"}}>🗑️ 영구삭제</Btn>
            </div>
          )},
        ]}
        rows={filtered} empty={search||filterType!=="all"?"검색 결과가 없습니다.":"휴지통이 비어있습니다."}
      />
    </div>
  );
}

// ================================================================
// 🔑 [로그인]
// ================================================================
function LoginPage({ onLogin, users }) {
  const [id,  setId]      = useState("");
  const [pw,  setPw]      = useState("");
  const [loading, setLoading] = useState(false);
  const [usersReady, setUsersReady] = useState(users.length > 0);

  // users가 비동기로 로드되므로 준비 상태 감지
  useEffect(() => { if (users.length > 0) setUsersReady(true); }, [users.length]);

  const submit = async (e) => {
    e.preventDefault();
    const user = users.find(u => u.loginid === id && u.password === pw);
    if (!user) { alert("아이디 또는 비밀번호가 틀립니다."); return; }
    setLoading(true);
    try { await onLogin(user); }
    finally { setLoading(false); }
  };

  return (
    <div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f1f5f9"}}>
      <form onSubmit={submit} style={{width:340,background:"#fff",padding:40,borderRadius:24,boxShadow:"0 4px 24px rgba(0,0,0,0.08)"}}>
        <h1 style={{textAlign:"center",color:"#0f6e56",marginBottom:6,fontSize:22}}>IT Asset Manager</h1>
        <p style={{textAlign:"center",color:"#94a3b8",marginBottom:28,fontSize:12}}>GC녹십자아이메드 IT자산관리</p>
        {!usersReady && (
          <div style={{textAlign:"center",fontSize:12,color:"#94a3b8",marginBottom:12,padding:"8px",background:"#f8fafc",borderRadius:8}}>
            ⏳ 사용자 정보 로딩 중...
          </div>
        )}
        <input placeholder="아이디" value={id} onChange={e=>setId(e.target.value)} required disabled={loading}
          style={{width:"100%",padding:14,marginBottom:10,borderRadius:10,border:"1px solid #eee",fontSize:14,boxSizing:"border-box"}}/>
        <input type="password" placeholder="비밀번호" value={pw} onChange={e=>setPw(e.target.value)} required disabled={loading}
          style={{width:"100%",padding:14,marginBottom:20,borderRadius:10,border:"1px solid #eee",fontSize:14,boxSizing:"border-box"}}/>
        <Btn type="submit" variant="primary" disabled={loading||!usersReady} style={{width:"100%",padding:15,fontSize:15}}>
          {loading ? "로그인 중..." : "로그인"}
        </Btn>
      </form>
    </div>
  );
}

// ================================================================
// 🔘 공통 컴포넌트
// ================================================================
function Btn({onClick,variant="default",children,style={},disabled=false,type="button"}){
  const S={default:{background:"#fff",color:"#333",border:"1px solid #ddd"},primary:{background:"#0f6e56",color:"#fff",border:"none"},danger:{background:"#fff1f0",color:"#cf1322",border:"1px solid #ffa39e"},warning:{background:"#fffbe6",color:"#d48806",border:"1px solid #ffe58f"}};
  return <button type={type} onClick={onClick} disabled={disabled} style={{padding:"10px 14px",borderRadius:10,fontSize:13,fontWeight:600,cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.6:1,...S[variant],...style}}>{children}</button>;
}
function Modal({title,onClose,children}){
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:16}}>
      <div style={{background:"#fff",borderRadius:20,width:"100%",maxWidth:580,padding:24,maxHeight:"90vh",display:"flex",flexDirection:"column"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <h2 style={{margin:0,fontSize:17}}>{title}</h2>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",color:"#94a3b8"}}>✕</button>
        </div>
        <div style={{overflowY:"auto"}}>{children}</div>
      </div>
    </div>
  );
}
function ResizeHandle({ onResize }) {
  const startRef = useRef(null);
  const handleMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    startRef.current = { x: e.clientX };
    const onMove = (mv) => {
      if (!startRef.current) return;
      const delta = mv.clientX - startRef.current.x;
      startRef.current.x = mv.clientX;
      onResize(delta);
    };
    const onUp = () => {
      startRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };
  return (
    <div
      onMouseDown={handleMouseDown}
      style={{position:"absolute",right:0,top:0,bottom:0,width:6,cursor:"col-resize",zIndex:10,
        background:"transparent",borderRight:"2px solid transparent",transition:"border-color 0.15s"}}
      onMouseEnter={e=>e.currentTarget.style.borderRightColor="#0f6e56"}
      onMouseLeave={e=>e.currentTarget.style.borderRightColor="transparent"}
    />
  );
}
function ResponsiveTable({cols,rows,empty="데이터가 없습니다."}){
  const calcW = (c) => {
    if(c.minWidth) return c.minWidth;
    const lbl = typeof c.label==="function" ? "□" : (c.label||"");
    // 한국어 기준: 글자당 16px + 좌우 패딩 32px
    return Math.max(80, lbl.length * 16 + 32);
  };
  const [colWidths, setColWidths] = useState(() => cols.map(calcW));
  useEffect(() => {
    setColWidths(prev => prev.length !== cols.length ? cols.map(calcW) : prev);
  }, [cols.length]);

  const handleResize = (i, delta) => {
    setColWidths(prev => {
      const next = [...prev];
      next[i] = Math.max(50, next[i] + delta);
      return next;
    });
  };

  const scrollRef = useRef(null);
  const thumbRef  = useRef(null);
  const trackRef  = useRef(null);
  const totalWidth = colWidths.reduce((a,b)=>a+b,0);

  // 테이블 스크롤 ↔ 썸네일 동기화
  const syncThumb = () => {
    const el = scrollRef.current; const tr = trackRef.current; const th = thumbRef.current;
    if(!el||!tr||!th) return;
    const ratio = el.clientWidth / el.scrollWidth;
    const thumbW = Math.max(40, tr.clientWidth * ratio);
    const maxScroll = el.scrollWidth - el.clientWidth;
    const maxThumb  = tr.clientWidth - thumbW;
    th.style.width = thumbW + "px";
    th.style.left  = (maxScroll > 0 ? (el.scrollLeft / maxScroll) * maxThumb : 0) + "px";
    tr.style.display = ratio >= 1 ? "none" : "block";
  };

  useEffect(() => {
    const el = scrollRef.current;
    if(!el) return;
    syncThumb();
    el.addEventListener("scroll", syncThumb);
    const ro = new ResizeObserver(syncThumb);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", syncThumb); ro.disconnect(); };
  }, [totalWidth, colWidths]);

  // 썸 드래그
  const thumbDragRef = useRef(null);
  const startThumbDrag = (e) => {
    e.preventDefault();
    const el = scrollRef.current; const tr = trackRef.current; const th = thumbRef.current;
    if(!el||!tr||!th) return;
    const startX = e.clientX;
    const startLeft = el.scrollLeft;
    const trackW = tr.clientWidth;
    const thumbW = th.offsetWidth;
    const maxScroll = el.scrollWidth - el.clientWidth;
    const onMove = (mv) => {
      const delta = mv.clientX - startX;
      const ratio = delta / (trackW - thumbW);
      el.scrollLeft = Math.max(0, Math.min(maxScroll, startLeft + ratio * maxScroll));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div style={{background:"#fff",borderRadius:14,border:"1px solid #eee",display:"flex",flexDirection:"column"}}>
      {/* 테이블 영역 - 가로 스크롤, 세로 스크롤바 없음 */}
      <div ref={scrollRef} style={{overflowX:"auto",overflowY:"visible",scrollbarWidth:"none",msOverflowStyle:"none"}}
        onScroll={syncThumb}>
        <style>{".hw-no-sb::-webkit-scrollbar{display:none}"}</style>
        <div className="hw-no-sb">
        <table style={{borderCollapse:"collapse",tableLayout:"fixed",width:totalWidth}}>
          <colgroup>
            {colWidths.map((w,i)=><col key={i} style={{width:w}}/>)}
          </colgroup>
          <thead>
            <tr style={{background:"#f8fafc"}}>
              {cols.map((c,i)=>(
                <th key={i} style={{padding:"12px 12px",textAlign:"left",fontSize:11,color:"#94a3b8",
                  borderBottom:"1px solid #f0f0f0",whiteSpace:"nowrap",fontWeight:600,
                  position:"relative",userSelect:"none",overflow:"hidden"}}>
                  <span style={{display:"block",overflow:"hidden",textOverflow:"ellipsis",paddingRight:8}}>{typeof c.label==="function"?c.label():c.label}</span>
                  <ResizeHandle onResize={delta=>handleResize(i,delta)}/>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length===0
              ?<tr><td colSpan={cols.length} style={{padding:40,textAlign:"center",color:"#94a3b8"}}>{empty}</td></tr>
              :rows.map((row,ri)=>(
                <tr key={ri} style={{borderBottom:"1px solid #f8fafc"}} onMouseEnter={e=>e.currentTarget.style.background="#fafafa"} onMouseLeave={e=>e.currentTarget.style.background=""}>
                  {cols.map((c,ci)=>(
                    <td key={ci} style={{padding:"11px 12px",fontSize:13,
                      overflow: c.noClip ? "visible" : "hidden",
                      textOverflow: c.noClip ? "unset" : "ellipsis",
                      whiteSpace: c.noClip ? "normal" : "nowrap"}}>
                      {c.render?c.render(row):row[c.key]}
                    </td>
                  ))}
                </tr>
              ))
            }
          </tbody>
        </table>
        </div>
      </div>
      {/* 커스텀 가로 스크롤바 - 테이블 바로 아래 고정 */}
      <div ref={trackRef} style={{position:"sticky",bottom:0,height:12,background:"#f1f5f9",borderTop:"1px solid #e2e8f0",borderRadius:"0 0 14px 14px",cursor:"pointer"}}
        onClick={e=>{
          const el=scrollRef.current; const tr=trackRef.current; const th=thumbRef.current;
          if(!el||!tr||!th) return;
          const rect=tr.getBoundingClientRect();
          const clickX=e.clientX-rect.left;
          const ratio=clickX/tr.clientWidth;
          el.scrollLeft=(el.scrollWidth-el.clientWidth)*ratio;
        }}>
        <div ref={thumbRef} onMouseDown={startThumbDrag}
          style={{position:"absolute",top:2,height:8,background:"#94a3b8",borderRadius:4,cursor:"grab",transition:"background 0.15s",minWidth:40}}
          onMouseEnter={e=>e.currentTarget.style.background="#64748b"}
          onMouseLeave={e=>e.currentTarget.style.background="#94a3b8"}
        />
      </div>
    </div>
  );
}
